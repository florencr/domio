"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Plus, Pencil, Trash2 } from "lucide-react";
import { DomioLogo } from "@/components/DomioLogo";

type Profile = { id: string; name: string; surname: string; email: string; phone?: string | null };
type Site = { id: string; name: string; address?: string; vat_account?: string | null; manager_id: string };
type Building = { id: string; name: string; site_id: string | null };

export default function EditManagerPage() {
  const router = useRouter();
  const params = useParams();
  const managerId = params?.id as string;
  const [manager, setManager] = useState<Profile | null>(null);
  const [site, setSite] = useState<Site | null>(null);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });

  const [managerForm, setManagerForm] = useState({ name: "", surname: "", email: "", phone: "", password: "" });
  const [siteForm, setSiteForm] = useState({ name: "", address: "", vat_account: "" });
  const [buildingForm, setBuildingForm] = useState({ name: "", address: "" });
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);

  const load = async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: myProfile } = await sb.from("profiles").select("role").eq("id", user.id).single();
    if (myProfile?.role !== "admin") { router.push("/dashboard"); return; }

    const [managerRes, sitesRes] = await Promise.all([
      sb.from("profiles").select("id,name,surname,email,phone").eq("id", managerId).eq("role", "manager").single(),
      fetch("/api/admin/sites").then(r => r.ok ? r.json() : []),
    ]);

    const m = managerRes.data as Profile | null;
    if (!m) { setMsg({ text: "Manager not found", ok: false }); setLoading(false); return; }

    const allSites = (sitesRes ?? []) as Site[];
    const s = allSites.find((st: Site) => st.manager_id === managerId) ?? null;
    let siteBuildings: Building[] = [];
    if (s) {
      const buildingsRes = await sb.from("buildings").select("id,name,site_id").eq("site_id", s.id);
      siteBuildings = (buildingsRes.data ?? []) as Building[];
    }

    setManager(m);
    setSite(s);
    setBuildings(siteBuildings);
    setManagerForm({ name: m.name, surname: m.surname, email: m.email, phone: m.phone || "", password: "" });
    setSiteForm({ name: s?.name || "", address: s?.address || "", vat_account: s?.vat_account || "" });
    setLoading(false);
  };

  useEffect(() => { if (managerId) load(); }, [managerId]);

  async function saveManager(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/managers/${managerId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...managerForm, password: managerForm.password || undefined }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Manager updated.", ok: true });
      setManagerForm(f => ({ ...f, password: "" }));
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
      body: JSON.stringify({ manager_id: managerId, name: siteForm.name, address: siteForm.address, vat_account: siteForm.vat_account || null }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Site created.", ok: true });
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function updateSite(e: React.FormEvent) {
    e.preventDefault();
    if (!site) return;
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/sites/${site.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: siteForm.name, address: siteForm.address, vat_account: siteForm.vat_account || null }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Site updated.", ok: true });
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function addBuilding(e: React.FormEvent) {
    e.preventDefault();
    if (!site) return;
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/buildings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site_id: site.id, name: buildingForm.name }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Building added.", ok: true });
      setBuildingForm({ name: "", address: "" });
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function updateBuilding(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBuilding) return;
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/buildings/${editingBuilding.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: buildingForm.name }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Building updated.", ok: true });
      setEditingBuilding(null);
      setBuildingForm({ name: "", address: "" });
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function deleteBuilding(id: string) {
    if (!confirm("Delete this building? Units and related data will be affected.")) return;
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/buildings/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Building deleted.", ok: true });
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;
  if (!manager) return <div className="min-h-screen flex items-center justify-center"><p className="text-red-600">Manager not found</p></div>;

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <Link href="/dashboard/admin" className="flex items-center gap-2">
          <DomioLogo className="h-9 w-auto" />
          <span className="text-xs text-muted-foreground">Administrator</span>
        </Link>
        <Link href="/dashboard/admin">
          <Button variant="outline" size="sm"><ArrowLeft className="size-4 mr-1" />Back</Button>
        </Link>
      </header>

      <div className="max-w-2xl space-y-4">
        {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

        <Card>
          <CardHeader><CardTitle>Edit Manager</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={saveManager} className="grid gap-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Name</Label><Input value={managerForm.name} onChange={e => setManagerForm({ ...managerForm, name: e.target.value })} required /></div>
                <div><Label>Surname</Label><Input value={managerForm.surname} onChange={e => setManagerForm({ ...managerForm, surname: e.target.value })} required /></div>
              </div>
              <div><Label>Email</Label><Input type="email" value={managerForm.email} onChange={e => setManagerForm({ ...managerForm, email: e.target.value })} required /></div>
              <div><Label>Phone</Label><Input value={managerForm.phone} onChange={e => setManagerForm({ ...managerForm, phone: e.target.value })} /></div>
              <div><Label>New password (optional)</Label><Input type="password" value={managerForm.password} onChange={e => setManagerForm({ ...managerForm, password: e.target.value })} placeholder="Leave blank to keep current" /></div>
              <Button type="submit">Save Manager</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Site</CardTitle><p className="text-sm text-muted-foreground">One site per manager. Create or edit it here.</p></CardHeader>
          <CardContent>
            {site ? (
              <form onSubmit={updateSite} className="grid gap-3">
                <div><Label>Site name</Label><Input value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} required /></div>
                <div><Label>Address</Label><Input value={siteForm.address} onChange={e => setSiteForm({ ...siteForm, address: e.target.value })} placeholder="e.g. 123 Main St" /></div>
                <div><Label>VAT account</Label><Input value={siteForm.vat_account} onChange={e => setSiteForm({ ...siteForm, vat_account: e.target.value })} placeholder="e.g. AL123456789L" /></div>
                <Button type="submit">Update Site</Button>
              </form>
            ) : (
              <form onSubmit={createSite} className="grid gap-3">
                <div><Label>Site name</Label><Input value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} placeholder="e.g. Building Complex A" required /></div>
                <div><Label>Address</Label><Input value={siteForm.address} onChange={e => setSiteForm({ ...siteForm, address: e.target.value })} placeholder="e.g. 123 Main St" /></div>
                <div><Label>VAT account</Label><Input value={siteForm.vat_account} onChange={e => setSiteForm({ ...siteForm, vat_account: e.target.value })} placeholder="e.g. AL123456789L" /></div>
                <Button type="submit">Create Site</Button>
              </form>
            )}
          </CardContent>
        </Card>

        {site && (
          <Card>
            <CardHeader><CardTitle>Buildings</CardTitle><p className="text-sm text-muted-foreground">Add buildings to this site.</p></CardHeader>
            <CardContent className="space-y-4">
              {editingBuilding ? (
                <form onSubmit={updateBuilding} className="grid gap-3 p-3 border rounded-lg">
                  <p className="text-sm font-medium">Edit: {editingBuilding.name}</p>
                  <div><Label>Name</Label><Input value={buildingForm.name} onChange={e => setBuildingForm({ ...buildingForm, name: e.target.value })} required /></div>
                  <div><Label>Address</Label><Input value={buildingForm.address} onChange={e => setBuildingForm({ ...buildingForm, address: e.target.value })} required /></div>
                  <div className="flex gap-2">
                    <Button type="submit">Save</Button>
                    <Button type="button" variant="outline" onClick={() => { setEditingBuilding(null); setBuildingForm({ name: "", address: "" }); }}>Cancel</Button>
                  </div>
                </form>
              ) : (
                <form onSubmit={addBuilding} className="grid gap-3 p-3 border rounded-lg">
                  <div><Label>Building name</Label><Input value={buildingForm.name} onChange={e => setBuildingForm({ ...buildingForm, name: e.target.value })} placeholder="Building A" required /></div>
                  <div><Label>Address</Label><Input value={buildingForm.address} onChange={e => setBuildingForm({ ...buildingForm, address: e.target.value })} placeholder="123 Main St" required /></div>
                  <Button type="submit"><Plus className="size-4 mr-1" />Add Building</Button>
                </form>
              )}

              {buildings.length > 0 ? (
                <ul className="space-y-2">
                  {buildings.map(b => (
                    <li key={b.id} className="flex items-center justify-between py-2 border-b">
                      <div><span className="font-medium">{b.name}</span></div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => { setEditingBuilding(b); setBuildingForm({ name: b.name, address: "" }); }}><Pencil className="size-4" /></Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteBuilding(b.id)}><Trash2 className="size-4 text-red-600" /></Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">No buildings yet. Add one above.</p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
