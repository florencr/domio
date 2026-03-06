"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminData } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";

export default function AdminSitesPage() {
  const searchParams = useSearchParams();
  const { sites, managers, buildings, load, msg, setMsg } = useAdminData();
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [siteForm, setSiteForm] = useState({ managerId: "", name: "", address: "", vat_account: "", bank_name: "", iban: "", swift_code: "", tax_amount: "" });
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [siteEditForm, setSiteEditForm] = useState({ name: "", address: "", vat_account: "", bank_name: "", iban: "", swift_code: "", tax_amount: "" });

  const managerMap = new Map(managers.map(m => [m.id, m]));
  const buildingsBySite = new Map<string, typeof buildings>();
  buildings.forEach(b => {
    const sid = b.site_id ?? "_none";
    const list = buildingsBySite.get(sid) ?? [];
    list.push(b);
    buildingsBySite.set(sid, list);
  });
  const managersWithoutSite = managers.filter(m => !sites.some(s => s.manager_id === m.id));

  useEffect(() => {
    const editParam = searchParams.get("edit");
    if (editParam) {
      const s = sites.find(x => x.id === editParam);
      if (s) {
        setEditingSiteId(editParam);
        setSiteEditForm({ name: s.name, address: s.address || "", vat_account: s.vat_account || "", bank_name: s.bank_name || "", iban: s.iban || "", swift_code: s.swift_code || "", tax_amount: s.tax_amount != null ? String(s.tax_amount) : "" });
      }
    }
  }, [searchParams, sites]);

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

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Sites</CardTitle>
            <p className="text-sm text-muted-foreground">Property sites. Assign a manager when creating.</p>
          </div>
          <Button onClick={() => { setShowCreateSite(!showCreateSite); setEditingSiteId(null); }} variant={showCreateSite ? "outline" : "default"}>
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
                  <Button variant="outline" size="sm" onClick={() => { setShowCreateSite(false); setEditingSiteId(s.id); setSiteEditForm({ name: s.name, address: s.address || "", vat_account: s.vat_account || "", bank_name: s.bank_name || "", iban: s.iban || "", swift_code: s.swift_code || "", tax_amount: s.tax_amount != null ? String(s.tax_amount) : "" }); }}><Pencil className="size-4 mr-1" />Edit</Button>
                </div>
              );
            })}
          </div>
          {!sites.length && <p className="py-6 text-center text-muted-foreground">No sites yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
