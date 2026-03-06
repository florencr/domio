"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerData } from "../../context";

export default function ConfigExpensesPage() {
  const { data, load, loading } = useManagerData();
  const [showCreate, setShowCreate] = useState(false);
  const [f, setF] = useState({ title: "", category: "Misc", vendor: "", amount: "", frequency: "recurrent" });
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editF, setEditF] = useState({ title: "", category: "", vendor: "", amount: "", frequency: "recurrent" });
  const [saving, setSaving] = useState(false);

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const templates = data.expenses.filter(e => e.period_month == null && e.period_year == null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!f.title.trim()) { setMsg({ text: "Title is required", ok: false }); return; }
    const amt = parseFloat(f.amount);
    if (isNaN(amt) || amt <= 0) { setMsg({ text: "Amount must be positive", ok: false }); return; }
    setSaving(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/manager/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: f.title.trim(), category: f.category || "Misc", vendor: f.vendor || "—", amount: amt, frequency: f.frequency }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && j.id) {
      setMsg({ text: "Expense template created.", ok: true });
      setF({ title: "", category: "Misc", vendor: "", amount: "", frequency: "recurrent" });
      setShowCreate(false);
      load();
    } else setMsg({ text: j.error || "Failed", ok: false });
  }

  async function save(id: string) {
    if (!editF.title.trim()) { setMsg({ text: "Title is required", ok: false }); return; }
    const amt = parseFloat(editF.amount);
    if (isNaN(amt) || amt <= 0) { setMsg({ text: "Amount must be positive", ok: false }); return; }
    setSaving(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/manager/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editF.title.trim(), category: editF.category || "Misc", vendor: editF.vendor || "—", amount: amt, frequency: editF.frequency }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && j.success) {
      setMsg({ text: "Updated.", ok: true });
      setEditingId(null);
      load();
    } else setMsg({ text: j.error || "Failed", ok: false });
  }

  async function del(id: string) {
    if (!confirm("Delete this expense template?")) return;
    setSaving(true); setMsg({ text: "", ok: true });
    const res = await fetch(`/api/manager/expenses?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && j.success) {
      setMsg({ text: "Deleted.", ok: true });
      setEditingId(null);
      load();
    } else setMsg({ text: j.error || "Failed", ok: false });
  }

  const categories = [...new Set(data.expenses.map(e => e.category).filter(Boolean))].sort();
  const vendors = [...new Set(data.expenses.map(e => e.vendor).filter(Boolean))].sort();

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4">
          <div>
            <CardTitle>Expense Templates ({templates.length})</CardTitle>
            <p className="text-xs text-muted-foreground mt-1">Recurrent expense templates are copied each month when generating bills. Add templates here or from the Expenses page.</p>
          </div>
          <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}>
            {showCreate ? "Cancel" : "+ Add template"}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}

          {showCreate && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/30 dark:bg-emerald-950/20 p-4">
              <p className="text-sm font-semibold mb-3">Add Expense Template</p>
              <form onSubmit={create} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
                <div><Label className="text-xs">Title</Label><Input value={f.title} onChange={e => setF({ ...f, title: e.target.value })} placeholder="e.g. Building maintenance" required className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Category</Label>
                  <Select value={f.category} onValueChange={v => setF({ ...f, category: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="Misc">Misc</SelectItem>{categories.filter(c => c !== "Misc").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Vendor</Label><Input value={f.vendor} onChange={e => setF({ ...f, vendor: e.target.value })} placeholder="—" className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Amount €</Label><Input type="number" step="0.01" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} required className="h-8 text-sm" placeholder="0.00" /></div>
                <div><Label className="text-xs">Frequency</Label>
                  <Select value={f.frequency} onValueChange={v => setF({ ...f, frequency: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="recurrent">Recurrent</SelectItem><SelectItem value="ad_hoc">Ad-hoc</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="sm:col-span-2 md:col-span-4 flex gap-2">
                  <Button type="submit" size="sm" disabled={saving}>{saving ? "..." : "Create template"}</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </form>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Frequency</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {templates.map(e => {
                  const isEditing = editingId === e.id;
                  return (
                    <tr key={e.id} className={`transition-colors ${isEditing ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/20"}`}>
                      {isEditing ? (
                        <>
                          <td className="px-4 py-2"><Input value={editF.title} onChange={ev => setEditF({ ...editF, title: ev.target.value })} className="h-8 text-sm w-36" /></td>
                          <td className="px-4 py-2">
                            <Select value={editF.category || "Misc"} onValueChange={v => setEditF({ ...editF, category: v })}>
                              <SelectTrigger className="h-8 text-sm w-28"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="Misc">Misc</SelectItem>{categories.filter(c => c !== "Misc").map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2"><Input value={editF.vendor} onChange={ev => setEditF({ ...editF, vendor: ev.target.value })} className="h-8 text-sm w-28" /></td>
                          <td className="px-4 py-2"><Input type="number" step="0.01" value={editF.amount} onChange={ev => setEditF({ ...editF, amount: ev.target.value })} className="h-8 text-sm w-20" /></td>
                          <td className="px-4 py-2">
                            <Select value={editF.frequency} onValueChange={v => setEditF({ ...editF, frequency: v })}>
                              <SelectTrigger className="h-8 text-sm w-28"><SelectValue /></SelectTrigger>
                              <SelectContent><SelectItem value="recurrent">Recurrent</SelectItem><SelectItem value="ad_hoc">Ad-hoc</SelectItem></SelectContent>
                            </Select>
                          </td>
                          <td className="px-4 py-2">
                            <div className="flex gap-1">
                              <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(e.id)} disabled={saving}>Save</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                              <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => del(e.id)} disabled={saving}>Delete</Button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium">{e.title ?? "—"}</td>
                          <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{e.category ?? "—"}</span></td>
                          <td className="px-4 py-3 text-muted-foreground">{e.vendor ?? "—"}</td>
                          <td className="px-4 py-3 text-right font-semibold">{Number(e.amount).toFixed(2)}</td>
                          <td className="px-4 py-3">
                            {e.frequency === "recurrent"
                              ? <span className="text-xs bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 px-2 py-0.5 rounded-full">Recurrent</span>
                              : <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300 px-2 py-0.5 rounded-full">Ad-hoc</span>}
                          </td>
                          <td className="px-4 py-3">
                            <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setEditingId(e.id); setEditF({ title: e.title ?? "", category: e.category ?? "Misc", vendor: e.vendor ?? "", amount: String(e.amount), frequency: e.frequency ?? "recurrent" }); setShowCreate(false); }}>Edit</Button>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
                {!templates.length && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No expense templates yet. Add one above or from the Expenses page.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
