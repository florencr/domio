"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useManagerData } from "../../context";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function ConfigVendorsPage() {
  const { locale } = useLocale();
  const { data, load, loading } = useManagerData();
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (loading) return <p className="text-muted-foreground">{t(locale, "common.loading")}</p>;

  const expenseCountMap = new Map<string, number>();
  data.expenses.forEach(e => expenseCountMap.set(e.vendor, (expenseCountMap.get(e.vendor) ?? 0) + 1));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/manager/vendors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg({ text: t(locale, "configVendors.vendorCreated"), ok: true }); setNewName(""); load(); }
    else setMsg({ text: j.error ?? r.statusText ?? t(locale, "common.failed"), ok: false });
  }

  async function save(id: string) {
    const r = await fetch("/api/manager/vendors", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: editName }) });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg({ text: "Updated.", ok: true }); setEditingId(null); load(); }
    else setMsg({ text: j.error ?? r.statusText ?? t(locale, "common.failed"), ok: false });
  }

  async function del(id: string, name: string) {
    const count = expenseCountMap.get(name) ?? 0;
    if (count > 0) { setMsg({ text: t(locale, "configVendors.cannotDeleteUsedInExpenses", { count: String(count) }), ok: false }); return; }
    const r = await fetch(`/api/manager/vendors?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const j = await r.json().catch(() => ({}));
    if (r.ok) { setMsg({ text: t(locale, "configExpenses.deleted"), ok: true }); load(); }
    else setMsg({ text: j.error ?? r.statusText ?? t(locale, "common.failed"), ok: false });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>{t(locale, "configVendors.vendors")} ({data.vendors.length})</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t(locale, "configVendors.vendorsDescription")}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
          <form onSubmit={create} className="flex gap-2 items-end">
            <div className="flex-1 max-w-xs"><Label className="text-xs">{t(locale, "configVendors.vendorName")}</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t(locale, "configVendors.vendorNamePlaceholder")} required className="h-8 text-sm" /></div>
            <Button type="submit" size="sm">{t(locale, "common.add")}</Button>
          </form>
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm table-fixed">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "configVendors.vendorName")}</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t(locale, "configVendors.linkedExpenses")}</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">{t(locale, "configVendors.totalAmount")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "configVendors.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.vendors.map(v => {
                  const linked = data.expenses.filter(e => e.vendor === v.name);
                  const total = linked.reduce((s, e) => s + Number(e.amount), 0);
                  const isEditing = editingId === v.id;
                  return (
                    <tr key={v.id} className={`transition-colors ${isEditing ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/20"}`}>
                      <td className="px-4 py-3">
                        {isEditing
                          ? <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm w-52" autoFocus onKeyDown={e => e.key === "Enter" && save(v.id)} />
                          : <span className="font-medium">{v.name}</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {linked.length > 0
                          ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 text-xs font-bold">{linked.length}</span>
                          : <span className="text-muted-foreground/30">0</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {total > 0 ? <span className="text-red-600">{total.toFixed(2)}</span> : <span className="text-muted-foreground/30">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(v.id)}>{t(locale, "common.save")}</Button>
                            <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setEditingId(null)}>{t(locale, "common.cancel")}</Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setEditingId(v.id); setEditName(v.name); }}>{t(locale, "common.edit")}</Button>
                            {linked.length > 0
                              ? <span className="text-xs text-muted-foreground/50 px-2 py-1">{t(locale, "configCategories.inUse")}</span>
                              : <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => del(v.id, v.name)}>{t(locale, "common.delete")}</Button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!data.vendors.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "configVendors.noVendorsYet")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
