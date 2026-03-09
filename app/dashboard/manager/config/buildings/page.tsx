"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useManagerData } from "../../context";
import type { Building } from "../../types";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function ConfigBuildingsPage() {
  const { data, load } = useManagerData();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [editingBuilding, setEditingBuilding] = useState<Building | null>(null);
  const [editF, setEditF] = useState({ name: "" });

  const sb = createClient();
  const { locale } = useLocale();

  const unitCountMap = new Map<string, Map<string, number>>();
  data.units.forEach(u => {
    if (!unitCountMap.has(u.building_id)) unitCountMap.set(u.building_id, new Map());
    const typeMap = unitCountMap.get(u.building_id)!;
    typeMap.set(u.type, (typeMap.get(u.type) ?? 0) + 1);
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!data.site) { setMsg({ text: t(locale, "configBuildings.noSite"), ok: false }); return; }
    const { error } = await sb.from("buildings").insert({ name: newName, site_id: data.site.id });
    if (!error) { setMsg({ text: t(locale, "configBuildings.buildingCreated"), ok: true }); setNewName(""); setShowCreate(false); load(); }
    else setMsg({ text: error.message, ok: false });
  }

  async function saveEdit() {
    if (!editingBuilding) return;
    const { error } = await sb.from("buildings").update({ name: editF.name }).eq("id", editingBuilding.id);
    if (!error) { setMsg({ text: t(locale, "configBuildings.buildingUpdated"), ok: true }); setEditingBuilding(null); load(); }
    else setMsg({ text: error.message, ok: false });
  }

  async function del(id: string) {
    const { data: units } = await sb.from("units").select("id").eq("building_id", id).limit(1);
    if (units && units.length > 0) { setMsg({ text: t(locale, "configBuildings.cannotDeleteBuildingHasUnits"), ok: false }); return; }
    const { error } = await sb.from("buildings").delete().eq("id", id);
    if (!error) { setMsg({ text: t(locale, "configBuildings.buildingDeleted"), ok: true }); load(); }
    else setMsg({ text: error.message, ok: false });
  }

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
      {data.site?.address && <p className="text-sm text-muted-foreground">{t(locale, "configBuildings.siteAddress")}: {data.site.address}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{t(locale, "configBuildings.buildings")} ({data.buildings.length})</h3>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingBuilding(null); }}>
          {showCreate ? t(locale, "common.cancel") : t(locale, "configBuildings.addBuilding")}
        </Button>
      </div>

      {showCreate && (
        <div className="border border-green-200 bg-green-50/20 dark:bg-green-950/20 dark:border-green-800 rounded-lg p-4">
          <p className="text-base font-semibold mb-3">{t(locale, "configBuildings.addBuildingTitle")}</p>
          <form onSubmit={create} className="flex gap-3 flex-wrap items-end">
            <div><Label>{t(locale, "common.name")}</Label><Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={t(locale, "configBuildings.buildingNamePlaceholder")} required className="w-44" /></div>
            <Button type="submit">{t(locale, "common.create")}</Button>
          </form>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className={`overflow-x-auto ${editingBuilding ? "md:col-span-1" : "md:col-span-2"}`}>
          <table className="w-full min-w-full text-sm table-fixed">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "table.building")}</th>
                {data.unitTypes.map(t => (
                  <th key={t.id} className="px-3 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">{t.name}</th>
                ))}
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.buildings.map(b => {
                const typeMap = unitCountMap.get(b.id);
                const totalUnits = typeMap ? Array.from(typeMap.values()).reduce((s, n) => s + n, 0) : 0;
                const isActive = editingBuilding?.id === b.id;
                return (
                  <tr key={b.id} className={`transition-colors ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/20"}`}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{b.name}</div>
                      <div className="text-xs text-muted-foreground">{totalUnits === 1 ? t(locale, "configBuildings.unitTotal", { count: "1" }) : t(locale, "configBuildings.unitsTotal", { count: String(totalUnits) })}</div>
                    </td>
                    {data.unitTypes.map(t => (
                      <td key={t.id} className="px-3 py-3 text-center">
                        {typeMap?.get(t.name)
                          ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400 text-xs font-bold">{typeMap.get(t.name)}</span>
                          : <span className="text-muted-foreground/30">—</span>}
                      </td>
                    ))}
                    <td className="px-4 py-3">
                      <Button size="sm" variant={isActive ? "default" : "ghost"} className="h-7 px-3 text-xs"
                        onClick={() => { if (isActive) setEditingBuilding(null); else { setEditingBuilding(b); setEditF({ name: b.name }); setShowCreate(false); } }}>
                        {isActive ? t(locale, "common.close") : t(locale, "common.edit")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!data.buildings.length && (
                <tr><td colSpan={2 + data.unitTypes.length} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "configBuildings.noBuildingsYet")}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {editingBuilding && (
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-base font-semibold pb-3 border-b">{editingBuilding.name}</p>
            <div className="space-y-4 pt-4">
              <div><Label className="text-xs">{t(locale, "configBuildings.buildingName")}</Label><Input value={editF.name} onChange={e => setEditF({ ...editF, name: e.target.value })} className="h-8 text-sm mt-1" /></div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={saveEdit}>{t(locale, "common.saveChanges")}</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingBuilding(null)}>{t(locale, "common.cancel")}</Button>
              </div>
              <div className="pt-2 border-t">
                {(() => {
                  const unitCount = Array.from(unitCountMap.get(editingBuilding.id)?.values() ?? []).reduce((s, n) => s + n, 0);
                  return unitCount > 0
                    ? <div className="text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-200 dark:border-amber-800 rounded px-3 py-2">{unitCount === 1 ? t(locale, "configBuildings.cannotDeleteHasUnits", { count: "1" }) : t(locale, "configBuildings.cannotDeleteHasUnitsPlural", { count: String(unitCount) })}</div>
                    : <Button size="sm" variant="destructive" className="w-full" onClick={() => del(editingBuilding.id)}>{t(locale, "configBuildings.deleteBuilding")}</Button>;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
