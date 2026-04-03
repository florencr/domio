"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOwnerData } from "../context";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function OwnerUnitsPage() {
  const { data, assignTenant, removeTenant, setPaymentResponsible } = useOwnerData();
  const { locale } = useLocale();
  const [unitsSortCol, setUnitsSortCol] = useState<string | null>(null);
  const [unitsSortDir, setUnitsSortDir] = useState<"asc" | "desc">("asc");

  const { units, buildings, sites, unitTenantAssignments, unitOwnerProfiles, tenants, ownerUnitIds } = data;
  const ownerUnitIdSet = new Set(ownerUnitIds ?? []);
  const ownerByUnitId = new Map(unitOwnerProfiles.map((o) => [o.unit_id, o]));
  const buildingMap = new Map(buildings.map(b => [b.id, b.name]));
  const siteMap = new Map(sites.map(s => [s.id, s.name]));
  const getSiteName = (buildingId: string) => {
    const building = buildings.find(b => b.id === buildingId);
    if (!building?.site_id) return "";
    return siteMap.get(building.site_id) ?? "";
  };
  const tenantMap = new Map(tenants.map(t => [t.id, t]));
  const unitTenantsMap = new Map<string, { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }[]>();
  unitTenantAssignments.forEach(a => {
    const list = unitTenantsMap.get(a.unit_id) ?? [];
    list.push(a);
    unitTenantsMap.set(a.unit_id, list);
  });
  const [addResponsibleForPayment, setAddResponsibleForPayment] = useState(true);
  const [assignError, setAssignError] = useState<string | null>(null);

  const getUnitValue = (u: { id: string; unit_name: string; building_id: string; type: string; size_m2: number | null }, col: string): string | number => {
    const assigned = unitTenantsMap.get(u.id) ?? [];
    const firstTenant = assigned[0] ? tenantMap.get(assigned[0].tenant_id) : null;
    const unitOwner = ownerByUnitId.get(u.id);
    const ownerDisplay = unitOwner ? `${unitOwner.name} ${unitOwner.surname}`.trim() || unitOwner.email : "";
    switch (col) {
      case "unit": return u.unit_name;
      case "site": return getSiteName(u.building_id);
      case "building": return buildingMap.get(u.building_id) ?? "";
      case "type": return u.type;
      case "size": return u.size_m2 ?? 0;
      case "party":
        if (ownerUnitIdSet.has(u.id)) {
          return firstTenant ? `${firstTenant.name} ${firstTenant.surname}` : "";
        }
        return ownerDisplay;
      default: return "";
    }
  };
  const sortedUnits = unitsSortCol ? sortBy(units, unitsSortCol, unitsSortDir, (u, c) => getUnitValue(u, c)) : units;
  const handleUnitsSort = (col: string) => { setUnitsSortDir(prev => unitsSortCol === col && prev === "asc" ? "desc" : "asc"); setUnitsSortCol(col); };

  async function handleAssignTenant(unitId: string, tenantId: string) {
    setAssignError(null);
    const res = await assignTenant(unitId, tenantId, addResponsibleForPayment);
    if (!res.ok && res.error) setAssignError(res.error);
  }

  return (
    <div className="space-y-4 mt-2">
      {assignError && <p className="text-sm text-red-600">{assignError}</p>}
      <Card>
        <CardHeader><CardTitle>{t(locale, "headers.myUnits")} ({units.length})</CardTitle></CardHeader>
        <CardContent className="w-full min-w-0 overflow-x-auto md:overflow-visible">
          <table className="w-full text-sm table-fixed">
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "14%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "6%" }} />
              <col style={{ width: "16%" }} />
              <col style={{ width: "17%" }} />
            </colgroup>
            <thead><tr className="border-b text-left">
              <SortableTh column="unit" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "table.unit")}</SortableTh>
              <SortableTh column="site" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "common.site")}</SortableTh>
              <SortableTh column="building" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "table.building")}</SortableTh>
              <SortableTh column="type" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "table.type")}</SortableTh>
              <SortableTh column="entrance" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} align="center" className="pb-3 pr-2 font-medium text-muted-foreground">{t(locale, "table.entrance")}</SortableTh>
              <SortableTh column="floor" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} align="center" className="pb-3 pr-2 font-medium text-muted-foreground">{t(locale, "table.floor")}</SortableTh>
              <SortableTh column="size" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} align="center" className="pb-3 pr-2 font-medium text-muted-foreground">{t(locale, "table.sizeM2")}</SortableTh>
              <SortableTh column="party" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "resident.unitsPartyColumn")}</SortableTh>
              <th className="pb-3 pr-2 font-medium text-muted-foreground">{t(locale, "common.actions")}</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {sortedUnits.map(u => {
                const assigned = unitTenantsMap.get(u.id) ?? [];
                const isOwner = ownerUnitIdSet.has(u.id);
                return (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-2 font-medium break-words">{u.unit_name}</td>
                    <td className="py-3 pr-2 text-muted-foreground break-words">{getSiteName(u.building_id) || "—"}</td>
                    <td className="py-3 pr-2 text-muted-foreground break-words">{buildingMap.get(u.building_id) ?? "—"}</td>
                    <td className="py-3 pr-2"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{u.type}</span></td>
                    <td className="py-3 pr-2 text-center text-muted-foreground">{(u as { entrance?: string | null }).entrance ?? "—"}</td>
                    <td className="py-3 pr-2 text-center text-muted-foreground">{(u as { floor?: string | null }).floor ?? "—"}</td>
                    <td className="py-3 pr-2 text-center">{u.size_m2 ?? "—"}</td>
                    <td className="py-3 pr-2 break-words">
                      <div className="flex flex-col gap-1 min-w-0">
                        {isOwner ? (
                          <>
                            {assigned.map(a => {
                              const tenant = tenantMap.get(a.tenant_id);
                              const isResp = a.is_payment_responsible !== false;
                              return tenant ? (
                                <div key={a.tenant_id} className="flex flex-col gap-1 min-w-0">
                                  <span className="text-sm break-words">{tenant.name} {tenant.surname}</span>
                                  <label className="flex items-center gap-1.5 cursor-pointer">
                                    <input type="checkbox" checked={isResp} onChange={(e) => setPaymentResponsible(u.id, a.tenant_id, e.target.checked)} className="rounded border-input size-4" />
                                    <span className="text-xs text-muted-foreground">{t(locale, "owner.responsibleForPayment")}</span>
                                  </label>
                                </div>
                              ) : null;
                            })}
                            {assigned.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </>
                        ) : (
                          (() => {
                            const o = ownerByUnitId.get(u.id);
                            const label = o ? `${o.name} ${o.surname}`.trim() : "";
                            if (!o || (!label && !o.email)) return <span className="text-xs text-muted-foreground">—</span>;
                            return (
                              <div className="flex flex-col gap-0.5 min-w-0">
                                {label ? <span className="text-sm break-words">{label}</span> : null}
                                {o.email ? <span className="text-xs text-muted-foreground break-all">{o.email}</span> : null}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-2">
                      <div className="flex flex-col gap-1 min-w-0">
                        {isOwner && assigned.map(a => {
                          const tenant = tenantMap.get(a.tenant_id);
                          return tenant ? (
                            <Button key={a.tenant_id} size="sm" variant="ghost" className="h-6 text-xs text-red-600 w-fit" onClick={() => removeTenant(u.id, a.tenant_id)}>{t(locale, "owner.remove")}</Button>
                          ) : null;
                        })}
                        {isOwner && tenants.length > 0 ? (
                          (() => { const avail = tenants.filter(tn => !assigned.some(a => a.tenant_id === tn.id)); return avail.length > 0 && (
                            <div className="flex flex-col gap-1 min-w-0">
                              <label className="flex items-center gap-1.5 cursor-pointer">
                                <input type="checkbox" checked={addResponsibleForPayment} onChange={(e) => setAddResponsibleForPayment(e.target.checked)} className="rounded border-input size-4 shrink-0" />
                                <span className="text-xs text-muted-foreground break-words">{t(locale, "owner.responsibleForPayment")}</span>
                              </label>
                              <Select onValueChange={(v) => { if (v && v !== "none") handleAssignTenant(u.id, v); }}>
                                <SelectTrigger className="h-7 w-full max-w-[120px] text-xs"><SelectValue placeholder={t(locale, "owner.assignTenant")} /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">{t(locale, "owner.selectOption")}</SelectItem>
                                  {avail.map(tn => <SelectItem key={tn.id} value={tn.id}>{tn.name} {tn.surname}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          ); })()
                        ) : null}
                        {isOwner && !assigned.length && tenants.length === 0 && <span className="text-xs text-muted-foreground">{t(locale, "owner.noTenantUsers")}</span>}
                        {!isOwner && !assigned.length && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!units.length && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{t(locale, "owner.noUnitsAssigned")}</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
