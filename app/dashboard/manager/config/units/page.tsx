"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useManagerData } from "../../context";
import type { Unit } from "../../types";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function ConfigUnitsPage() {
  const { data, load } = useManagerData();
  const [showCreate, setShowCreate] = useState(false);
  const [f, setF] = useState({ buildingId: "", name: "", type: "", size: "", entrance: "", floor: "", ownerId: "none", tenantId: "none" });
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [editF, setEditF] = useState({ buildingId: "", name: "", type: "", size: "", entrance: "", floor: "", ownerId: "none", tenantId: "none" });
  const [filterBuilding, setFilterBuilding] = useState("all");

  const sb = createClient();
  const { locale } = useLocale();
  const buildingMap = new Map(data.buildings.map(b => [b.id, b.name]));
  const ownerMap = new Map(data.unitOwners.map(uo => [uo.unit_id, uo.owner_id]));
  const tenantMap = new Map(data.unitTenantAssignments.map(a => [a.unit_id, a.tenant_id]));
  const profileMap = new Map(data.profiles.map(p => [p.id, p]));

  const filteredUnits = filterBuilding === "all"
    ? data.units
    : data.units.filter(u => u.building_id === filterBuilding);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { data: inserted, error } = await sb.from("units").insert({
      building_id: f.buildingId,
      unit_name: f.name,
      type: f.type,
      size_m2: f.size ? parseFloat(f.size) : null,
      entrance: f.entrance || null,
      floor: f.floor || null,
    }).select("id").single();
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    if (inserted?.id && ((f.ownerId && f.ownerId !== "none") || (f.tenantId && f.tenantId !== "none"))) {
      const res = await fetch("/api/manager/assign-unit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          unitId: inserted.id,
          ownerId: f.ownerId && f.ownerId !== "none" ? f.ownerId : null,
          tenantId: f.tenantId && f.tenantId !== "none" ? f.tenantId : null,
        }),
      });
      const j = await res.json();
      if (!res.ok) { setMsg({ text: j.error || t(locale, "configUnits.failedToAssign"), ok: false }); return; }
    }
    if (inserted?.id) {
      fetch("/api/manager/log-audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", entity_type: "unit", entity_id: inserted.id, entity_label: f.name, new_values: { unit_name: f.name, type: f.type, building_id: f.buildingId } }),
      }).catch(() => {});
    }
    setMsg({ text: t(locale, "configUnits.unitCreated"), ok: true });
    setF({ buildingId: "", name: "", type: "", size: "", entrance: "", floor: "", ownerId: "none", tenantId: "none" });
    setShowCreate(false);
    load();
  }

  async function saveEdit() {
    if (!editingUnit) return;
    const { error } = await sb.from("units").update({
      building_id: editF.buildingId,
      unit_name: editF.name,
      type: editF.type,
      size_m2: editF.size ? parseFloat(editF.size) : null,
      entrance: editF.entrance || null,
      floor: editF.floor || null,
    }).eq("id", editingUnit.id);
    if (error) { setMsg({ text: error.message, ok: false }); return; }
    const res = await fetch("/api/manager/assign-unit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        unitId: editingUnit.id,
        ownerId: editF.ownerId && editF.ownerId !== "none" ? editF.ownerId : null,
        tenantId: editF.tenantId && editF.tenantId !== "none" ? editF.tenantId : null,
      }),
    });
    const j = await res.json();
    if (!res.ok) { setMsg({ text: j.error || "Failed to assign owner/tenant", ok: false }); return; }
    fetch("/api/manager/log-audit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "update", entity_type: "unit", entity_id: editingUnit.id, entity_label: editF.name, new_values: { unit_name: editF.name, type: editF.type } }),
    }).catch(() => {});
    setMsg({ text: t(locale, "configUnits.unitUpdated"), ok: true });
    setEditingUnit(null);
    load();
  }

  async function del(id: string) {
    const unit = data.units.find(u => u.id === id);
    const { error } = await sb.from("units").delete().eq("id", id);
    if (!error) {
      if (unit) {
        fetch("/api/manager/log-audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete", entity_type: "unit", entity_id: id, entity_label: unit.unit_name }),
        }).catch(() => {});
      }
      setMsg({ text: t(locale, "configUnits.unitDeleted"), ok: true });
      setEditingUnit(null);
      load();
    } else setMsg({ text: error.message, ok: false });
  }

  const assignableProfiles = data.profiles
    .filter((p) => p.role !== "manager" && p.role !== "admin")
    .sort((a, b) => `${a.surname} ${a.name}`.localeCompare(`${b.surname} ${b.name}`));
  const ownersForCreate = assignableProfiles.filter((p) => p.id !== (f.tenantId !== "none" ? f.tenantId : ""));
  const tenantsForCreate = assignableProfiles.filter((p) => p.id !== (f.ownerId !== "none" ? f.ownerId : ""));
  const ownersForEdit = assignableProfiles.filter((p) => p.id !== (editF.tenantId !== "none" ? editF.tenantId : ""));
  const tenantsForEdit = assignableProfiles.filter((p) => p.id !== (editF.ownerId !== "none" ? editF.ownerId : ""));

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t(locale, "configUnits.units")} ({filteredUnits.length})</h3>
          <Select value={filterBuilding} onValueChange={setFilterBuilding}>
            <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t(locale, "configUnits.allBuildings")}</SelectItem>
              {data.buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingUnit(null); }}>
          {showCreate ? t(locale, "common.cancel") : t(locale, "configUnits.addUnit")}
        </Button>
      </div>

      {showCreate && (
        <div className="border border-green-200 bg-green-50/20 dark:bg-green-950/20 dark:border-green-800 rounded-lg p-4">
          <p className="text-base font-semibold mb-3">{t(locale, "configUnits.addUnitTitle")}</p>
          <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
            <div><Label className="text-xs">{t(locale, "configUnits.building")}</Label>
              <Select value={f.buildingId} onValueChange={v => setF({ ...f, buildingId: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t(locale, "configUnits.selectBuilding")} /></SelectTrigger>
                <SelectContent>{data.buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t(locale, "configUnits.unitName")}</Label><Input value={f.name} onChange={e => setF({ ...f, name: e.target.value })} placeholder="AP-101" required className="h-8 text-sm" /></div>
            <div><Label className="text-xs">{t(locale, "configUnits.unitType")}</Label>
              <Select value={f.type} onValueChange={v => setF({ ...f, type: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t(locale, "configUnits.selectType")} /></SelectTrigger>
                <SelectContent>{data.unitTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">{t(locale, "configUnits.sizeM2")}</Label><Input type="number" step="0.01" value={f.size} onChange={e => setF({ ...f, size: e.target.value })} className="h-8 text-sm" placeholder="e.g. 75" /></div>
            <div><Label className="text-xs">{t(locale, "configUnits.entrance")}</Label><Input value={f.entrance} onChange={e => setF({ ...f, entrance: e.target.value })} className="h-8 text-sm" placeholder="e.g. A" /></div>
            <div><Label className="text-xs">{t(locale, "configUnits.floor")}</Label><Input value={f.floor} onChange={e => setF({ ...f, floor: e.target.value })} className="h-8 text-sm" placeholder="e.g. 3" /></div>
            <div className="col-span-2 md:col-span-1"><Label className="text-xs">{t(locale, "configUnits.owner")}</Label>
              <Select value={f.ownerId} onValueChange={v => setF({ ...f, ownerId: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t(locale, "configUnits.selectOwner")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t(locale, "configUnits.noOwner")}</SelectItem>
                  {ownersForCreate.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {p.surname} ({p.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-1"><Label className="text-xs">Tenant (optional)</Label>
              <Select value={f.tenantId} onValueChange={v => setF({ ...f, tenantId: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select tenant" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— No tenant —</SelectItem>
                  {tenantsForCreate.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {p.surname} ({p.email})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 md:col-span-3 flex gap-2">
              <Button type="submit" size="sm" disabled={!f.buildingId || !f.type}>{t(locale, "configUnits.createUnit")}</Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        <div className={`overflow-x-auto ${editingUnit ? "md:col-span-1" : "md:col-span-2"}`}>
          <table className="w-full min-w-full text-sm table-fixed">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "table.unit")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "configUnits.building")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "configUnits.unitType")}</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t(locale, "table.sizeM2")}</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t(locale, "configUnits.entr")}</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">{t(locale, "configUnits.floor")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "configUnits.owner")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "configUnits.tenant")}</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "table.action")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredUnits.map(u => {
                const ownerId = ownerMap.get(u.id);
                const owner = ownerId ? profileMap.get(ownerId) : null;
                const tenantId = tenantMap.get(u.id);
                const tenant = tenantId ? profileMap.get(tenantId) : null;
                const isActive = editingUnit?.id === u.id;
                return (
                  <tr key={u.id} className={`transition-colors ${isActive ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/20"}`}>
                    <td className="px-4 py-3 font-semibold">{u.unit_name}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{buildingMap.get(u.building_id) ?? "—"}</td>
                    <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{u.type}</span></td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{u.size_m2 ?? <span className="text-muted-foreground/30">—</span>}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{u.entrance ?? <span className="text-muted-foreground/30">—</span>}</td>
                    <td className="px-4 py-3 text-center text-muted-foreground">{u.floor ?? <span className="text-muted-foreground/30">—</span>}</td>
                    <td className="px-4 py-3">{owner ? <span className="text-sm">{owner.name} {owner.surname}</span> : <span className="text-xs text-muted-foreground/50">{t(locale, "configUnits.noOwnerLabel")}</span>}</td>
                    <td className="px-4 py-3">{tenant ? <span className="text-sm">{tenant.name} {tenant.surname}</span> : <span className="text-xs text-muted-foreground/50">—</span>}</td>
                    <td className="px-4 py-3">
                      <Button size="sm" variant={isActive ? "default" : "ghost"} className="h-7 px-3 text-xs"
                        onClick={() => {
                          if (isActive) setEditingUnit(null);
                          else {
                            const oid = ownerMap.get(u.id);
                            const tid = tenantMap.get(u.id);
                            setEditingUnit(u);
                            setEditF({
                              buildingId: u.building_id,
                              name: u.unit_name,
                              type: u.type,
                              size: u.size_m2?.toString() ?? "",
                              entrance: u.entrance ?? "",
                              floor: u.floor ?? "",
                              ownerId: oid ?? "none",
                              tenantId: tid ?? "none",
                            });
                            setShowCreate(false);
                          }
                        }}>
                        {isActive ? t(locale, "common.close") : t(locale, "common.edit")}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!filteredUnits.length && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">{t(locale, "configUnits.noUnitsYet")}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {editingUnit && (
          <div className="border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-base font-semibold pb-3 border-b">{editingUnit.unit_name} · {buildingMap.get(editingUnit.building_id)}</p>
            <div className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Label className="text-xs">{t(locale, "configUnits.building")}</Label>
                  <Select value={editF.buildingId} onValueChange={v => setEditF({ ...editF, buildingId: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{data.buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{t(locale, "configUnits.unitName")}</Label><Input value={editF.name} onChange={e => setEditF({ ...editF, name: e.target.value })} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">{t(locale, "configUnits.unitType")}</Label>
                  <Select value={editF.type} onValueChange={v => setEditF({ ...editF, type: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{data.unitTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{t(locale, "configUnits.sizeM2")}</Label><Input type="number" step="0.01" value={editF.size} onChange={e => setEditF({ ...editF, size: e.target.value })} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">{t(locale, "configUnits.entrance")}</Label><Input value={editF.entrance} onChange={e => setEditF({ ...editF, entrance: e.target.value })} className="h-8 text-sm" placeholder="e.g. A" /></div>
                <div className="col-span-2"><Label className="text-xs">{t(locale, "configUnits.floor")}</Label><Input value={editF.floor} onChange={e => setEditF({ ...editF, floor: e.target.value })} className="h-8 text-sm" placeholder="e.g. 3" /></div>
                <div className="col-span-2"><Label className="text-xs">{t(locale, "configUnits.owner")}</Label>
                  <Select value={editF.ownerId} onValueChange={v => setEditF({ ...editF, ownerId: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder={t(locale, "configUnits.selectOwner")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t(locale, "configUnits.noOwner")}</SelectItem>
                      {ownersForEdit.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {p.surname} ({p.email})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Tenant (optional)</Label>
                  <Select value={editF.tenantId} onValueChange={v => setEditF({ ...editF, tenantId: v })}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select tenant" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No tenant —</SelectItem>
                      {tenantsForEdit.map(p => <SelectItem key={p.id} value={p.id}>{p.name} {p.surname} ({p.email})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={saveEdit}>{t(locale, "common.saveChanges")}</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingUnit(null)}>{t(locale, "common.cancel")}</Button>
              </div>
              <div className="pt-2 border-t">
                <Button size="sm" variant="destructive" className="w-full" onClick={() => del(editingUnit.id)}>{t(locale, "configUnits.deleteUnit")}</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
