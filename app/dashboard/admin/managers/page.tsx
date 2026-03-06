"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminData } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Pencil } from "lucide-react";

export default function AdminManagersPage() {
  const searchParams = useSearchParams();
  const { sites, managers, load, msg, setMsg } = useAdminData();
  const [showCreateManager, setShowCreateManager] = useState(false);
  const [managerForm, setManagerForm] = useState({ name: "", surname: "", email: "", password: "", phone: "", siteName: "", siteAddress: "", vat_account: "", tax_amount: "", bank_name: "", iban: "", swift_code: "" });
  const [editingManagerId, setEditingManagerId] = useState<string | null>(null);
  const [managerEditForm, setManagerEditForm] = useState({ name: "", surname: "", email: "", phone: "", password: "" });

  useEffect(() => {
    const editParam = searchParams.get("edit");
    if (editParam) {
      const m = managers.find(x => x.id === editParam);
      if (m) {
        setEditingManagerId(editParam);
        setManagerEditForm({ name: m.name, surname: m.surname, email: m.email, phone: m.phone || "", password: "" });
      }
    }
  }, [searchParams, managers]);

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

  const managersWithoutSite = managers.filter(m => !sites.some(s => s.manager_id === m.id));

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Managers</CardTitle>
            <p className="text-sm text-muted-foreground">User profiles with manager role. Each can have one site.</p>
          </div>
          <Button onClick={() => { setShowCreateManager(!showCreateManager); setEditingManagerId(null); }} variant={showCreateManager ? "outline" : "default"}>
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
    </div>
  );
}
