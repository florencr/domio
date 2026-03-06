"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerData } from "../../context";
import type { Service } from "../../types";

export default function ConfigServicesPage() {
  const { data, load, loading } = useManagerData();
  const [showCreate, setShowCreate] = useState(false);
  const [f, setF] = useState({ name: "", unitType: "", category: "", pricing: "fixed_per_unit", price: "", freq: "recurrent" });
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editF, setEditF] = useState({ name: "", unitType: "", category: "", pricing: "fixed_per_unit", price: "", freq: "recurrent" });

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/manager/services", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: f.name, unit_type: f.unitType, category: f.category || null, pricing_model: f.pricing, price_value: parseFloat(f.price) || 0, frequency: f.freq }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) {
      setMsg({ text: "Service created.", ok: true });
      setF({ name: "", unitType: "", category: "", pricing: "fixed_per_unit", price: "", freq: "recurrent" });
      setShowCreate(false);
      load();
    } else setMsg({ text: j.error || "Failed", ok: false });
  }

  async function save(id: string) {
    const res = await fetch("/api/manager/services", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, name: editF.name, unit_type: editF.unitType, category: editF.category || null, pricing_model: editF.pricing, price_value: parseFloat(editF.price) || 0, frequency: editF.freq }),
    });
    const j = await res.json().catch(() => ({}));
    if (res.ok && !j.error) {
      setMsg({ text: "Updated.", ok: true });
      setEditingId(null);
      load();
    } else setMsg({ text: j.error || "Failed", ok: false });
  }

  async function del(id: string) {
    const res = await fetch(`/api/manager/services?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.success) {
      setMsg({ text: "Deleted.", ok: true });
      load();
    } else setMsg({ text: j.error || "Failed", ok: false });
  }

  const pricingLabel = (m: string) => (m === "per_m2" ? "Per m²" : "Fixed/unit");

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Services ({data.services.length})</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Services define what gets billed per unit. Link each service to a unit type.</p>
          </div>
          <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}>
            {showCreate ? "Cancel" : "+ Add service"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}

          {showCreate && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20 p-4">
              <p className="text-sm font-semibold mb-3">Add Service</p>
              <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 items-end">
                <div><Label className="text-xs">Service Name</Label><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="e.g. Maintenance" required className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Category</Label>
                  <Select value={f.category || "none"} onValueChange={v => setF({ ...f, category: v === "none" ? "" : v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select category" /></SelectTrigger>
                    <SelectContent><SelectItem value="none">— None —</SelectItem>{data.serviceCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Unit Type</Label>
                  <Select value={f.unitType} onValueChange={v => setF({ ...f, unitType: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select type" /></SelectTrigger>
                    <SelectContent>{data.unitTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Pricing Model</Label>
                  <Select value={f.pricing} onValueChange={v => setF({ ...f, pricing: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="fixed_per_unit">Fixed per unit</SelectItem><SelectItem value="per_m2">Per m²</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Price Value</Label><Input type="number" step="0.01" value={f.price} onChange={e => setF({ ...f, price: e.target.value })} required className="h-8 text-sm" placeholder="0.00" /></div>
                <div><Label className="text-xs">Frequency</Label>
                  <Select value={f.freq} onValueChange={v => setF({ ...f, freq: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="recurrent">Recurrent</SelectItem><SelectItem value="one_time">One-time</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 md:col-span-3 flex gap-2">
                  <Button type="submit" size="sm" disabled={!f.unitType}>Create service</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unit Type</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pricing</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Frequency</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.services.map(s => {
                  const isEditing = editingId === s.id;
                  return (
                    <tr key={s.id} className={`transition-colors ${isEditing ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/20"}`}>
                      {isEditing ? (
                        <>
                          <td className="px-4 py-2"><Input value={editF.name} onChange={e => setEditF({ ...editF, name: e.target.value })} className="h-8 text-sm w-36" /></td>
                          <td className="px-4 py-2">
                            <Select value={editF.category || "none"} onValueChange={v => setEditF({ ...editF, category: v === "none" ? "" : v })}>
                              <SelectTrigger className="h-8 text-sm w-32"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="none">— None —</SelectItem>{data.serviceCategories.map(c => <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <Select value={editF.unitType} onValueChange={v => setEditF({ ...editF, unitType: v })}>
                              <SelectTrigger className="h-8 text-sm w-28"><SelectValue /></SelectTrigger>
                              <SelectContent>{data.unitTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <Select value={editF.pricing} onValueChange={v => setEditF({ ...editF, pricing: v })}>
                              <SelectTrigger className="h-8 text-sm w-32"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="fixed_per_unit">Fixed/unit</SelectItem><SelectItem value="per_m2">Per m²</SelectItem></SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2"><Input type="number" step="0.01" value={editF.price} onChange={e => setEditF({ ...editF, price: e.target.value })} className="h-8 text-sm w-20" /></td>
                          <td className="px-4 py-2">
                            <Select value={editF.freq} onValueChange={v => setEditF({ ...editF, freq: v })}>
                              <SelectTrigger className="h-8 text-sm w-28"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="recurrent">Recurrent</SelectItem><SelectItem value="one_time">One-time</SelectItem></SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(s.id)}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => del(s.id)}>Delete</Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium">{s.name}</td>
                          <td className="px-4 py-3">
                            {(s as Service & { category?: string }).category
                              ? <span className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 px-2 py-0.5 rounded-full">{(s as Service & { category?: string }).category}</span>
                              : <span className="text-muted-foreground/40">—</span>}
                          </td>
                          <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{s.unit_type}</span></td>
                          <td className="px-4 py-3 text-muted-foreground text-xs">{pricingLabel(s.pricing_model)}</td>
                          <td className="px-4 py-3 text-right font-semibold">{Number(s.price_value).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            {s.frequency === "recurrent"
                              ? <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full">Recurrent</span>
                              : <span className="text-xs bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 px-2 py-0.5 rounded-full">One-time</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setEditingId(s.id); setEditF({ name: s.name, unitType: s.unit_type, category: (s as Service & { category?: string }).category ?? "", pricing: s.pricing_model, price: s.price_value.toString(), freq: s.frequency }); setShowCreate(false); }}>Edit</Button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {!data.services.length && (
                  <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No services yet. Add one above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
