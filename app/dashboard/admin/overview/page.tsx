"use client";

import { useAdminData } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Pencil } from "lucide-react";
import Link from "next/link";

export default function AdminOverviewPage() {
  const { profile, sites, managers, buildings, load, msg, setMsg } = useAdminData();

  const managerMap = new Map(managers.map(m => [m.id, m]));
  const managersWithoutSite = managers.filter(m => !sites.some(s => s.manager_id === m.id));
  const buildingsBySite = new Map<string, typeof buildings>();
  buildings.forEach(b => {
    const sid = b.site_id ?? "_none";
    const list = buildingsBySite.get(sid) ?? [];
    list.push(b);
    buildingsBySite.set(sid, list);
  });
  const unassignedBuildings = buildings.filter(b => !b.site_id);

  async function assignSiteToManager(siteId: string, managerId: string) {
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/sites/${siteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ manager_id: managerId }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Site assigned to manager.", ok: true });
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
        <CardHeader>
          <CardTitle>Sites Overview</CardTitle>
          <p className="text-sm text-muted-foreground">Sites with address, buildings, and assigned manager. Use the nav to create and connect.</p>
        </CardHeader>
        <CardContent>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 text-left font-medium">Site</th>
                <th className="py-2 text-left font-medium">Address</th>
                <th className="py-2 text-left font-medium">Manager</th>
                <th className="py-2 text-left font-medium">Buildings</th>
                <th className="py-2 text-left font-medium w-12"></th>
              </tr>
            </thead>
            <tbody>
              {sites.map(s => {
                const m = managerMap.get(s.manager_id);
                const siteBuildings = buildingsBySite.get(s.id) ?? [];
                return (
                  <tr key={s.id} className="border-b align-top">
                    <td className="py-3 font-medium">{s.name}</td>
                    <td className="py-3 text-muted-foreground">{s.address || "—"}</td>
                    <td className="py-3">{m ? `${m.name} ${m.surname}` : (
                      <Select onValueChange={(v) => assignSiteToManager(s.id, v)}>
                        <SelectTrigger className="w-[180px] h-8 text-amber-600 border-amber-200">
                          <SelectValue placeholder="Assign manager" />
                        </SelectTrigger>
                        <SelectContent>
                          {managers.map(mgr => <SelectItem key={mgr.id} value={mgr.id}>{mgr.name} {mgr.surname}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    )}</td>
                    <td className="py-3">
                      {siteBuildings.length ? (
                        <ul className="text-xs space-y-1">
                          {siteBuildings.map(b => <li key={b.id}>{b.name}</li>)}
                        </ul>
                      ) : "—"}
                    </td>
                    <td className="py-3">
                      <Link href={`/dashboard/admin/sites?edit=${s.id}`} prefetch={false}>
                        <Button variant="ghost" size="icon" title="Edit site"><Pencil className="size-4" /></Button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {managersWithoutSite.map(m => (
                <tr key={m.id} className="border-b align-top bg-amber-50/50">
                  <td className="py-3 text-amber-700">No site</td>
                  <td className="py-3">—</td>
                  <td className="py-3">{m.name} {m.surname}</td>
                  <td className="py-3">—</td>
                  <td className="py-3">
                    <Link href={`/dashboard/admin/managers?edit=${m.id}`}>
                      <Button variant="ghost" size="icon" title="Edit manager"><Pencil className="size-4" /></Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {unassignedBuildings.length > 0 && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground mb-2">Unassigned buildings</p>
              <div className="flex flex-wrap gap-2">
                {unassignedBuildings.map(b => (
                  <div key={b.id} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted text-sm">
                    <span>{b.name}</span>
                    <Select onValueChange={(v) => assignBuildingToSite(b.id, v)}>
                      <SelectTrigger className="w-[140px] h-7 text-xs"><SelectValue placeholder="Assign to site" /></SelectTrigger>
                      <SelectContent>
                        {sites.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          )}
          {!sites.length && !managers.length && <p className="py-6 text-center text-muted-foreground">No data yet. Create managers, sites, and buildings in the nav above.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
