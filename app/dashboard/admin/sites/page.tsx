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

export default function AdminSitesPage() {
  const searchParams = useSearchParams();
  const { locale } = useLocale();
  const { sites, managers, load, msg, setMsg } = useAdminData();
  const [showCreateSite, setShowCreateSite] = useState(false);
  const [siteForm, setSiteForm] = useState({ managerId: "", name: "", address: "" });
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [siteEditForm, setSiteEditForm] = useState({ name: "", address: "" });
  const [filterManagerId, setFilterManagerId] = useState<string>("all");

  const managerMap = new Map(managers.map(m => [m.id, m]));
  const managersWithoutSite = managers.filter(m => !sites.some(s => s.manager_id === m.id));
  const filteredSites = useMemo(() => {
    if (filterManagerId === "all") return sites;
    return sites.filter(s => s.manager_id === filterManagerId);
  }, [sites, filterManagerId]);

  useEffect(() => {
    const editParam = searchParams.get("edit");
    if (editParam) {
      const s = sites.find(x => x.id === editParam);
      if (s) {
        setEditingSiteId(editParam);
        setSiteEditForm({ name: s.name, address: s.address || "" });
      }
    }
  }, [searchParams, sites]);

  async function createSite(e: React.FormEvent) {
    e.preventDefault();
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/sites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manager_id: siteForm.managerId,
        name: siteForm.name,
        address: siteForm.address,
      }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Site created.", ok: true });
      setSiteForm({ managerId: "", name: "", address: "" });
      setShowCreateSite(false);
      load();
    } else {
      setMsg({ text: json.error || "Failed", ok: false });
    }
  }

  async function updateSite(e: React.FormEvent) {
    e.preventDefault();
    if (!editingSiteId) return;
    setMsg({ text: "", ok: true });
    const res = await fetch(`/api/admin/sites/${editingSiteId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: siteEditForm.name,
        address: siteEditForm.address,
      }),
    });
    const json = await res.json();
    if (res.ok && json.success) {
      setMsg({ text: "Site updated.", ok: true });
      setEditingSiteId(null);
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
            <CardTitle>{t(locale, "admin.sites")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t(locale, "admin.sitesDescription")}</p>
          </div>
          <Button onClick={() => { setShowCreateSite(!showCreateSite); setEditingSiteId(null); }} variant={showCreateSite ? "outline" : "default"}>
            <Plus className="size-4 mr-1" />{showCreateSite ? t(locale, "common.cancel") : t(locale, "admin.createSite")}
          </Button>
        </CardHeader>
        <CardContent>
          {showCreateSite && (
            <form onSubmit={createSite} className="grid gap-3 p-4 border rounded-lg mb-4">
              <div><Label>{t(locale, "admin.manager")}</Label>
                <Select value={siteForm.managerId} onValueChange={v => setSiteForm({ ...siteForm, managerId: v })}>
                  <SelectTrigger><SelectValue placeholder={t(locale, "admin.selectManager")} /></SelectTrigger>
                  <SelectContent>
                    {managersWithoutSite.map(m => <SelectItem key={m.id} value={m.id}>{m.name} {m.surname} ({m.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>{t(locale, "admin.siteName")}</Label><Input value={siteForm.name} onChange={e => setSiteForm({ ...siteForm, name: e.target.value })} placeholder={t(locale, "admin.siteNamePlaceholder")} required /></div>
              <div><Label>{t(locale, "admin.address")}</Label><Input value={siteForm.address} onChange={e => setSiteForm({ ...siteForm, address: e.target.value })} placeholder={t(locale, "admin.addressPlaceholder")} /></div>
              <Button type="submit" disabled={!siteForm.managerId || !managersWithoutSite.length}>{t(locale, "admin.createSite")}</Button>
              {!managersWithoutSite.length && <p className="text-xs text-amber-600">{t(locale, "admin.allManagersHaveSites")}</p>}
            </form>
          )}
          {editingSiteId && (
            <form onSubmit={updateSite} className="grid gap-3 p-4 border rounded-lg mb-4 bg-muted/30">
              <p className="text-sm font-medium">{t(locale, "admin.editSite")}</p>
              <div><Label>{t(locale, "admin.siteName")}</Label><Input value={siteEditForm.name} onChange={e => setSiteEditForm({ ...siteEditForm, name: e.target.value })} required /></div>
              <div><Label>{t(locale, "admin.address")}</Label><Input value={siteEditForm.address} onChange={e => setSiteEditForm({ ...siteEditForm, address: e.target.value })} placeholder="e.g. 123 Main St" /></div>
              <div className="flex gap-2">
                <Button type="submit">{t(locale, "common.save")}</Button>
                <Button type="button" variant="outline" onClick={() => setEditingSiteId(null)}>{t(locale, "common.cancel")}</Button>
              </div>
            </form>
          )}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Label className="text-xs text-muted-foreground whitespace-nowrap">{t(locale, "admin.filterByManager")}</Label>
              <Select value={filterManagerId} onValueChange={setFilterManagerId}>
                <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t(locale, "common.all")}</SelectItem>
                  {managers.map(m => <SelectItem key={m.id} value={m.id}>{m.name} {m.surname}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "common.name")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "admin.address")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "admin.manager")}</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">{t(locale, "common.action")}</th>
                </tr>
              </thead>
              <tbody>
                {filteredSites.map(s => {
                  const m = managerMap.get(s.manager_id);
                  return (
                    <tr key={s.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{s.address || "—"}</td>
                      <td className="px-4 py-3 text-muted-foreground">{m ? `${m.name} ${m.surname}` : "—"}</td>
                      <td className="px-4 py-3">
                        <Button variant="outline" size="sm" className="h-8 gap-1" onClick={() => { setShowCreateSite(false); setEditingSiteId(s.id); setSiteEditForm({ name: s.name, address: s.address || "" }); }}>
                          <Pencil className="size-3.5" />{t(locale, "common.edit")}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!filteredSites.length && <p className="py-6 text-center text-muted-foreground">{t(locale, "admin.noSitesYet")}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
