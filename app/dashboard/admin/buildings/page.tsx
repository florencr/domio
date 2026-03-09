"use client";

import { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useAdminData } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Pencil } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function AdminBuildingsPage() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { sites, managers, buildings, load, msg, setMsg } = useAdminData();
  const [showCreateBuilding, setShowCreateBuilding] = useState(false);
  const [buildingForm, setBuildingForm] = useState({ siteId: "", name: "" });
  const [editingBuildingId, setEditingBuildingId] = useState<string | null>(null);
  const [buildingEditForm, setBuildingEditForm] = useState({ name: "" });
  const [filterSiteId, setFilterSiteId] = useState<string>("all");
  const [filterManagerId, setFilterManagerId] = useState<string>("all");

  const siteMap = new Map(sites.map(s => [s.id, s]));
  const filteredBuildings = useMemo(() => {
    return buildings.filter(b => {
      if (filterSiteId !== "all" && b.site_id !== filterSiteId) return false;
      if (filterManagerId !== "all" && b.manager_id !== filterManagerId) return false;
      return true;
    });
  }, [buildings, filterSiteId, filterManagerId]);

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
      setMsg({ text: t(locale, "admin.buildingCreated"), ok: true });
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
      setMsg({ text: t(locale, "admin.buildingUpdated"), ok: true });
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
      setMsg({ text: t(locale, "admin.buildingAssigned"), ok: true });
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
            <CardTitle>{t(locale, "nav.admin.buildings")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t(locale, "admin.buildingsDescription")}</p>
          </div>
          <Button onClick={() => { setShowCreateBuilding(!showCreateBuilding); setEditingBuildingId(null); }} variant={showCreateBuilding ? "outline" : "default"}>
            <Plus className="size-4 mr-1" />{showCreateBuilding ? t(locale, "common.cancel") : t(locale, "admin.createBuilding")}
          </Button>
        </CardHeader>
        <CardContent>
          {showCreateBuilding && (
            <form onSubmit={createBuilding} className="grid gap-3 p-4 border rounded-lg mb-4">
              <div><Label>{t(locale, "common.site")} ({t(locale, "common.optional")})</Label>
                <Select value={buildingForm.siteId || "__none__"} onValueChange={v => setBuildingForm({ ...buildingForm, siteId: v === "__none__" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder={t(locale, "admin.unassigned")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— {t(locale, "admin.unassigned")} —</SelectItem>
                    {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t(locale, "common.name")}</Label><Input value={buildingForm.name} onChange={e => setBuildingForm({ ...buildingForm, name: e.target.value })} placeholder="e.g. Tower A" required /></div>
              <Button type="submit">{t(locale, "admin.createBuilding")}</Button>
            </form>
          )}
          {editingBuildingId && (
            <form onSubmit={updateBuilding} className="grid gap-3 p-4 border rounded-lg mb-4 bg-muted/30">
              <p className="text-sm font-medium">{t(locale, "admin.editBuilding")}</p>
              <div><Label>{t(locale, "common.name")}</Label><Input value={buildingEditForm.name} onChange={e => setBuildingEditForm({ ...buildingEditForm, name: e.target.value })} required /></div>
              <div className="flex gap-2">
                <Button type="submit">{t(locale, "common.save")}</Button>
                <Button type="button" variant="outline" onClick={() => setEditingBuildingId(null)}>{t(locale, "common.cancel")}</Button>
              </div>
            </form>
          )}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">{t(locale, "admin.filterBySite")}</Label>
              <Select value={filterSiteId} onValueChange={setFilterSiteId}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(locale, "admin.allSites")}</SelectItem>
                  <SelectItem value="__none__">— {t(locale, "admin.unassigned")} —</SelectItem>
                  {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">{t(locale, "admin.filterByManager")}</Label>
              <Select value={filterManagerId} onValueChange={setFilterManagerId}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(locale, "common.all")}</SelectItem>
                  {managers.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.name} {m.surname}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "table.building")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "common.site")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "admin.manager")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "common.owner")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "common.action")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredBuildings.map(b => (
                  <tr key={b.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium">{b.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.site_name ?? t(locale, "admin.unassigned")}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.manager_name ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{b.owner_names ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Select value={b.site_id || "__none__"} onValueChange={v => assignBuildingToSite(b.id, v === "__none__" ? null : v)}>
                          <SelectTrigger className="w-[140px] h-8"><SelectValue placeholder={t(locale, "admin.assignSite")} /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">— {t(locale, "admin.unassigned")} —</SelectItem>
                            {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => { setShowCreateBuilding(false); setEditingBuildingId(b.id); setBuildingEditForm({ name: b.name }); }}>
                          <Pencil className="size-3.5" />{t(locale, "common.edit")}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredBuildings.length && <p className="py-6 text-center text-muted-foreground">{t(locale, "admin.noBuildingsYet")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
