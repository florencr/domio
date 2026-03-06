"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useOwnerData } from "../context";

export default function OwnerUnitsPage() {
  const { data, assignTenant, removeTenant } = useOwnerData();
  const [unitsSortCol, setUnitsSortCol] = useState<string | null>(null);
  const [unitsSortDir, setUnitsSortDir] = useState<"asc" | "desc">("asc");

  const { profile, units, buildings, unitTenantAssignments, tenants } = data;
  const buildingMap = new Map(buildings.map(b => [b.id, b.name]));
  const tenantMap = new Map(tenants.map(t => [t.id, t]));
  const unitTenantsMap = new Map<string, { unit_id: string; tenant_id: string }[]>();
  unitTenantAssignments.forEach(a => {
    const list = unitTenantsMap.get(a.unit_id) ?? [];
    list.push(a);
    unitTenantsMap.set(a.unit_id, list);
  });

  const getUnitValue = (u: { id: string; unit_name: string; building_id: string; type: string; size_m2: number | null }, col: string): string | number => {
    const assigned = unitTenantsMap.get(u.id) ?? [];
    const firstTenant = assigned[0] ? tenantMap.get(assigned[0].tenant_id) : null;
    switch (col) {
      case "unit": return u.unit_name;
      case "building": return buildingMap.get(u.building_id) ?? "";
      case "type": return u.type;
      case "size": return u.size_m2 ?? 0;
      case "tenant": return firstTenant ? `${firstTenant.name} ${firstTenant.surname}` : "";
      default: return "";
    }
  };
  const sortedUnits = unitsSortCol ? sortBy(units, unitsSortCol, unitsSortDir, (u, c) => getUnitValue(u, c)) : units;
  const handleUnitsSort = (col: string) => { setUnitsSortDir(prev => unitsSortCol === col && prev === "asc" ? "desc" : "asc"); setUnitsSortCol(col); };

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader><CardTitle>My Units ({units.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead><tr className="border-b text-left">
              <SortableTh column="unit" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Unit</SortableTh>
              <SortableTh column="building" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Building</SortableTh>
              <SortableTh column="type" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Type</SortableTh>
              <SortableTh column="size" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground text-center">m²</SortableTh>
              <SortableTh column="tenant" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 font-medium text-muted-foreground">Tenant</SortableTh>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {sortedUnits.map(u => {
                const assigned = unitTenantsMap.get(u.id) ?? [];
                return (
                  <tr key={u.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-4 font-medium">{u.unit_name}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{buildingMap.get(u.building_id) ?? "—"}</td>
                    <td className="py-3 pr-4"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{u.type}</span></td>
                    <td className="py-3 pr-4 text-center">{u.size_m2 ?? "—"}</td>
                    <td className="py-3">
                      <div className="flex flex-col gap-1">
                        {assigned.map(a => {
                          const t = tenantMap.get(a.tenant_id);
                          return t ? (
                            <div key={a.tenant_id} className="flex items-center gap-2">
                              <span className="text-sm">{t.name} {t.surname}</span>
                              <Button size="sm" variant="ghost" className="h-6 text-xs text-red-600" onClick={() => removeTenant(u.id, a.tenant_id)}>Remove</Button>
                            </div>
                          ) : null;
                        })}
                        {tenants.length > 0 ? (
                          (() => { const avail = tenants.filter(t => !assigned.some(a => a.tenant_id === t.id)); return avail.length > 0 && (
                            <div className="flex items-center gap-2 mt-0.5">
                              <Select onValueChange={(v) => { if (v && v !== "none") assignTenant(u.id, v); }}>
                                <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="+ Assign tenant" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">— Select —</SelectItem>
                                  {avail.map(t => <SelectItem key={t.id} value={t.id}>{t.name} {t.surname}</SelectItem>)}
                                </SelectContent>
                              </Select>
                            </div>
                          ); })()
                        ) : <span className="text-xs text-muted-foreground">No tenant users. Ask manager to create.</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!units.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No units assigned to you.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
