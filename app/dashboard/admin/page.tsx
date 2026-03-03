"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogOut, User, Pencil } from "lucide-react";
import { DomioLogo } from "@/components/DomioLogo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type Site = { id: string; name: string; address?: string; manager_id: string; created_at: string };
type Profile = { id: string; name: string; surname: string; email: string; role: string };
type Building = { id: string; name: string; site_id: string | null };

export default function AdminPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [form, setForm] = useState({ name: "", surname: "", email: "", password: "", phone: "", siteName: "", siteAddress: "" });
  const [siteForm, setSiteForm] = useState({ managerId: "", name: "", address: "" });
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });

  const load = async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [profileRes, managersRes, buildingsRes, sitesRes] = await Promise.all([
      sb.from("profiles").select("id,name,surname,email,role").eq("id", user.id).single(),
      sb.from("profiles").select("id,name,surname,email,role").eq("role", "manager"),
      sb.from("buildings").select("id,name,site_id"),
      fetch("/api/admin/sites").then(r => r.ok ? r.json() : []),
    ]);

    const p = profileRes.data as Profile | null;
    if (p?.role !== "admin") { router.push("/dashboard"); return; }

    setProfile(p);
    setSites((sitesRes ?? []) as Site[]);
    setManagers((managersRes.data ?? []) as Profile[]);
    setBuildings((buildingsRes.data ?? []) as Building[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [router]);

  async function createManager(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/create-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, siteName: form.siteName || undefined, siteAddress: form.siteAddress || undefined }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Manager created. They can now sign in.", ok: true });
      setForm({ name: "", surname: "", email: "", password: "", phone: "", siteName: "", siteAddress: "" });
      setShowCreate(false);
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function createSite(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manager_id: siteForm.managerId, name: siteForm.name, address: siteForm.address }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Site created.", ok: true });
      setSiteForm({ managerId: "", name: "", address: "" });
      setShowCreateSite(false);
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  const managerMap = new Map(managers.map(m => [m.id, m]));
  const managersWithoutSite = managers.filter(m => !sites.some(s => s.manager_id === m.id));
  const buildingsBySite = new Map<string, Building[]>();
  buildings.forEach(b => {
    const sid = b.site_id ?? "_none";
    const list = buildingsBySite.get(sid) ?? [];
    list.push(b);
    buildingsBySite.set(sid, list);
  });

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <Link href="/dashboard/admin" className="flex items-center gap-2">
          <DomioLogo className="h-9 w-auto" />
          <span className="text-xs text-muted-foreground">Administrator</span>
        </Link>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 md:w-auto md:px-3 md:gap-2">
                <User className="size-5 shrink-0" />
                <span className="hidden md:inline truncate max-w-[140px]">{profile?.name} {profile?.surname}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-3">
                <p className="font-semibold">{profile?.name} {profile?.surname}</p>
                <p className="text-sm text-muted-foreground">Role: Admin</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="size-4 mr-1" />Logout</Button>
        </div>
      </header>

      <div className="w-full space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Sites & Managers</CardTitle>
            <p className="text-sm text-muted-foreground">Each manager has their own site. Create managers to add new sites.</p>
          </CardHeader>
          <CardContent>
            {msg.text && <p className={`text-sm mb-4 ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
            <div className="flex flex-wrap gap-2 mb-4">
              <Button onClick={() => { setShowCreate(!showCreate); setShowCreateSite(false); }} variant={showCreate ? "outline" : "default"}>{showCreate ? "Cancel" : "+ Create Manager"}</Button>
              <Button onClick={() => { setShowCreateSite(!showCreateSite); setShowCreate(false); }} variant={showCreateSite ? "outline" : "default"}>{showCreateSite ? "Cancel" : "+ Create Site"}</Button>
            </div>

            {showCreateSite && managersWithoutSite.length > 0 && (
              <Card className="border-2 border-dashed mb-4">
                <CardHeader><CardTitle className="text-base">New Site</CardTitle><p className="text-sm text-muted-foreground">Assign a site to a manager who doesn&apos;t have one.</p></CardHeader>
                <CardContent>
                  <form onSubmit={createSite} className="grid gap-3">
                    <div><Label>Manager</Label><select className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm" value={siteForm.managerId} onChange={e => setSiteForm({ ...siteForm, managerId: e.target.value })} required>
                      <option value="">Select manager</option>
                      {managersWithoutSite.map(m => <option key={m.id} value={m.id}>{m.name} {m.surname} ({m.email})</option>)}
                    </select></div>
                    <div><Label>Site name</Label><Input value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="e.g. Building Complex A" required /></div>
                    <div><Label>Address</Label><Input value={siteForm.address} onChange={e => setSiteForm({ ...siteForm, address: e.target.value })} placeholder="e.g. 123 Main St" /></div>
                    <Button type="submit">Create Site</Button>
                  </form>
                </CardContent>
              </Card>
            )}
            {showCreateSite && managersWithoutSite.length === 0 && <p className="text-sm text-muted-foreground mb-4">All managers already have a site.</p>}

            {showCreate && (
              <Card className="border-2 border-dashed mb-4">
                <CardHeader><CardTitle className="text-base">New Manager</CardTitle></CardHeader>
                <CardContent>
                  <form onSubmit={createManager} className="grid gap-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required /></div>
                      <div><Label>Surname</Label><Input value={form.surname} onChange={e => setForm({ ...form, surname: e.target.value })} required /></div>
                    </div>
                    <div><Label>Email</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required /></div>
                    <div><Label>Password</Label><Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required minLength={6} /></div>
                    <div><Label>Phone (optional)</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
                    <div><Label>Site name (optional)</Label><Input value={form.siteName} onChange={e => setForm({ ...form, siteName: e.target.value })} placeholder="e.g. Building Complex A" /></div>
                    <div><Label>Site address (optional)</Label><Input value={form.siteAddress} onChange={e => setForm({ ...form, siteAddress: e.target.value })} placeholder="e.g. 123 Main St" /></div>
                    <Button type="submit">Create Manager</Button>
                  </form>
                </CardContent>
              </Card>
            )}

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 text-left font-medium">Site</th>
                  <th className="py-2 text-left font-medium">Address</th>
                  <th className="py-2 text-left font-medium">Manager</th>
                  <th className="py-2 text-left font-medium">Email</th>
                  <th className="py-2 text-left font-medium">Buildings</th>
                  <th className="py-2 text-left font-medium w-12"></th>
                </tr>
              </thead>
              <tbody>
                {sites.map(s => {
                  const m = managerMap.get(s.manager_id);
                  const siteBuildings = buildingsBySite.get(s.id) ?? [];
                  return (
                    <tr key={s.id} className="border-b align-top">
                      <td className="py-3">{s.name}</td>
                      <td className="py-3 text-muted-foreground text-xs">{s.address || "—"}</td>
                      <td className="py-3">{m ? `${m.name} ${m.surname}` : "—"}</td>
                      <td className="py-3 text-muted-foreground">{m?.email ?? "—"}</td>
                      <td className="py-3">
                        {siteBuildings.length ? (
                          <ul className="text-xs space-y-1">
                            {siteBuildings.map(b => (
                              <li key={b.id}><span className="font-medium">{b.name}</span></li>
                            ))}
                          </ul>
                        ) : "—"}
                      </td>
                      <td className="py-3">
                        {m && <Link href={`/dashboard/admin/managers/${s.manager_id}`}><Button variant="ghost" size="icon"><Pencil className="size-4" /></Button></Link>}
                      </td>
                    </tr>
                  );
                })}
                {/* Show managers without a site (pre-migration or orphaned) */}
                {managersWithoutSite.map(m => (
                  <tr key={m.id} className="border-b align-top bg-amber-50/50">
                    <td className="py-3 text-amber-700">No site</td>
                    <td className="py-3">—</td>
                    <td className="py-3">{m.name} {m.surname}</td>
                    <td className="py-3 text-muted-foreground">{m.email}</td>
                    <td className="py-3">—</td>
                    <td className="py-3"><Link href={`/dashboard/admin/managers/${m.id}`}><Button variant="ghost" size="icon"><Pencil className="size-4" /></Button></Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!sites.length && !managers.length && <p className="py-6 text-center text-muted-foreground">No sites yet. Create a manager to add one.</p>}
            {!sites.length && managers.length > 0 && (
              <p className="py-4 text-center text-amber-600 text-sm">Managers exist but no sites. Click &quot;Create Site&quot; above or run migrations in Supabase SQL Editor.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
