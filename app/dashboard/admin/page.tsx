"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User, Pencil, Plus, LayoutGrid, Users, Building2, Home, History, Settings } from "lucide-react";
import { DomioLogo } from "@/components/DomioLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Site = { id: string; name: string; address?: string; manager_id: string; created_at?: string; vat_account?: string | null; bank_name?: string | null; iban?: string | null; swift_code?: string | null; tax_amount?: number | null };
type Profile = { id: string; name: string; surname: string; email: string; role: string; phone?: string | null };
type Building = { id: string; name: string; address?: string; site_id: string | null };

export default function AdminPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [managerForm, setManagerForm] = useState({ name: "", surname: "", email: "", password: "", phone: "", siteName: "", siteAddress: "", vat_account: "", tax_amount: "", bank_name: "", iban: "", swift_code: "" });
  const [siteForm, setSiteForm] = useState({ managerId: "", name: "", address: "", vat_account: "", bank_name: "", iban: "", swift_code: "", tax_amount: "" });
  const [buildingForm, setBuildingForm] = useState({ siteId: "", name: "" });
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [managerEditForm, setManagerEditForm] = useState({ name: "", surname: "", email: "", phone: "", password: "" });
  const [siteEditForm, setSiteEditForm] = useState({ name: "", address: "", vat_account: "", bank_name: "", iban: "", swift_code: "", tax_amount: "" });
  const [buildingEditForm, setBuildingEditForm] = useState({ name: "" });

  const load = async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [profileRes, managersRes, buildingsRes, sitesRes] = await Promise.all([
      sb.from("profiles").select("id,name,surname,email,role,phone").eq("id", user.id).single(),
      fetch("/api/admin/managers").then(r => r.ok ? r.json() : []),
      fetch("/api/admin/buildings").then(r => r.ok ? r.json() : []),
      fetch("/api/admin/sites").then(r => r.ok ? r.json() : []),
    ]);

    let p = profileRes.data as Profile | null;
    if (!p) {
      const apiRes = await fetch("/api/profile");
      if (apiRes.ok) p = (await apiRes.json()) as Profile;
    }
    if (p?.role !== "admin") { router.push("/dashboard"); return; }

    setProfile(p);
    setSites((sitesRes ?? []) as Site[]);
    setManagers((managersRes ?? []) as Profile[]);
    setBuildings((buildingsRes ?? []) as Building[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [router]);

  useEffect(() => {
    if (loading) return;
    const tabParam = searchParams.get("tab");
    const editParam = searchParams.get("edit");
    if (tabParam === "managers" && editParam) {
      setTab("managers");
      const m = managers.find(x => x.id === editParam);
      if (m) {
        setEditingManagerId(editParam);
        setManagerEditForm({ name: m.name, surname: m.surname, email: m.email, phone: m.phone || "", password: "" });
      }
      router.replace("/dashboard/admin?tab=managers", { scroll: false });
    } else if (tabParam === "sites" && editParam) {
      setTab("sites");
      const s = sites.find(x => x.id === editParam);
      if (s) {
        setEditingSiteId(editParam);
        setSiteEditForm({ name: s.name, address: s.address || "", vat_account: s.vat_account || "", bank_name: s.bank_name || "", iban: s.iban || "", swift_code: s.swift_code || "", tax_amount: s.tax_amount != null ? String(s.tax_amount) : "" });
      }
      router.replace("/dashboard/admin?tab=sites", { scroll: false });
    } else if (tabParam === "buildings" && editParam) {
      setTab("buildings");
      const b = buildings.find(x => x.id === editParam);
      if (b) {
        setEditingBuildingId(editParam);
        setBuildingEditForm({ name: b.name });
      }
      router.replace("/dashboard/admin?tab=buildings", { scroll: false });
    } else if (tabParam && ["overview", "managers", "sites", "buildings", "audit", "maintenance"].includes(tabParam)) {
      setTab(tabParam);
    }
  }, [loading, searchParams, managers, sites, buildings, router]);

  function setTabWithUrl(value: string) {
    setTab(value);
    router.replace(`/dashboard/admin?tab=${value}`, { scroll: false });
  }

  async function createManager(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/create-manager", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...managerForm,
        siteName: managerForm.siteName || undefined,
        siteAddress: managerForm.siteAddress || undefined,
        vat_account: managerForm.vat_account || undefined,
        tax_amount: managerForm.tax_amount ? parseFloat(managerForm.tax_amount) : undefined,
        bank_name: managerForm.bank_name || undefined,
        iban: managerForm.iban || undefined,
        swift_code: managerForm.swift_code || undefined,
      }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Manager created.", ok: true });
      setManagerForm({ name: "", surname: "", email: "", password: "", phone: "", siteName: "", siteAddress: "", vat_account: "", tax_amount: "", bank_name: "", iban: "", swift_code: "" });
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
      body: JSON.stringify({
        manager_id: siteForm.managerId,
        name: siteForm.name,
        address: siteForm.address,
        vat_account: siteForm.vat_account || null,
        bank_name: siteForm.bank_name || null,
        iban: siteForm.iban || null,
        swift_code: siteForm.swift_code || null,
        tax_amount: siteForm.tax_amount ? parseFloat(siteForm.tax_amount) : null,
      }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Site created.", ok: true });
      setSiteForm({ managerId: "", name: "", address: "", vat_account: "", bank_name: "", iban: "", swift_code: "", tax_amount: "" });
      setShowCreateSite(false);
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function updateManager(e: React.FormEvent) {
    e.preventDefault();
    if (!editingManagerId) return;
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/managers/${editingManagerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...managerEditForm, password: managerEditForm.password || undefined }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Manager updated.", ok: true });
      setEditingManagerId(null);
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function updateSite(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSiteId) return;
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/sites/${editingSiteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: siteEditForm.name,
        address: siteEditForm.address,
        vat_account: siteEditForm.vat_account || null,
        bank_name: siteEditForm.bank_name || null,
        iban: siteEditForm.iban || null,
        swift_code: siteEditForm.swift_code || null,
        tax_amount: siteEditForm.tax_amount ? parseFloat(siteEditForm.tax_amount) : null,
      }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Site updated.", ok: true });
      setEditingSiteId(null);
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function updateBuilding(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBuildingId) return;
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/buildings/${editingBuildingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: buildingEditForm.name }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Building updated.", ok: true });
      setEditingBuildingId(null);
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
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-auto md:px-3 md:gap-2">
                <User className="size-5 shrink-0" />
                <span className="hidden md:inline truncate max-w-[140px]">{profile?.name} {profile?.surname}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-3 space-y-2">
                <p className="font-semibold">{profile?.name} {profile?.surname}</p>
                <p className="text-sm text-muted-foreground">Role: Admin</p>
                <p className="text-sm text-muted-foreground">Site: All</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="size-4 mr-1" />Logout</Button>
        </div>
      </header>

      <Tabs value={tab} onValueChange={setTabWithUrl} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 max-w-3xl">
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
          <TabsTrigger value="maintenance" className="flex items-center gap-2">
            <Settings className="size-4" />Maintenance
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
                          <Button variant="ghost" size="icon" onClick={() => { setTabWithUrl("sites"); setEditingSiteId(s.id); setSiteEditForm({ name: s.name, address: s.address || "", vat_account: s.vat_account || "", bank_name: s.bank_name || "", iban: s.iban || "", swift_code: s.swift_code || "", tax_amount: s.tax_amount != null ? String(s.tax_amount) : "" }); }} title="Edit site"><Pencil className="size-4" /></Button>
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
                      <td className="py-3"><Button variant="ghost" size="icon" onClick={() => { setTabWithUrl("managers"); setEditingManagerId(m.id); setManagerEditForm({ name: m.name, surname: m.surname, email: m.email, phone: m.phone || "", password: "" }); }} title="Edit manager"><Pencil className="size-4" /></Button></td>
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
              <Button onClick={() => { setShowCreateManager(!showCreateManager); setShowCreateSite(false); setShowCreateBuilding(false); setEditingManagerId(null); }} variant={showCreateManager ? "outline" : "default"}>
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
                  <p className="text-sm font-medium mt-2">Site (auto-created)</p>
                  <div><Label>Site name</Label><Input value={managerForm.siteName} onChange={e => setManagerForm({ ...managerForm, siteName: e.target.value })} placeholder="e.g. Building Complex A" /></div>
                  <div><Label>Site address</Label><Input value={managerForm.siteAddress} onChange={e => setManagerForm({ ...managerForm, siteAddress: e.target.value })} placeholder="e.g. 123 Main St" /></div>
                  <div><Label>VAT account</Label><Input value={managerForm.vat_account} onChange={e => setManagerForm({ ...managerForm, vat_account: e.target.value })} placeholder="e.g. AL123456789L" /></div>
                  <div><Label>Tax amount (%)</Label><Input type="number" step="0.01" min="0" max="100" value={managerForm.tax_amount} onChange={e => setManagerForm({ ...managerForm, tax_amount: e.target.value })} placeholder="e.g. 20 for 20%" /></div>
                  <div><Label>Bank name</Label><Input value={managerForm.bank_name} onChange={e => setManagerForm({ ...managerForm, bank_name: e.target.value })} placeholder="e.g. Alpha Bank" /></div>
                  <div><Label>IBAN</Label><Input value={managerForm.iban} onChange={e => setManagerForm({ ...managerForm, iban: e.target.value })} placeholder="e.g. AL47 2121 1009 0000 0002 3569 8741" /></div>
                  <div><Label>SWIFT code</Label><Input value={managerForm.swift_code} onChange={e => setManagerForm({ ...managerForm, swift_code: e.target.value })} placeholder="e.g. ALBAAFLA" /></div>
                  <Button type="submit">Create Manager</Button>
                </form>
              )}
              {editingManagerId && (
                <form onSubmit={updateManager} className="grid gap-3 p-4 border rounded-lg mb-4 bg-muted/30">
                  <p className="text-sm font-medium">Edit manager</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label>Name</Label><Input value={managerEditForm.name} onChange={e => setManagerEditForm({ ...managerEditForm, name: e.target.value })} required /></div>
                    <div><Label>Surname</Label><Input value={managerEditForm.surname} onChange={e => setManagerEditForm({ ...managerEditForm, surname: e.target.value })} required /></div>
                  </div>
                  <div><Label>Email</Label><Input type="email" value={managerEditForm.email} onChange={e => setManagerEditForm({ ...managerEditForm, email: e.target.value })} required /></div>
                  <div><Label>Phone</Label><Input value={managerEditForm.phone} onChange={e => setManagerEditForm({ ...managerEditForm, phone: e.target.value })} /></div>
                  <div><Label>New password (optional)</Label><Input type="password" value={managerEditForm.password} onChange={e => setManagerEditForm({ ...managerEditForm, password: e.target.value })} placeholder="Leave blank to keep" /></div>
                  <div className="flex gap-2">
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="outline" onClick={() => setEditingManagerId(null)}>Cancel</Button>
                  </div>
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
                      <Button variant="outline" size="sm" onClick={() => { setShowCreateManager(false); setEditingManagerId(m.id); setManagerEditForm({ name: m.name, surname: m.surname, email: m.email, phone: m.phone || "", password: "" }); }}><Pencil className="size-4 mr-1" />Edit</Button>
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
              <Button onClick={() => { setShowCreateSite(!showCreateSite); setShowCreateManager(false); setShowCreateBuilding(false); setEditingSiteId(null); }} variant={showCreateSite ? "outline" : "default"}>
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
                  <div><Label>VAT account</Label><Input value={siteForm.vat_account} onChange={e => setSiteForm({ ...siteForm, vat_account: e.target.value })} placeholder="e.g. AL123456789L" /></div>
                  <div><Label>Tax amount (%)</Label><Input type="number" step="0.01" min="0" max="100" value={siteForm.tax_amount} onChange={e => setSiteForm({ ...siteForm, tax_amount: e.target.value })} placeholder="e.g. 20" /></div>
                  <div><Label>Bank name</Label><Input value={siteForm.bank_name} onChange={e => setSiteForm({ ...siteForm, bank_name: e.target.value })} placeholder="e.g. Alpha Bank" /></div>
                  <div><Label>IBAN</Label><Input value={siteForm.iban} onChange={e => setSiteForm({ ...siteForm, iban: e.target.value })} placeholder="e.g. AL47 2121..." /></div>
                  <div><Label>SWIFT code</Label><Input value={siteForm.swift_code} onChange={e => setSiteForm({ ...siteForm, swift_code: e.target.value })} placeholder="e.g. CRBRSARI" /></div>
                  <Button type="submit" disabled={!siteForm.managerId || !managersWithoutSite.length}>Create Site</Button>
                  {!managersWithoutSite.length && <p className="text-xs text-amber-600">All managers have sites. Create a new manager first.</p>}
                </form>
              )}
              {editingSiteId && (
                <form onSubmit={updateSite} className="grid gap-3 p-4 border rounded-lg mb-4 bg-muted/30">
                  <p className="text-sm font-medium">Edit site</p>
                  <div><Label>Site name</Label><Input value={siteEditForm.name} onChange={e => setSiteEditForm({ ...siteEditForm, name: e.target.value })} required /></div>
                  <div><Label>Address</Label><Input value={siteEditForm.address} onChange={e => setSiteEditForm({ ...siteEditForm, address: e.target.value })} placeholder="e.g. 123 Main St" /></div>
                  <div><Label>VAT account</Label><Input value={siteEditForm.vat_account} onChange={e => setSiteEditForm({ ...siteEditForm, vat_account: e.target.value })} placeholder="e.g. AL123456789L" /></div>
                  <div><Label>Tax amount (%)</Label><Input type="number" step="0.01" min="0" max="100" value={siteEditForm.tax_amount} onChange={e => setSiteEditForm({ ...siteEditForm, tax_amount: e.target.value })} placeholder="e.g. 20" /></div>
                  <div><Label>Bank name</Label><Input value={siteEditForm.bank_name} onChange={e => setSiteEditForm({ ...siteEditForm, bank_name: e.target.value })} placeholder="e.g. Alpha Bank" /></div>
                  <div><Label>IBAN</Label><Input value={siteEditForm.iban} onChange={e => setSiteEditForm({ ...siteEditForm, iban: e.target.value })} placeholder="e.g. AL47 2121..." /></div>
                  <div><Label>SWIFT code</Label><Input value={siteEditForm.swift_code} onChange={e => setSiteEditForm({ ...siteEditForm, swift_code: e.target.value })} placeholder="e.g. CRBRSARI" /></div>
                  <div className="flex gap-2">
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="outline" onClick={() => setEditingSiteId(null)}>Cancel</Button>
                  </div>
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
                      <Button variant="outline" size="sm" onClick={() => { setShowCreateSite(false); setTabWithUrl("sites"); setEditingSiteId(s.id); setSiteEditForm({ name: s.name, address: s.address || "", vat_account: s.vat_account || "", bank_name: s.bank_name || "", iban: s.iban || "", swift_code: s.swift_code || "", tax_amount: s.tax_amount != null ? String(s.tax_amount) : "" }); }}><Pencil className="size-4 mr-1" />Edit</Button>
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
              {editingBuildingId && (
                <form onSubmit={updateBuilding} className="grid gap-3 p-4 border rounded-lg mb-4 bg-muted/30">
                  <p className="text-sm font-medium">Edit building</p>
                  <div><Label>Building name</Label><Input value={buildingEditForm.name} onChange={e => setBuildingEditForm({ ...buildingEditForm, name: e.target.value })} required /></div>
                  <div className="flex gap-2">
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="outline" onClick={() => setEditingBuildingId(null)}>Cancel</Button>
                  </div>
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
                        <Button variant="outline" size="sm" onClick={() => { setShowCreateBuilding(false); setTabWithUrl("buildings"); setEditingBuildingId(b.id); setBuildingEditForm({ name: b.name }); }}><Pencil className="size-4 mr-1" />Edit</Button>
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

        <TabsContent value="maintenance">
          <MaintenanceTab load={load} sites={sites} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MaintenanceTab({ load, sites }: { load: () => void; sites: Site[] }) {
  const [deleteLocksEnabled, setDeleteLocksEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearExpensesConfirm, setShowClearExpensesConfirm] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch("/api/admin/maintenance", { signal: controller.signal })
      .then(r => r.ok ? r.json() : { deleteLocksEnabled: true })
      .then((j: { deleteLocksEnabled?: boolean }) => { setDeleteLocksEnabled(j.deleteLocksEnabled ?? true); setLoading(false); })
      .catch(() => { setDeleteLocksEnabled(true); setLoading(false); })
      .finally(() => clearTimeout(timer));
  }, []);

  async function toggleLocks() {
    setActionLoading(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", enabled: !deleteLocksEnabled }),
    });
    const j = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (res.ok && j.success) {
      setDeleteLocksEnabled(j.enabled ?? !deleteLocksEnabled);
      setMsg({ text: `Delete locks ${j.enabled ? "enabled" : "disabled"}.`, ok: true });
    } else {
      setMsg({ text: j.error || "Failed", ok: false });
    }
  }

  async function clearData() {
    setShowClearConfirm(false);
    if (!selectedSiteId) return;
    setActionLoading(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear", siteId: selectedSiteId }),
    });
    const j = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (res.ok && j.success) {
      setMsg({ text: "Site data cleared. Users kept.", ok: true });
      setSelectedSiteId("");
      load();
    } else {
      setMsg({ text: j.error || "Failed", ok: false });
    }
  }

  async function clearExpenses() {
    setShowClearExpensesConfirm(false);
    if (!selectedSiteId) return;
    setActionLoading(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clearExpenses", siteId: selectedSiteId }),
    });
    const j = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (res.ok && j.success) {
      setMsg({ text: "Expenses cleared for site.", ok: true });
      load();
    } else {
      setMsg({ text: j.error || "Failed", ok: false });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Maintenance</CardTitle>
        <p className="text-sm text-muted-foreground">Toggle delete locks for bills/expenses and clear dummy data. Keeps user accounts.</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

        <div className="space-y-2">
          <p className="font-medium text-sm">Delete locks (bills & expenses)</p>
          <p className="text-xs text-muted-foreground">When enabled, only current and previous month can be deleted. Disable to clear old data.</p>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">{deleteLocksEnabled ? "Enabled" : "Disabled"}</span>
              <Button variant="outline" size="sm" onClick={toggleLocks} disabled={actionLoading}>
                {actionLoading ? "..." : deleteLocksEnabled ? "Disable" : "Enable"}
              </Button>
            </div>
          )}
        </div>

        <div className="space-y-2 pt-4 border-t">
          <p className="font-medium text-sm">Clear expense dummy data</p>
          <p className="text-xs text-muted-foreground">Deletes only expenses for the selected site. Keeps bills, buildings, units, and users.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedSiteId || "__none__"} onValueChange={v => setSelectedSiteId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Choose site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Choose site —</SelectItem>
                {sites.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowClearExpensesConfirm(true)}
              disabled={actionLoading || !selectedSiteId || sites.length === 0}
            >
              Clear expenses
            </Button>
          </div>
        </div>

        <div className="space-y-2 pt-4 border-t">
          <p className="font-medium text-sm">Clear site data</p>
          <p className="text-xs text-muted-foreground">Deletes one site and its buildings, units, bills, expenses, etc. Keeps profiles (users).</p>
          <div className="flex flex-wrap items-center gap-2">
            <Select value={selectedSiteId || "__none__"} onValueChange={v => setSelectedSiteId(v === "__none__" ? "" : v)}>
              <SelectTrigger className="w-[220px]">
                <SelectValue placeholder="Choose site" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Choose site —</SelectItem>
                {sites.map(s => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowClearConfirm(true)}
              disabled={actionLoading || !selectedSiteId || sites.length === 0}
            >
              Clear site data
            </Button>
          </div>
        </div>

        {showClearExpensesConfirm && selectedSiteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background p-6 rounded-lg shadow-lg max-w-md mx-4">
              <p className="font-semibold mb-2">Clear expenses for this site?</p>
              <p className="text-sm text-muted-foreground mb-4">This will delete all expenses for the selected site. Bills, buildings, units, and users will be kept.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowClearExpensesConfirm(false)}>Cancel</Button>
                <Button variant="destructive" onClick={clearExpenses} disabled={actionLoading}>{actionLoading ? "Clearing..." : "Yes, clear expenses"}</Button>
              </div>
            </div>
          </div>
        )}

        {showClearConfirm && selectedSiteId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-background p-6 rounded-lg shadow-lg max-w-md mx-4">
              <p className="font-semibold mb-2">Clear site data?</p>
              <p className="text-sm text-muted-foreground mb-4">This will delete the selected site and all its buildings, units, bills, expenses, documents, and config. User accounts will be kept.</p>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                <Button variant="destructive" onClick={clearData} disabled={actionLoading}>{actionLoading ? "Clearing..." : "Yes, clear"}</Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
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
