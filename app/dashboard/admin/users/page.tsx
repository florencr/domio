"use client";

import { useState } from "react";
import { useAdminData } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search } from "lucide-react";

export default function AdminUsersPage() {
  const { sites, usersBySite, load, msg, setMsg } = useAdminData();
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState<string>("all");
  const [userSiteFilter, setUserSiteFilter] = useState<string>("all");
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [userForm, setUserForm] = useState({ name: "", surname: "", email: "", password: "", phone: "", role: "owner" });
  const [assignUser, setAssignUser] = useState<{ id: string; name: string; surname: string; email: string; role: string; units: string[] } | null>(null);
  const [assignForm, setAssignForm] = useState({ siteId: "" });

  type UserRow = { id: string; name: string; surname: string; email: string; phone: string | null; role: string; site_id: string; site_name: string; units: string[] };
  const allRows: UserRow[] = [];
  usersBySite.forEach(({ site_id, site_name, manager, owners, tenants }) => {
    if (manager) allRows.push({ id: manager.id, name: manager.name, surname: manager.surname, email: manager.email, phone: manager.phone ?? null, role: "manager", site_id, site_name, units: [] });
    owners.forEach(u => allRows.push({ id: u.id, name: u.name, surname: u.surname, email: u.email, phone: u.phone ?? null, role: "owner", site_id, site_name, units: u.units }));
    tenants.forEach(u => allRows.push({ id: u.id, name: u.name, surname: u.surname, email: u.email, phone: u.phone ?? null, role: u.role, site_id, site_name, units: u.units }));
  });
  const searchLower = userSearch.trim().toLowerCase();
  const filtered = allRows.filter(r => {
    if (searchLower && !`${r.name} ${r.surname}`.toLowerCase().includes(searchLower)) return false;
    if (userRoleFilter !== "all" && r.role !== userRoleFilter) return false;
    if (userSiteFilter !== "all" && r.site_id !== userSiteFilter) return false;
    return true;
  });
  const siteOptions = [...new Set(usersBySite.map(s => ({ id: s.site_id, name: s.site_name })))];
  const assignableSites = sites.filter(s => s.id && s.id !== "__admin__" && s.id !== "__unassigned__");

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/users/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(userForm),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "User created. Assign them to a site below.", ok: true });
      setUserForm({ name: "", surname: "", email: "", password: "", phone: "", role: "owner" });
      setShowCreateUser(false);
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function submitAssign() {
    if (!assignUser || !assignForm.siteId) return;
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/assign-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: assignUser.id, siteId: assignForm.siteId, role: assignUser.role }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "User assigned to site. Manager can assign units from their dashboard.", ok: true });
      setAssignUser(null);
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
          <p className="text-sm text-muted-foreground">All users with filters by role and site. Search by name.</p>
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
                <p className="font-semibold mb-3">Create user (owner/tenant)</p>
                <p className="text-xs text-muted-foreground mb-3">User will appear in Unassigned. Assign site after creation.</p>
                <form onSubmit={createUser} className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><Label className="text-xs">Name</Label><Input value={userForm.name} onChange={e => setUserForm({ ...userForm, name: e.target.value })} required className="h-8" /></div>
                  <div><Label className="text-xs">Surname</Label><Input value={userForm.surname} onChange={e => setUserForm({ ...userForm, surname: e.target.value })} required className="h-8" /></div>
                  <div><Label className="text-xs">Email</Label><Input type="email" value={userForm.email} onChange={e => setUserForm({ ...userForm, email: e.target.value })} required className="h-8" /></div>
                  <div><Label className="text-xs">Password</Label><Input type="password" value={userForm.password} onChange={e => setUserForm({ ...userForm, password: e.target.value })} required minLength={6} className="h-8" /></div>
                  <div><Label className="text-xs">Phone</Label><Input value={userForm.phone} onChange={e => setUserForm({ ...userForm, phone: e.target.value })} className="h-8" placeholder="+355..." /></div>
                  <div><Label className="text-xs">Role</Label>
                    <Select value={userForm.role} onValueChange={v => setUserForm({ ...userForm, role: v })}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="tenant">Tenant</SelectItem></SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2 flex gap-2">
                    <Button type="submit" size="sm">Create</Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => setShowCreateUser(false)}>Cancel</Button>
                  </div>
                </form>
              </div>
            )}
            {assignUser && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={e => e.target === e.currentTarget && setAssignUser(null)}>
                <div className="bg-background p-6 rounded-lg shadow-lg max-w-md mx-4 w-full" onClick={e => e.stopPropagation()}>
                  <p className="font-semibold mb-1">Assign {assignUser.name} {assignUser.surname} ({assignUser.role}) to site</p>
                  <p className="text-xs text-muted-foreground mb-4">Manager will assign units from the manager dashboard.</p>
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs">Site</Label>
                      <Select value={assignForm.siteId || "__"} onValueChange={v => setAssignForm({ siteId: v === "__" ? "" : v })}>
                        <SelectTrigger className="w-full mt-1"><SelectValue placeholder="Select site" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__">— Select —</SelectItem>
                          {assignableSites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={submitAssign} disabled={!assignForm.siteId}>Assign</Button>
                      <Button size="sm" variant="outline" onClick={() => setAssignUser(null)}>Cancel</Button>
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
                  <SelectItem value="owner">Owner</SelectItem>
                  <SelectItem value="tenant">Tenant</SelectItem>
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
            <div className="border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
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
                      <td className="px-4 py-2.5 text-muted-foreground">{r.phone || "—"}</td>
                      <td className="px-4 py-2.5"><span className="capitalize">{r.role}</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.site_name}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{r.units.length ? r.units.join(", ") : "—"}</td>
                      <td className="px-4 py-2.5 text-right">
                        {r.site_id === "__unassigned__" && (r.role === "owner" || r.role === "tenant") ? (
                          <div className="flex gap-1 justify-end">
                            <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setAssignUser({ ...r, units: r.units }); setAssignForm({ siteId: "" }); }}>Assign</Button>
                            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => deleteUnassignedUser(r.id)}>Delete</Button>
                          </div>
                        ) : "—"}
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
