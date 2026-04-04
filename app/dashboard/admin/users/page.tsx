"use client";

import { useState } from "react";
import { useAdminData } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, Pencil, Building2 } from "lucide-react";

type UserRow = { id: string; name: string; surname: string; email: string; phone: string | null; role: string; site_id: string; site_name: string; units: string[] };

export default function AdminUsersPage() {
  const { sites, managers, usersBySite, buildings, load, msg, setMsg } = useAdminData();
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userSiteFilter, setUserSiteFilter] = useState<string>("all");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", surname: "", email: "", password: "", phone: "", role: "resident", residentSiteId: "", siteName: "", siteAddress: "", vat_account: "", tax_amount: "", bank_name: "", iban: "", swift_code: "" });
  const [editUser, setEditUser] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState({ name: "", surname: "", email: "", phone: "", password: "", vat_account: "", tax_amount: "", bank_name: "", iban: "", swift_code: "" });
  const [assignManagerSite, setAssignManagerSite] = useState<UserRow | null>(null);
  const [assignManagerSiteId, setAssignManagerSiteId] = useState("");
  const [assignResidentSiteUser, setAssignResidentSiteUser] = useState<UserRow | null>(null);
  const [assignResidentSiteId, setAssignResidentSiteId] = useState("");

  const allRows: UserRow[] = [];
  usersBySite.forEach(({ site_id, site_name, manager, owners, tenants }) => {
    if (manager) allRows.push({ id: manager.id, name: manager.name, surname: manager.surname, email: manager.email, phone: manager.phone ?? null, role: "manager", site_id, site_name, units: [] });
    owners.forEach(u => allRows.push({ id: u.id, name: u.name, surname: u.surname, email: u.email, phone: u.phone ?? null, role: u.role, site_id, site_name, units: u.units }));
    tenants.forEach(u => allRows.push({ id: u.id, name: u.name, surname: u.surname, email: u.email, phone: u.phone ?? null, role: u.role, site_id, site_name, units: u.units }));
  });
  const managersWithoutSite = managers.filter(m => !sites.some(s => s.manager_id === m.id));
  managersWithoutSite.forEach(m => {
    if (!allRows.some(r => r.id === m.id)) allRows.push({ id: m.id, name: m.name, surname: m.surname, email: m.email, phone: m.phone ?? null, role: "manager", site_id: "__unassigned__", site_name: "No site", units: [] });
  });

  const searchLower = userSearch.trim().toLowerCase();
  const filtered = allRows.filter(r => {
    if (searchLower && !`${r.name} ${r.surname}`.toLowerCase().includes(searchLower)) return false;
    if (userRoleFilter !== "all" && r.role !== userRoleFilter) return false;
    if (userSiteFilter !== "all" && r.site_id !== userSiteFilter) return false;
    return true;
  });
  const siteOptions = Array.from(new Map(allRows.map(r => [r.site_id, { id: r.site_id, name: r.site_name }])).values()).filter(x => x.id !== "__admin__");
  const assignableSites = sites.filter(s => s.id && s.id !== "__admin__" && s.id !== "__unassigned__");
  const residentSiteOptions = (() => {
    const m = new Map<string, { id: string; name: string }>();
    assignableSites.forEach(s => m.set(s.id, { id: s.id, name: s.name }));
    if (m.size === 0) {
      usersBySite.forEach(({ site_id, site_name }) => {
        if (site_id && site_id !== "__admin__" && site_id !== "__unassigned__" && site_name) m.set(site_id, { id: site_id, name: site_name });
      });
    }
    return [...m.values()];
  })();

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    if (userForm.role === "manager") {
      const res = await fetch("/api/admin/create-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: userForm.name, surname: userForm.surname, email: userForm.email, password: userForm.password,
          phone: userForm.phone || undefined,
          siteName: userForm.siteName || undefined, siteAddress: userForm.siteAddress || undefined,
          vat_account: userForm.vat_account || undefined, tax_amount: userForm.tax_amount ? parseFloat(userForm.tax_amount) : undefined,
          bank_name: userForm.bank_name || undefined, iban: userForm.iban || undefined, swift_code: userForm.swift_code || undefined,
        }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMsg({ text: "Manager created.", ok: true });
        setUserForm({ name: "", surname: "", email: "", password: "", phone: "", role: "resident", residentSiteId: "", siteName: "", siteAddress: "", vat_account: "", tax_amount: "", bank_name: "", iban: "", swift_code: "" });
        setShowCreateUser(false);
        load();
      } else {
        setMsg({ text: json.error || "Failed", ok: false });
      }
    } else {
      if (!userForm.residentSiteId) {
        setMsg({ text: "Select a site for this user.", ok: false });
        return;
      }
      const res = await fetch("/api/admin/users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: userForm.name, surname: userForm.surname, email: userForm.email, password: userForm.password, phone: userForm.phone, role: userForm.role, siteId: userForm.residentSiteId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMsg({ text: "User created on site. The site manager can assign a unit from the manager dashboard.", ok: true });
        setUserForm({ name: "", surname: "", email: "", password: "", phone: "", role: "resident", residentSiteId: "", siteName: "", siteAddress: "", vat_account: "", tax_amount: "", bank_name: "", iban: "", swift_code: "" });
        setShowCreateUser(false);
        load();
      } else {
        setMsg({ text: json.error || "Failed", ok: false });
      }
    }
  }

  async function openEdit(row: UserRow) {
    const res = await fetch(`/api/admin/users/${row.id}`);
    if (!res.ok) return;
    const data = await res.json();
    const site = data.site;
    setEditUser(row);
    setEditForm({
      name: data.name,
      surname: data.surname,
      email: data.email,
      phone: data.phone || "",
      password: "",
      vat_account: site?.vat_account || "",
      tax_amount: site?.tax_amount != null ? String(site.tax_amount) : "",
      bank_name: site?.bank_name || "",
      iban: site?.iban || "",
      swift_code: site?.swift_code || "",
    });
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    setMsg({ text: "", ok: true });
    const body: Record<string, unknown> = {
      ...editForm,
      password: editForm.password || undefined,
    };
    if (editUser.role === "manager") {
      body.vat_account = editForm.vat_account ?? "";
      body.tax_amount = editForm.tax_amount ? parseFloat(editForm.tax_amount) : null;
      body.bank_name = editForm.bank_name ?? "";
      body.iban = editForm.iban ?? "";
      body.swift_code = editForm.swift_code ?? "";
    }
    const res = await fetch(`/api/admin/users/${editUser.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Profile updated.", ok: true });
      setEditUser(null);
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function submitAssignManagerSite() {
    if (!assignManagerSite || !assignManagerSiteId) return;
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/assign-manager-site", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ managerId: assignManagerSite.id, siteId: assignManagerSiteId }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Manager assigned to site.", ok: true });
      setAssignManagerSite(null);
      setAssignManagerSiteId("");
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function submitAssignResidentSite() {
    if (!assignResidentSiteUser || !assignResidentSiteId) return;
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/assign-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: assignResidentSiteUser.id, siteId: assignResidentSiteId }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "User linked to site.", ok: true });
      setAssignResidentSiteUser(null);
      setAssignResidentSiteId("");
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function deleteUnassignedUser(userId: string) {
    if (!confirm("Delete this user permanently? This cannot be undone.")) return;
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/users/update?userId=${encodeURIComponent(userId)}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "User deleted.", ok: true });
      load();
    } else {
      setMsg({ text: json.error || "Failed to delete", ok: false });
    }
  }

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <p className="text-sm text-muted-foreground">All users (managers, residents). New residents are linked to a site here; unit assignment is done by each site&apos;s manager.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" variant={showCreateUser ? "outline" : "default"} onClick={() => setShowCreateUser(!showCreateUser)}>
                <Plus className="size-4 mr-1" />{showCreateUser ? "Cancel" : "+ Add user"}
              </Button>
            </div>
            {showCreateUser && (
              <div className="border border-green-200 bg-green-50/20 dark:bg-green-950/20 rounded-lg p-4">
                <p className="font-semibold mb-3">Create user</p>
                <form onSubmit={createUser} className="grid gap-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><Label className="text-xs">Role</Label>
                      <Select value={userForm.role} onValueChange={v => setUserForm({ ...userForm, role: v })}>
                        <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="manager">Manager</SelectItem><SelectItem value="resident">Resident</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                  {userForm.role !== "manager" && (
                    <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-3 space-y-2">
                      <p className="text-sm font-semibold">1. Site for this resident (required)</p>
                      <div>
                        <Label className="text-xs">Site</Label>
                        <Select value={userForm.residentSiteId || "__"} onValueChange={v => setUserForm({ ...userForm, residentSiteId: v === "__" ? "" : v })}>
                          <SelectTrigger className="h-9 mt-1 w-full max-w-md"><SelectValue placeholder="Choose a site" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__">— Choose site —</SelectItem>
                            {residentSiteOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      {residentSiteOptions.length === 0 ? (
                        <p className="text-xs text-amber-700 dark:text-amber-400">No sites found. Create a manager with a site (or add sites) first, then refresh this page.</p>
                      ) : (
                        <p className="text-xs text-muted-foreground">Pick the site before filling name and email. The manager assigns units to residents.</p>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div><Label className="text-xs">Name</Label><Input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} required className="h-8" /></div>
                    <div><Label className="text-xs">Surname</Label><Input value={userForm.surname} onChange={e => setUserForm({ ...userForm, surname: e.target.value })} required className="h-8" /></div>
                    <div><Label className="text-xs">Email</Label><Input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required className="h-8" /></div>
                    <div><Label className="text-xs">Password</Label><Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required minLength={6} className="h-8" /></div>
                    <div className="md:col-span-2"><Label className="text-xs">Phone</Label><Input value={userForm.phone} onChange={e => setUserForm({ ...userForm, phone: e.target.value })} className="h-8" placeholder="+355..." /></div>
                  </div>
                  {userForm.role === "manager" && (
                    <>
                      <p className="text-xs font-medium mt-2">Site (created for manager)</p>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <div><Label className="text-xs">Site name</Label><Input value={userForm.siteName} onChange={e => setUserForm({ ...userForm, siteName: e.target.value })} className="h-8" placeholder="e.g. Building Complex A" /></div>
                        <div><Label className="text-xs">Site address</Label><Input value={userForm.siteAddress} onChange={e => setUserForm({ ...userForm, siteAddress: e.target.value })} className="h-8" /></div>
                        <div><Label className="text-xs">VAT account</Label><Input value={userForm.vat_account} onChange={e => setUserForm({ ...userForm, vat_account: e.target.value })} className="h-8" /></div>
                        <div><Label className="text-xs">Tax %</Label><Input type="number" step="0.01" value={userForm.tax_amount} onChange={e => setUserForm({ ...userForm, tax_amount: e.target.value })} className="h-8" /></div>
                        <div><Label className="text-xs">Bank name</Label><Input value={userForm.bank_name} onChange={e => setUserForm({ ...userForm, bank_name: e.target.value })} className="h-8" /></div>
                        <div><Label className="text-xs">IBAN</Label><Input value={userForm.iban} onChange={e => setUserForm({ ...userForm, iban: e.target.value })} className="h-8" /></div>
                        <div><Label className="text-xs">SWIFT</Label><Input value={userForm.swift_code} onChange={e => setUserForm({ ...userForm, swift_code: e.target.value })} className="h-8" /></div>
                      </div>
                    </>
                  )}
                  <div className="flex gap-2">
                    <Button type="submit" size="sm">Create</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowCreateUser(false)}>Cancel</Button>
                  </div>
                </form>
              </div>
            )}
            {editUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={e => e.target === e.currentTarget && setEditUser(null)}>
                <div className="bg-background p-6 rounded-lg shadow-lg max-w-lg mx-4 w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                  <p className="font-semibold mb-3">Edit profile: {editUser.name} {editUser.surname}</p>
                  <form onSubmit={saveEdit} className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label className="text-xs">Name</Label><Input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} required /></div>
                      <div><Label className="text-xs">Surname</Label><Input value={editForm.surname} onChange={e => setEditForm({ ...editForm, surname: e.target.value })} required /></div>
                    </div>
                    <div><Label className="text-xs">Email</Label><Input type="email" value={editForm.email} onChange={e => setEditForm({ ...editForm, email: e.target.value })} required /></div>
                    <div><Label className="text-xs">Phone</Label><Input value={editForm.phone} onChange={e => setEditForm({ ...editForm, phone: e.target.value })} /></div>
                    <div><Label className="text-xs">New password (optional)</Label><Input type="password" value={editForm.password} onChange={e => setEditForm({ ...editForm, password: e.target.value })} placeholder="Leave blank to keep" /></div>
                    {editUser.role === "manager" && (
                      <>
                        <p className="text-xs font-medium mt-2">Site (VAT & bank)</p>
                        <div className="grid grid-cols-2 gap-3">
                          <div><Label className="text-xs">VAT account</Label><Input value={editForm.vat_account} onChange={e => setEditForm({ ...editForm, vat_account: e.target.value })} /></div>
                          <div><Label className="text-xs">Tax %</Label><Input type="number" step="0.01" value={editForm.tax_amount} onChange={e => setEditForm({ ...editForm, tax_amount: e.target.value })} /></div>
                          <div><Label className="text-xs">Bank name</Label><Input value={editForm.bank_name} onChange={e => setEditForm({ ...editForm, bank_name: e.target.value })} /></div>
                          <div><Label className="text-xs">IBAN</Label><Input value={editForm.iban} onChange={e => setEditForm({ ...editForm, iban: e.target.value })} /></div>
                          <div><Label className="text-xs">SWIFT</Label><Input value={editForm.swift_code} onChange={e => setEditForm({ ...editForm, swift_code: e.target.value })} /></div>
                        </div>
                      </>
                    )}
                    <div className="flex gap-2">
                      <Button type="submit" size="sm">Save</Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
                    </div>
                  </form>
                </div>
              </div>
            )}
            {assignResidentSiteUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={e => e.target === e.currentTarget && setAssignResidentSiteUser(null)}>
                <div className="bg-background p-6 rounded-lg shadow-lg max-w-md mx-4 w-full" onClick={e => e.stopPropagation()}>
                  <p className="font-semibold mb-1">Assign site — {assignResidentSiteUser.name} {assignResidentSiteUser.surname}</p>
                  <p className="text-xs text-muted-foreground mb-3">Link this user to a site. Their manager assigns units.</p>
                  <div className="flex flex-wrap gap-3 items-end mt-4">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs">Site</Label>
                      <Select value={assignResidentSiteId || "__"} onValueChange={v => setAssignResidentSiteId(v === "__" ? "" : v)}>
                        <SelectTrigger className="w-full mt-1"><SelectValue placeholder="Select site" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__">— Select —</SelectItem>
                          {residentSiteOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={submitAssignResidentSite} disabled={!assignResidentSiteId}>Save</Button>
                      <Button size="sm" variant="outline" onClick={() => setAssignResidentSiteUser(null)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {assignManagerSite && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={e => e.target === e.currentTarget && setAssignManagerSite(null)}>
                <div className="bg-background p-6 rounded-lg shadow-lg max-w-md mx-4 w-full" onClick={e => e.stopPropagation()}>
                  <p className="font-semibold mb-1">Assign site to manager: {assignManagerSite.name} {assignManagerSite.surname}</p>
                  <div className="flex flex-wrap gap-3 items-end mt-4">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs">Site</Label>
                      <Select value={assignManagerSiteId || "__"} onValueChange={v => setAssignManagerSiteId(v === "__" ? "" : v)}>
                        <SelectTrigger className="w-full mt-1"><SelectValue placeholder="Select site" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__">— Select —</SelectItem>
                          {assignableSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={submitAssignManagerSite} disabled={!assignManagerSiteId}>Assign</Button>
                      <Button size="sm" variant="outline" onClick={() => setAssignManagerSite(null)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 min-w-[180px] max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input placeholder="Search by name" value={userSearch} onChange={e => setUserSearch(e.target.value)} className="pl-8 h-9" />
              </div>
              <Select value={userRoleFilter} onValueChange={setUserRoleFilter}>
                <SelectTrigger className="w-36 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All roles</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="resident">Resident</SelectItem>
                  <SelectItem value="owner">Owner (legacy)</SelectItem>
                  <SelectItem value="tenant">Tenant (legacy)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={userSiteFilter} onValueChange={setUserSiteFilter}>
                <SelectTrigger className="w-48 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sites</SelectItem>
                  {siteOptions.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="border rounded-lg overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Name</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Email</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Role</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Site</th>
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground">Units</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map(r => (
                    <tr key={r.id} className={`hover:bg-muted/20 ${r.site_id === "__unassigned__" ? "bg-amber-50/50 dark:bg-amber-950/20" : ""}`}>
                      <td className="px-4 py-2.5 font-medium">{r.name} {r.surname}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.email}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.phone ? <a href={`tel:${r.phone.replace(/[\s\-\(\)\.]/g, "")}`} className="text-primary hover:underline">{r.phone}</a> : "—"}</td>
                      <td className="px-4 py-2.5"><span className="capitalize">{r.role}</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.site_name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.units.length ? r.units.join(", ") : "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex gap-1 justify-end flex-wrap">
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(r)} title="Edit profile"><Pencil className="size-3.5 mr-0.5" />Edit</Button>
                          {r.role === "manager" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAssignManagerSite(r); setAssignManagerSiteId(r.site_id !== "__unassigned__" ? r.site_id : ""); }} title="Assign site"><Building2 className="size-3.5 mr-0.5" />Assign site</Button>
                          )}
                          {(r.role === "resident" || r.role === "owner" || r.role === "tenant") && (
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAssignResidentSiteUser(r); setAssignResidentSiteId(r.site_id && r.site_id !== "__unassigned__" ? r.site_id : ""); }} title="Assign site"><Building2 className="size-3.5 mr-0.5" />Assign site</Button>
                          )}
                          {(r.role === "manager" || r.role === "resident" || r.role === "owner" || r.role === "tenant") && (
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteUnassignedUser(r.id)}>Delete</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!filtered.length && <p className="py-6 text-center text-muted-foreground">No users match your filters.</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
