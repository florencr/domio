"use client";

import { useEffect, useState } from "react";
import { useAdminData } from "../context";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminMaintenancePage() {
  const { sites, load } = useAdminData();
  const [deleteLocksEnabled, setDeleteLocksEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearExpensesConfirm, setShowClearExpensesConfirm] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<string>("");

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch("/api/admin/maintenance", { signal: controller.signal })
      .then(r => r.ok ? r.json() : { deleteLocksEnabled: true })
      .then((j: { deleteLocksEnabled?: boolean }) => { setDeleteLocksEnabled(j.deleteLocksEnabled ?? true); setLoading(false); })
      .catch(() => { setDeleteLocksEnabled(true); setLoading(false); })
      .finally(() => clearTimeout(timer));
  }, []);

  async function toggleLocks() {
    setActionLoading(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "toggle", enabled: !deleteLocksEnabled }),
    });
    const j = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (res.ok && j.success) {
      setDeleteLocksEnabled(j.enabled ?? !deleteLocksEnabled);
      setMsg({ text: `Delete locks ${j.enabled ? "enabled" : "disabled"}.`, ok: true });
    } else {
      setMsg({ text: j.error || "Failed", ok: false });
    }
  }

  async function clearData() {
    setShowClearConfirm(false);
    if (!selectedSiteId) return;
    setActionLoading(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear", siteId: selectedSiteId }),
    });
    const j = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (res.ok && j.success) {
      setMsg({ text: "Site data cleared. Users kept.", ok: true });
      setSelectedSiteId("");
      load();
    } else {
      setMsg({ text: j.error || "Failed", ok: false });
    }
  }

  async function clearExpenses() {
    setShowClearExpensesConfirm(false);
    if (!selectedSiteId) return;
    setActionLoading(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/admin/maintenance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clearExpenses", siteId: selectedSiteId }),
    });
    const j = await res.json().catch(() => ({}));
    setActionLoading(false);
    if (res.ok && j.success) {
      setMsg({ text: "Expenses cleared for site.", ok: true });
      load();
    } else {
      setMsg({ text: j.error || "Failed", ok: false });
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Maintenance</CardTitle>
          <p className="text-sm text-muted-foreground">Toggle delete locks for bills/expenses and clear dummy data. Keeps user accounts.</p>
        </CardHeader>
        <CardContent className="space-y-6">
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}

          <div className="space-y-2">
            <p className="font-medium text-sm">Delete locks (bills & expenses)</p>
            <p className="text-xs text-muted-foreground">When enabled, only current and previous month can be deleted. Disable to clear old data.</p>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">{deleteLocksEnabled ? "Enabled" : "Disabled"}</span>
                <Button variant="outline" size="sm" onClick={toggleLocks} disabled={actionLoading}>
                  {actionLoading ? "..." : deleteLocksEnabled ? "Disable" : "Enable"}
                </Button>
              </div>
            )}
          </div>

          <div className="space-y-2 pt-4 border-t">
            <p className="font-medium text-sm">Clear expense dummy data</p>
            <p className="text-xs text-muted-foreground">Deletes only expenses for the selected site. Keeps bills, buildings, units, and users.</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedSiteId || "__none__"} onValueChange={v => setSelectedSiteId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Choose site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Choose site —</SelectItem>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowClearExpensesConfirm(true)}
                disabled={actionLoading || !selectedSiteId || sites.length === 0}
              >
                Clear expenses
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-4 border-t">
            <p className="font-medium text-sm">Clear site data</p>
            <p className="text-xs text-muted-foreground">Deletes one site and its buildings, units, bills, expenses, etc. Keeps profiles (users).</p>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={selectedSiteId || "__none__"} onValueChange={v => setSelectedSiteId(v === "__none__" ? "" : v)}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Choose site" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— Choose site —</SelectItem>
                  {sites.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowClearConfirm(true)}
                disabled={actionLoading || !selectedSiteId || sites.length === 0}
              >
                Clear site data
              </Button>
            </div>
          </div>

          {showClearExpensesConfirm && selectedSiteId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-background p-6 rounded-lg shadow-lg max-w-md mx-4">
                <p className="font-semibold mb-2">Clear expenses for this site?</p>
                <p className="text-sm text-muted-foreground mb-4">This will delete all expenses for the selected site. Bills, buildings, units, and users will be kept.</p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowClearExpensesConfirm(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={clearExpenses} disabled={actionLoading}>{actionLoading ? "Clearing..." : "Yes, clear expenses"}</Button>
                </div>
              </div>
            </div>
          )}

          {showClearConfirm && selectedSiteId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
              <div className="bg-background p-6 rounded-lg shadow-lg max-w-md mx-4">
                <p className="font-semibold mb-2">Clear site data?</p>
                <p className="text-sm text-muted-foreground mb-4">This will delete the selected site and all its buildings, units, bills, expenses, documents, and config. User accounts will be kept.</p>
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setShowClearConfirm(false)}>Cancel</Button>
                  <Button variant="destructive" onClick={clearData} disabled={actionLoading}>{actionLoading ? "Clearing..." : "Yes, clear site data"}</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
