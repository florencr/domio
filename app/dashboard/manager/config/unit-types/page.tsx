"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useManagerData } from "../../context";

export default function ConfigUnitTypesPage() {
  const { data, load, loading } = useManagerData();
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const countMap = new Map<string, number>();
  data.units.forEach(u => countMap.set(u.type, (countMap.get(u.type) ?? 0) + 1));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch("/api/manager/unit-types", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: newName }) });
    const body = await r.json();
    if (r.ok) {
      setMsg({ text: "Unit type created.", ok: true });
      setNewName("");
      load();
    } else {
      setMsg({ text: body.error || r.statusText, ok: false });
    }
  }

  async function save(id: string) {
    const r = await fetch("/api/manager/unit-types", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, name: editName }) });
    const body = await r.json();
    if (r.ok) {
      setMsg({ text: "Updated.", ok: true });
      setEditingId(null);
      load();
    } else {
      setMsg({ text: body.error || r.statusText, ok: false });
    }
  }

  async function del(id: string, typeName: string) {
    const count = countMap.get(typeName) ?? 0;
    if (count > 0) {
      setMsg({ text: `Cannot delete — ${count} unit${count !== 1 ? "s" : ""} use this type.`, ok: false });
      return;
    }
    const r = await fetch(`/api/manager/unit-types?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    const body = await r.json();
    if (r.ok) {
      setMsg({ text: "Deleted.", ok: true });
      load();
    } else {
      setMsg({ text: body.error || r.statusText, ok: false });
    }
  }

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader>
          <CardTitle>Unit Types ({data.unitTypes.length})</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Unit types are used to categorize units and link services to billing.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}

          <form onSubmit={create} className="flex gap-2 items-end">
            <div className="flex-1 max-w-xs">
              <Label className="text-xs">New Type Name</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. Apartment, Parking, Garden" required className="h-8 text-sm mt-1" />
            </div>
            <Button type="submit" size="sm">Add</Button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type Name</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Units Assigned</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Used in Services</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.unitTypes.map(t => {
                  const unitCount = countMap.get(t.name) ?? 0;
                  const serviceCount = data.services.filter(s => s.unit_type === t.name).length;
                  const inUse = unitCount > 0 || serviceCount > 0;
                  const isEditing = editingId === t.id;
                  return (
                    <tr key={t.id} className={`transition-colors ${isEditing ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-muted/20"}`}>
                      <td className="px-4 py-3">
                        {isEditing
                          ? <Input value={editName} onChange={e => setEditName(e.target.value)} className="h-8 text-sm w-48" autoFocus onKeyDown={e => e.key === "Enter" && save(t.id)} />
                          : <span className="font-medium">{t.name}</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {unitCount > 0
                          ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400 text-xs font-bold">{unitCount}</span>
                          : <span className="text-muted-foreground/30">0</span>}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {serviceCount > 0
                          ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400 text-xs font-bold">{serviceCount}</span>
                          : <span className="text-muted-foreground/30">0</span>}
                      </td>
                      <td className="px-4 py-3">
                        {isEditing ? (
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(t.id)}>Save</Button>
                            <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setEditingId(t.id); setEditName(t.name); }}>Edit</Button>
                            {inUse
                              ? <span className="text-xs text-muted-foreground/50 px-2 py-1">In use</span>
                              : <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30" onClick={() => del(t.id, t.name)}>Delete</Button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {!data.unitTypes.length && (
                  <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No unit types yet. Add one above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
