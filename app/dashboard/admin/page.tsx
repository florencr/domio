"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User, Pencil, Plus, LayoutGrid, Users, Building2, Home, History } from "lucide-react";
import { DomioLogo } from "@/components/DomioLogo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Site = { id: string; name: string; address?: string; manager_id: string; created_at: string };
type Profile = { id: string; name: string; surname: string; email: string; role: string; phone?: string | null };
type Building = { id: string; name: string; site_id: string | null };

export default function AdminPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("overview");
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });

  const [showCreateManager, setShowCreateManager] = useState(false);
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [showCreateBuilding, setShowCreateBuilding] = useState(false);
  const [managerForm, setManagerForm] = useState({ name: "", surname: "", email: "", password: "", phone: "", siteName: "", siteAddress: "" });
  const [siteForm, setSiteForm] = useState({ managerId: "", name: "", address: "" });
  const [buildingForm, setBuildingForm] = useState({ siteId: "", name: "" });

  const load = async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [profileRes, managersRes, buildingsRes, sitesRes] = await Promise.all([
      sb.from("profiles").select("id,name,surname,email,role,phone").eq("id", user.id).single(),
      sb.from("profiles").select("id,name,surname,email,role,phone").eq("role", "manager"),
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
      body: JSON.stringify({ ...managerForm, siteName: managerForm.siteName || undefined, siteAddress: managerForm.siteAddress || undefined }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Manager created.", ok: true });
      setManagerForm({ name: "", surname: "", email: "", password: "", phone: "", siteName: "", siteAddress: "" });
      setShowCreateManager(false);
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

  async function createBuilding(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: (buildingForm.siteId && buildingForm.siteId !== "__none__") ? buildingForm.siteId : null, name: buildingForm.name }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Building created.", ok: true });
      setBuildingForm({ siteId: "", name: "" });
      setShowCreateBuilding(false);
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function assignSiteToManager(siteId: string, managerId: string) {
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manager_id: managerId }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Site assigned to manager.", ok: true });
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function assignBuildingToSite(buildingId: string, siteId: string | null) {
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/buildings/${buildingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: siteId || null }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Building assigned to site.", ok: true });
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
  const siteMap = new Map(sites.map(s => [s.id, s]));
  const managersWithoutSite = managers.filter(m => !sites.some(s => s.manager_id === m.id));
  const buildingsBySite = new Map<string, Building[]>();
  buildings.forEach(b => {
    const sid = b.site_id ?? "_none";
    const list = buildingsBySite.get(sid) ?? [];
    list.push(b);
    buildingsBySite.set(sid, list);
  });
  const unassignedBuildings = buildings.filter(b => !b.site_id);

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
              <Button variant="ghost" className="h-9 w-auto md:px-3 md:gap-2">
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

      <Tabs value={tab} onValueChange={setTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 max-w-2xl">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <LayoutGrid className="size-4" />Overview
          </TabsTrigger>
          <TabsTrigger value="managers" className="flex items-center gap-2">
            <Users className="size-4" />Managers
          </TabsTrigger>
          <TabsTrigger value="sites" className="flex items-center gap-2">
            <Building2 className="size-4" />Sites
          </TabsTrigger>
          <TabsTrigger value="buildings" className="flex items-center gap-2">
            <Home className="size-4" />Buildings
          </TabsTrigger>
          <TabsTrigger value="audit" className="flex items-center gap-2">
            <History className="size-4" />Audit
          </TabsTrigger>
        </TabsList>

        {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Sites Overview</CardTitle>
              <p className="text-sm text-muted-foreground">Sites with address, buildings, and assigned manager. Use the tabs to create and connect.</p>
            </CardHeader>
            <CardContent>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left font-medium">Site</th>
                    <th className="py-2 text-left font-medium">Address</th>
                    <th className="py-2 text-left font-medium">Manager</th>
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
                        <td className="py-3 font-medium">{s.name}</td>
                        <td className="py-3 text-muted-foreground">{s.address || "—"}</td>
                        <td className="py-3">{m ? `${m.name} ${m.surname}` : (
                          <Select onValueChange={(v) => assignSiteToManager(s.id, v)}>
                            <SelectTrigger className="w-[180px] h-8 text-amber-600 border-amber-200">
                              <SelectValue placeholder="Assign manager" />
                            </SelectTrigger>
                            <SelectContent>
                              {managers.map(mgr => <SelectItem key={mgr.id} value={mgr.id}>{mgr.name} {mgr.surname}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        )}</td>
                        <td className="py-3">
                          {siteBuildings.length ? (
                            <ul className="text-xs space-y-1">
                              {siteBuildings.map(b => <li key={b.id}>{b.name}</li>)}
                            </ul>
                          ) : "—"}
                        </td>
                        <td className="py-3">
                          {m && <Link href={`/dashboard/admin/managers/${s.manager_id}`}><Button variant="ghost" size="icon"><Pencil className="size-4" /></Button></Link>}
                        </td>
                      </tr>
                    );
                  })}
                  {managersWithoutSite.map(m => (
                    <tr key={m.id} className="border-b align-top bg-amber-50/50">
                      <td className="py-3 text-amber-700">No site</td>
                      <td className="py-3">—</td>
                      <td className="py-3">{m.name} {m.surname}</td>
                      <td className="py-3">—</td>
                      <td className="py-3"><Link href={`/dashboard/admin/managers/${m.id}`}><Button variant="ghost" size="icon"><Pencil className="size-4" /></Button></Link></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {unassignedBuildings.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm font-medium text-muted-foreground mb-2">Unassigned buildings</p>
                  <div className="flex flex-wrap gap-2">
                    {unassignedBuildings.map(b => (
                      <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-sm">
                        <span>{b.name}</span>
                        <Select onValueChange={(v) => assignBuildingToSite(b.id, v)}>
                          <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue placeholder="Assign to site" /></SelectTrigger>
                          <SelectContent>
                            {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!sites.length && !managers.length && <p className="py-6 text-center text-muted-foreground">No data yet. Create managers, sites, and buildings in the tabs above.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="managers" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Managers</CardTitle>
                <p className="text-sm text-muted-foreground">User profiles with manager role. Each can have one site.</p>
              </div>
              <Button onClick={() => { setShowCreateManager(!showCreateManager); setShowCreateSite(false); setShowCreateBuilding(false); }} variant={showCreateManager ? "outline" : "default"}>
                <Plus className="size-4 mr-1" />{showCreateManager ? "Cancel" : "Create Manager"}
              </Button>
            </CardHeader>
            <CardContent>
              {showCreateManager && (
                <form onSubmit={createManager} className="grid gap-3 p-4 border rounded-lg mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Name</Label><Input value={managerForm.name} onChange={e => setManagerForm({ ...managerForm, name: e.target.value })} required /></div>
                    <div><Label>Surname</Label><Input value={managerForm.surname} onChange={e => setManagerForm({ ...managerForm, surname: e.target.value })} required /></div>
                  </div>
                  <div><Label>Email</Label><Input type="email" value={managerForm.email} onChange={e => setManagerForm({ ...managerForm, email: e.target.value })} required /></div>
                  <div><Label>Password</Label><Input type="password" value={managerForm.password} onChange={e => setManagerForm({ ...managerForm, password: e.target.value })} required minLength={6} /></div>
                  <div><Label>Phone (optional)</Label><Input value={managerForm.phone} onChange={e => setManagerForm({ ...managerForm, phone: e.target.value })} /></div>
                  <div><Label>Site name (optional)</Label><Input value={managerForm.siteName} onChange={e => setManagerForm({ ...managerForm, siteName: e.target.value })} placeholder="Auto-created with manager" /></div>
                  <div><Label>Site address (optional)</Label><Input value={managerForm.siteAddress} onChange={e => setManagerForm({ ...managerForm, siteAddress: e.target.value })} /></div>
                  <Button type="submit">Create Manager</Button>
                </form>
              )}
              <div className="space-y-2">
                {managers.map(m => {
                  const site = sites.find(s => s.manager_id === m.id);
                  return (
                    <div key={m.id} className="flex items-center justify-between py-2 px-3 rounded-lg border bg-card">
                      <div>
                        <p className="font-medium">{m.name} {m.surname}</p>
                        <p className="text-sm text-muted-foreground">{m.email}</p>
                        {m.phone && <p className="text-xs text-muted-foreground">{m.phone}</p>}
                        {site && <p className="text-xs text-green-600 mt-1">Site: {site.name}</p>}
                        {!site && <p className="text-xs text-amber-600 mt-1">No site assigned</p>}
                      </div>
                      <Link href={`/dashboard/admin/managers/${m.id}`}><Button variant="outline" size="sm"><Pencil className="size-4 mr-1" />Edit</Button></Link>
                    </div>
                  );
                })}
              </div>
              {!managers.length && <p className="py-6 text-center text-muted-foreground">No managers yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sites" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Sites</CardTitle>
                <p className="text-sm text-muted-foreground">Property sites. Assign a manager when creating.</p>
              </div>
              <Button onClick={() => { setShowCreateSite(!showCreateSite); setShowCreateManager(false); setShowCreateBuilding(false); }} variant={showCreateSite ? "outline" : "default"}>
                <Plus className="size-4 mr-1" />{showCreateSite ? "Cancel" : "Create Site"}
              </Button>
            </CardHeader>
            <CardContent>
              {showCreateSite && (
                <form onSubmit={createSite} className="grid gap-3 p-4 border rounded-lg mb-4">
                  <div><Label>Manager</Label>
                    <Select value={siteForm.managerId} onValueChange={v => setSiteForm({ ...siteForm, managerId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger>
                      <SelectContent>
                        {managersWithoutSite.map(m => <SelectItem key={m.id} value={m.id}>{m.name} {m.surname} ({m.email})</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Site name</Label><Input value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="e.g. Building Complex A" required /></div>
                  <div><Label>Address</Label><Input value={siteForm.address} onChange={e => setSiteForm({ ...siteForm, address: e.target.value })} placeholder="e.g. 123 Main St" /></div>
                  <Button type="submit" disabled={!siteForm.managerId || !managersWithoutSite.length}>Create Site</Button>
                  {!managersWithoutSite.length && <p className="text-xs text-amber-600">All managers have sites. Create a new manager first.</p>}
                </form>
              )}
              <div className="space-y-2">
                {sites.map(s => {
                  const m = managerMap.get(s.manager_id);
                  const siteBuildings = buildingsBySite.get(s.id) ?? [];
                  return (
                    <div key={s.id} className="flex items-center justify-between py-2 px-3 rounded-lg border bg-card">
                      <div>
                        <p className="font-medium">{s.name}</p>
                        <p className="text-sm text-muted-foreground">{s.address || "—"}</p>
                        <p className="text-xs text-muted-foreground mt-1">Manager: {m ? `${m.name} ${m.surname}` : "—"}</p>
                        {siteBuildings.length > 0 && <p className="text-xs text-muted-foreground">Buildings: {siteBuildings.map(b => b.name).join(", ")}</p>}
                      </div>
                      {m && <Link href={`/dashboard/admin/managers/${m.id}`}><Button variant="outline" size="sm"><Pencil className="size-4 mr-1" />Edit</Button></Link>}
                    </div>
                  );
                })}
              </div>
              {!sites.length && <p className="py-6 text-center text-muted-foreground">No sites yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="buildings" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Buildings</CardTitle>
                <p className="text-sm text-muted-foreground">Buildings belong to sites. Create and assign later if needed.</p>
              </div>
              <Button onClick={() => { setShowCreateBuilding(!showCreateBuilding); setShowCreateManager(false); setShowCreateSite(false); }} variant={showCreateBuilding ? "outline" : "default"}>
                <Plus className="size-4 mr-1" />{showCreateBuilding ? "Cancel" : "Create Building"}
              </Button>
            </CardHeader>
            <CardContent>
              {showCreateBuilding && (
                <form onSubmit={createBuilding} className="grid gap-3 p-4 border rounded-lg mb-4">
                  <div><Label>Site (optional)</Label>
                    <Select value={buildingForm.siteId || "__none__"} onValueChange={v => setBuildingForm({ ...buildingForm, siteId: v === "__none__" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Leave unassigned" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Unassigned —</SelectItem>
                        {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label>Building name</Label><Input value={buildingForm.name} onChange={e => setBuildingForm({ ...buildingForm, name: e.target.value })} placeholder="e.g. Tower A" required /></div>
                  <Button type="submit">Create Building</Button>
                </form>
              )}
              <div className="space-y-2">
                {buildings.map(b => {
                  const site = b.site_id ? siteMap.get(b.site_id) : null;
                  return (
                    <div key={b.id} className="flex items-center justify-between py-2 px-3 rounded-lg border bg-card">
                      <div>
                        <p className="font-medium">{b.name}</p>
                        <p className="text-sm text-muted-foreground">{site ? `Site: ${site.name}` : "Unassigned"}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Select value={b.site_id || "__none__"} onValueChange={v => assignBuildingToSite(b.id, v === "__none__" ? null : v)}>
                          <SelectTrigger className="w-[160px] h-8"><SelectValue placeholder="Assign site" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— Unassigned —</SelectItem>
                            {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Link href={`/dashboard/admin/managers/${site?.manager_id}`}><Button variant="ghost" size="icon" disabled={!site}><Pencil className="size-4" /></Button></Link>
                      </div>
                    </div>
                  );
                })}
              </div>
              {!buildings.length && <p className="py-6 text-center text-muted-foreground">No buildings yet.</p>}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit">
          <AuditTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AuditTab() {
  const [entries, setEntries] = useState<{ id: string; created_at: string; user_email: string | null; action: string; entity_type: string; entity_id: string | null; entity_label: string | null; old_values: unknown; new_values: unknown }[]>([]);
  const [loading, setLoading] = useState(true);
  const [entityType, setEntityType] = useState("all");

  useEffect(() => {
    let u = "/api/admin/audit-log?limit=100";
    if (entityType !== "all") u += "&entityType=" + entityType;
    fetch(u)
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(j => { setEntries(j.entries ?? []); setLoading(false); });
  }, [entityType]);

  const formatDate = (d: string) => new Date(d).toLocaleString();
  const formatChange = (oldV: unknown, newV: unknown, action: string) => {
    if (action === "create" && newV) return JSON.stringify(newV);
    if (action === "delete" && oldV) return "was: " + JSON.stringify(oldV);
    if (oldV && newV) return "→ " + JSON.stringify(newV);
    return "";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Audit Log</CardTitle>
          <p className="text-sm text-muted-foreground">Who changed what and when.</p>
        </div>
        <Select value={entityType} onValueChange={setEntityType}>
          <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="site">Sites</SelectItem>
            <SelectItem value="building">Buildings</SelectItem>
            <SelectItem value="manager">Managers</SelectItem>
            <SelectItem value="bill">Bills</SelectItem>
            <SelectItem value="expense">Expenses</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!loading && (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {entries.map(e => (
              <div key={e.id} className="text-sm py-2 px-3 rounded border bg-muted/30">
                <span className="text-muted-foreground">{formatDate(e.created_at)}</span>
                {" · "}
                <span className="font-medium">{e.user_email ?? "system"}</span>
                {" "}
                <span className="text-amber-600">{e.action}</span>
                {" "}
                <span>{e.entity_type}</span>
                {e.entity_label && <span className="text-muted-foreground"> ({e.entity_label})</span>}
                {formatChange(e.old_values, e.new_values, e.action) && <p className="text-xs mt-1 text-muted-foreground truncate">{formatChange(e.old_values, e.new_values, e.action)}</p>}
              </div>
            ))}
          </div>
        )}
        {!loading && !entries.length && <p className="py-6 text-center text-muted-foreground">No audit entries yet.</p>}
      </CardContent>
    </Card>
  );
}
