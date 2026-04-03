"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerData } from "../../context";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "../../types";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

function Avatar({ profile, large = false }: { profile: Profile; large?: boolean }) {
  const initials = `${profile.name?.[0] ?? ""}${profile.surname?.[0] ?? ""}`.toUpperCase();
  const colors = ["bg-blue-500", "bg-purple-500", "bg-green-500", "bg-orange-500", "bg-pink-500", "bg-indigo-500", "bg-teal-500", "bg-rose-500"];
  const color = colors[((profile.name ?? "").charCodeAt(0) ?? 0) % colors.length];
  const cls = large ? "w-12 h-12 text-base" : "w-8 h-8 text-xs";
  if (profile.avatar_url) {
    return <img src={profile.avatar_url} alt={initials} className={`${cls} rounded-full object-cover ring-2 ring-white flex-shrink-0`} />;
  }
  return <div className={`${cls} rounded-full ${color} flex items-center justify-center text-white font-bold ring-2 ring-white flex-shrink-0`}>{initials}</div>;
}

export default function ConfigUsersPage() {
  const { data, load, loading } = useManagerData();
  const [showCreate, setShowCreate] = useState(false);
  const [f, setF] = useState({ name: "", surname: "", email: "", password: "", phone: "" });
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [assigningUnit, setAssigningUnit] = useState<{ profileId: string } | null>(null);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const [editF, setEditF] = useState({ name: "", surname: "", phone: "" });
  const [assignAsOwner, setAssignAsOwner] = useState(true);
  const [newPassword, setNewPassword] = useState("");
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const { locale } = useLocale();
  if (loading) return <p className="text-muted-foreground">{t(locale, "common.loading")}</p>;

  const ownerMap = new Map(data.unitOwners.map(uo => [uo.unit_id, uo.owner_id]));
  const tenantMap = new Map(data.unitTenantAssignments.map(a => [a.unit_id, a.tenant_id]));
  const profileUnitsMap = new Map<string, string[]>();
  data.unitOwners.forEach(uo => {
    const existing = profileUnitsMap.get(uo.owner_id) ?? [];
    profileUnitsMap.set(uo.owner_id, [...existing, uo.unit_id]);
  });
  data.unitTenantAssignments.forEach(a => {
    const existing = profileUnitsMap.get(a.tenant_id) ?? [];
    profileUnitsMap.set(a.tenant_id, [...existing, a.unit_id]);
  });
  const unitNameMap = new Map(data.units.map(u => [u.id, u.unit_name]));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/manager/users/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
      const r = await res.json();
      if (r.success) {
        setMsg({ text: t(locale, "configUsers.userCreated"), ok: true });
        setF({ name: "", surname: "", email: "", password: "", phone: "" });
        setShowCreate(false);
        load();
      } else setMsg({ text: r.error ?? t(locale, "common.failed"), ok: false });
    } catch {
      setMsg({ text: t(locale, "configUsers.failedToCreate"), ok: false });
    }
  }

  async function saveEdit() {
    if (!editingUser) return;
    const res = await fetch("/api/users/update", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: editingUser.id, name: editF.name, surname: editF.surname, phone: editF.phone }) });
    const r = await res.json();
    if (r.success) {
      setMsg({ text: "User updated.", ok: true });
      setEditingUser(null);
      load();
    } else setMsg({ text: r.error ?? "Failed", ok: false });
  }

  async function resetPassword() {
    if (!editingUser || newPassword.length < 6) {
      setMsg({ text: t(locale, "configUsers.passwordMinLength"), ok: false });
      return;
    }
    const res = await fetch("/api/users/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: editingUser.id, newPassword }) });
    const r = await res.json();
    if (r.success) {
      setMsg({ text: t(locale, "configUsers.passwordReset"), ok: true });
      setNewPassword("");
    } else setMsg({ text: r.error ?? "Failed", ok: false });
  }

  async function deleteUser(userId: string) {
    if (!confirm(t(locale, "configUsers.deleteUserConfirm"))) return;
    const res = await fetch(`/api/users/update?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    const r = await res.json();
    if (r.success) {
      setMsg({ text: "User deleted.", ok: true });
      setEditingUser(null);
      load();
    } else setMsg({ text: r.error ?? "Failed", ok: false });
  }

  async function assignUnit(profileId: string, unitId: string) {
    if (!editingUser) return;
    const res = await fetch("/api/manager/assign-unit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId,
        ownerId: assignAsOwner ? profileId : (ownerMap.get(unitId) ?? null),
        tenantId: assignAsOwner ? (tenantMap.get(unitId) ?? null) : profileId,
      }),
    });
    const j = await res.json();
    if (res.ok && j.success) {
      setAssigningUnit(null);
      setSelectedUnit("");
      load();
    } else setMsg({ text: j.error ?? t(locale, "configUsers.failedToAssign"), ok: false });
  }

  async function removeUnit(unitId: string) {
    if (!editingUser) return;
    const isOwner = ownerMap.get(unitId) === editingUser.id;
    const res = await fetch("/api/manager/assign-unit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId,
        ownerId: isOwner ? null : (ownerMap.get(unitId) ?? null),
        tenantId: isOwner ? (tenantMap.get(unitId) ?? null) : null,
      }),
    });
    const j = await res.json();
    if (res.ok && j.success) load();
    else setMsg({ text: j.error ?? "Failed to remove", ok: false });
  }

  async function uploadAvatar(profileId: string, file: File) {
    setUploadingFor(profileId);
    const sb = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profileId}.${ext}`;
    const { error: upErr } = await sb.storage.from("avatars").upload(path, file, { upsert: true });
    if (!upErr) {
      const { data: urlData } = sb.storage.from("avatars").getPublicUrl(path);
      await sb.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", profileId);
      if (editingUser?.id === profileId) setEditingUser({ ...editingUser, avatar_url: urlData.publicUrl });
      load();
    } else setMsg({ text: t(locale, "configUsers.uploadFailed") + upErr.message, ok: false });
    setUploadingFor(null);
  }

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      manager: "bg-purple-100 text-purple-700",
      owner: "bg-blue-100 text-blue-700",
      tenant: "bg-green-100 text-green-700",
      resident: "bg-slate-100 text-slate-600",
    };
    const labels: Record<string, string> = {
      manager: t(locale, "manager.managerRole"),
      owner: t(locale, "common.owner"),
      tenant: t(locale, "table.tenant"),
      resident: t(locale, "common.resident"),
    };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[role] ?? "bg-gray-100 text-gray-600"}`}>{labels[role] ?? role}</span>;
  };

  const unitsForAssignment = data.units.filter(u => {
    if (!editingUser) return false;
    if (assignAsOwner) return !ownerMap.has(u.id) || ownerMap.get(u.id) === editingUser.id;
    return !tenantMap.has(u.id) || tenantMap.get(u.id) === editingUser.id;
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{t(locale, "configUsers.users")} ({data.profiles.length})</CardTitle>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingUser(null); }}>
          {showCreate ? t(locale, "common.cancel") : t(locale, "configUsers.addUser")}
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}

        {showCreate && (
          <div className="border border-green-200 bg-green-50/20 dark:bg-green-950/20 dark:border-green-800 rounded-lg p-4">
            <p className="text-base font-semibold mb-3">{t(locale, "configUsers.createNewUser")}</p>
            <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><Label>{t(locale, "common.name")}</Label><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} required /></div>
              <div><Label>{t(locale, "auth.surname")}</Label><Input value={f.surname} onChange={e => setF({ ...f, surname: e.target.value })} required /></div>
              <div><Label>{t(locale, "common.email")}</Label><Input type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} required /></div>
              <div><Label>{t(locale, "auth.password")}</Label><Input type="password" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} required minLength={6} /></div>
              <div className="col-span-2 md:col-span-1"><Label>{t(locale, "common.phone")}</Label><Input value={f.phone} onChange={e => setF({ ...f, phone: e.target.value })} placeholder="+355..." /></div>
              <p className="col-span-2 md:col-span-3 text-xs text-muted-foreground">{t(locale, "configUsers.createThenAssignUnits")}</p>
              <div className="col-span-2 md:col-span-3 flex gap-2">
                <Button type="submit">{t(locale, "configUsers.createUser")}</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4">
          <div className={`overflow-x-auto ${editingUser ? "md:col-span-1" : "md:col-span-2"}`}>
            <table className="w-full min-w-full text-sm table-fixed">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground w-10"></th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">{t(locale, "common.name")}</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">{t(locale, "common.email")}</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">{t(locale, "common.role")}</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">{t(locale, "common.units")}</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">{t(locale, "table.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.profiles.map(p => {
                  const assignedUnitIds = profileUnitsMap.get(p.id) ?? [];
                  const assignedNames = assignedUnitIds.map(uid => unitNameMap.get(uid)).filter(Boolean);
                  const isActive = editingUser?.id === p.id;
                  return (
                    <tr key={p.id} className={`transition-colors ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/20"}`}>
                      <td className="px-3 py-2"><Avatar profile={p} /></td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{p.name} {p.surname}</div>
                        <div className="text-xs text-muted-foreground">{p.phone ? <a href={`tel:${p.phone.replace(/[\s\-\(\)\.]/g, "")}`} className="text-primary hover:underline">{p.phone}</a> : ""}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{p.email}</td>
                      <td className="px-3 py-3">
                        <div className="flex flex-wrap gap-1">
                          {p.role === "manager" ? roleBadge("manager") : null}
                          {p.role !== "manager" && data.unitOwners.some(o => o.owner_id === p.id) ? roleBadge("owner") : null}
                          {p.role !== "manager" && data.unitTenantAssignments.some(a => a.tenant_id === p.id) ? roleBadge("tenant") : null}
                          {p.role !== "manager" && p.role === "resident" && !data.unitOwners.some(o => o.owner_id === p.id) && !data.unitTenantAssignments.some(a => a.tenant_id === p.id) ? roleBadge("resident") : null}
                        </div>
                      </td>
                      <td className="px-3 py-3">
                        {assignedNames.length > 0
                          ? <div className="flex flex-wrap gap-1">{assignedNames.map((n, i) => <span key={i} className="text-xs bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800 px-1.5 py-0.5 rounded">{n}</span>)}</div>
                          : <span className="text-xs text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Button size="sm" variant={isActive ? "default" : "ghost"} className="h-7 px-3 text-xs"
                          onClick={() => {
                            if (isActive) {
                              setEditingUser(null);
                              setNewPassword("");
                            } else {
                              setEditingUser(p);
                              setEditF({ name: p.name, surname: p.surname, phone: p.phone ?? "" });
                              setAssignAsOwner(true);
                              setNewPassword("");
                              setShowCreate(false);
                            }
                          }}>
                          {isActive ? t(locale, "common.close") : t(locale, "common.edit")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!data.profiles.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">{t(locale, "configUsers.noUsersYet")}</td></tr>}
              </tbody>
            </table>
          </div>

          {editingUser && (
            <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="pb-3 border-b flex items-center gap-3">
                <label className="cursor-pointer relative group flex-shrink-0" title="Click to change photo">
                  <Avatar profile={editingUser} large />
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadAvatar(editingUser.id, file); }} />
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold">📷</div>
                  {uploadingFor === editingUser.id && <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white text-[10px]">...</div>}
                </label>
                <div>
                  <p className="text-base font-semibold">{editingUser.name} {editingUser.surname}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{editingUser.email}</p>
                </div>
              </div>
              <div className="space-y-4 pt-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t(locale, "configUsers.profile")}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <div><Label className="text-xs">Name</Label><Input value={editF.name} onChange={e => setEditF({ ...editF, name: e.target.value })} className="h-8 text-sm" /></div>
                    <div><Label className="text-xs">{t(locale, "auth.surname")}</Label><Input value={editF.surname} onChange={e => setEditF({ ...editF, surname: e.target.value })} className="h-8 text-sm" /></div>
                    <div className="col-span-2"><Label className="text-xs">{t(locale, "common.email")}</Label><Input value={editingUser.email} disabled className="h-8 text-sm bg-muted text-muted-foreground cursor-not-allowed" /></div>
                    <div className="col-span-2"><Label className="text-xs">{t(locale, "common.phone")}</Label><Input value={editF.phone} onChange={e => setEditF({ ...editF, phone: e.target.value })} className="h-8 text-sm" placeholder="+355..." /></div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">{t(locale, "configUsers.rolePerUnitHint")}</p>
                  <Button size="sm" className="mt-2 w-full" onClick={saveEdit}>{t(locale, "configUsers.saveProfile")}</Button>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Unit Assignments</p>
                  <div className="space-y-2">
                    {(profileUnitsMap.get(editingUser.id) ?? []).map(uid => (
                      <div key={uid} className="flex items-center justify-between bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded px-3 py-1.5">
                        <span className="text-sm text-blue-800 dark:text-blue-300 font-medium">{unitNameMap.get(uid)}</span>
                        <button type="button" onClick={() => removeUnit(uid)} className="text-xs text-red-500 hover:text-red-700">{t(locale, "configUsers.remove")}</button>
                      </div>
                    ))}
                    {assigningUnit?.profileId === editingUser.id ? (
                      <div className="space-y-2">
                        <div className="flex gap-2 flex-wrap">
                          <Button type="button" size="sm" variant={assignAsOwner ? "secondary" : "outline"} className="h-8 text-xs" onClick={() => setAssignAsOwner(true)}>{t(locale, "common.owner")}</Button>
                          <Button type="button" size="sm" variant={!assignAsOwner ? "secondary" : "outline"} className="h-8 text-xs" onClick={() => setAssignAsOwner(false)}>{t(locale, "table.tenant")}</Button>
                        </div>
                        <div className="flex gap-2">
                        <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                          <SelectTrigger className="h-8 flex-1"><SelectValue placeholder={t(locale, "configUsers.selectUnit")} /></SelectTrigger>
                          <SelectContent>{unitsForAssignment.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
                        </Select>
                        <Button size="sm" className="h-8" onClick={() => selectedUnit && assignUnit(editingUser.id, selectedUnit)} disabled={!selectedUnit}>{t(locale, "configUsers.assign")}</Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAssigningUnit(null); setSelectedUnit(""); }}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => { setAssigningUnit({ profileId: editingUser.id }); setSelectedUnit(""); }}>+ Assign unit</Button>
                    )}
                  </div>
                </div>

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">{t(locale, "configUsers.resetPassword")}</p>
                  <div className="flex gap-2">
                    <Input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder={t(locale, "configUsers.newPasswordPlaceholder")} className="h-8 text-sm flex-1" />
                    <Button size="sm" className="h-8" variant="outline" onClick={resetPassword} disabled={newPassword.length < 6}>{t(locale, "configUsers.set")}</Button>
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <Button size="sm" variant="destructive" className="w-full" onClick={() => deleteUser(editingUser.id)}>{t(locale, "configUsers.deleteUserPermanent")}</Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
