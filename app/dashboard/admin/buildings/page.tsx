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

export default function AdminBuildingsPage() {
  const searchParams = useSearchParams();
  const { sites, buildings, load, msg, setMsg } = useAdminData();
  const [showCreateBuilding, setShowCreateBuilding] = useState(false);
  const [buildingForm, setBuildingForm] = useState({ siteId: "", name: "" });
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [buildingEditForm, setBuildingEditForm] = useState({ name: "" });

  const siteMap = new Map(sites.map(s => [s.id, s]));

  useEffect(() => {
    const editParam = searchParams.get("edit");
    if (editParam) {
      const b = buildings.find(x => x.id === editParam);
      if (b) {
        setEditingBuildingId(editParam);
        setBuildingEditForm({ name: b.name });
      }
    }
  }, [searchParams, buildings]);

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

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Buildings</CardTitle>
            <p className="text-sm text-muted-foreground">Buildings belong to sites. Create and assign later if needed.</p>
          </div>
          <Button onClick={() => { setShowCreateBuilding(!showCreateBuilding); setEditingBuildingId(null); }} variant={showCreateBuilding ? "outline" : "default"}>
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
                    <Button variant="outline" size="sm" onClick={() => { setShowCreateBuilding(false); setEditingBuildingId(b.id); setBuildingEditForm({ name: b.name }); }}><Pencil className="size-4 mr-1" />Edit</Button>
                  </div>
                </div>
              );
            })}
          </div>
          {!buildings.length && <p className="py-6 text-center text-muted-foreground">No buildings yet.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
