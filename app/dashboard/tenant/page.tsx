"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { LogOut, User, Camera, FileText, Download } from "lucide-react";
import { NotificationBell, NotificationItem } from "@/components/NotificationBell";
import { DomioLogo } from "@/components/DomioLogo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

type TenantData = {
  profile: { id: string; name: string; surname: string; email: string; role: string; phone?: string | null } | null;
  units: { id: string; unit_name: string; type: string; size_m2: number | null; building_id: string }[];
  allUnits: { id: string; unit_name: string }[];
  buildings: { id: string; name: string }[];
  bills: { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; status: string; paid_at: string | null; receipt_url?: string | null; receipt_filename?: string | null; receipt_path?: string | null }[];
  expenses: { id: string; title: string; vendor: string; amount: number; period_month: number | null; period_year: number | null }[];
  unitTenantAssignments: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }[];
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function expenseRef(e: { title?: string; category?: string; period_month?: number | null; period_year?: number | null }) {
  const src = e.title || e.category || "EXP";
  const code = src.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3) || "EXP";
  if (e.period_month != null && e.period_year != null) {
    const mon = MONTHS[e.period_month - 1].slice(0, 3).toUpperCase();
    const yr = String(e.period_year % 100).padStart(2, "0");
    return `EXP-${code}-${mon}${yr}`;
  }
  return `EXP-${code}`;
}

export default function TenantPage() {
  const router = useRouter();
  const [data, setData] = useState<TenantData>({ profile: null, units: [], allUnits: [], buildings: [], bills: [], expenses: [], unitTenantAssignments: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("billing");
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  type UploadTarget = { billId?: string; periodMonth?: number; periodYear?: number };
  const uploadTargetRef = useRef<UploadTarget>({});

  const load = async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [profileRes, tenantAssignmentsRes] = await Promise.all([
      sb.from("profiles").select("id, name, surname, email, role, phone").eq("id", user.id).single(),
      sb.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", user.id),
    ]);
    const profile = profileRes.data;
    const unitIds = (tenantAssignmentsRes.data ?? []).map(u => u.unit_id);
    if (!unitIds.length) {
      const allUnits = (await sb.from("units").select("id, unit_name")).data ?? [];
      setData({ profile, units: [], allUnits, buildings: [], bills: [], expenses: [], unitTenantAssignments: [] });
      setLoading(false);
      return;
    }

    const unitIdSet = new Set(unitIds);
    const [unitsRes, allUnitsRes, buildingsRes, billsRes, expensesRes, assignmentsRes] = await Promise.all([
      sb.from("units").select("id, unit_name, type, size_m2, building_id").in("id", unitIds),
      sb.from("units").select("id, unit_name"),
      sb.from("buildings").select("id, name"),
      sb.rpc("get_my_bills", { lim: 200 }),
      sb.from("expenses").select("id, title, vendor, amount, period_month, period_year"),
      sb.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", unitIds),
    ]);
    const rawBills = (billsRes.data ?? []) as { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; status: string; paid_at: string | null; receipt_url?: string | null; receipt_filename?: string | null; receipt_path?: string | null }[];
    const assignments = (assignmentsRes.data ?? []) as { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }[];
    const unitPayerMap = new Map<string, string>();
    assignments.forEach(a => {
      if (!unitPayerMap.has(a.unit_id) && a.is_payment_responsible !== false) unitPayerMap.set(a.unit_id, a.tenant_id);
      else if (a.is_payment_responsible === true) unitPayerMap.set(a.unit_id, a.tenant_id);
    });
    const myPayingUnitIds = new Set(unitIds.filter((uid: string) => unitPayerMap.get(uid) === user.id));
    const allBills = rawBills.filter(b => myPayingUnitIds.has(b.unit_id));
    setData({ profile, units: unitsRes.data ?? [], allUnits: allUnitsRes.data ?? [], buildings: buildingsRes.data ?? [], bills: allBills, expenses: expensesRes.data ?? [], unitTenantAssignments: assignments });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const loadNotifications = async () => {
    const res = await fetch("/api/notifications", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setNotifications(json.notifications ?? []);
  };
  useEffect(() => { if (tab === "notifications") loadNotifications(); }, [tab]);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  async function uploadSlip(target: UploadTarget, file: File) {
    const key = target.billId ?? `${target.periodMonth}-${target.periodYear}`;
    setUploadingFor(key);
    setUploadError(null);
    const sb = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = target.periodMonth != null ? `payer-${data.profile?.id ?? "x"}/${target.periodYear}-${String(target.periodMonth).padStart(2, "0")}.${ext}` : `${target.billId}.${ext}`;
    const { error: upErr } = await sb.storage.from("payment-slips").upload(path, file, { upsert: true });
    if (!upErr) {
      const body = target.periodMonth != null ? { periodMonth: target.periodMonth, periodYear: target.periodYear, receipt_path: path, receipt_filename: file.name } : { billId: target.billId, receipt_path: path, receipt_filename: file.name };
      const res = await fetch("/api/receipt-record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) load();
      else { const err = await res.json().catch(() => ({})); setUploadError(err.error || "Could not record slip."); }
    } else setUploadError(upErr.message || "Upload failed.");
    setUploadingFor(null);
  }

  const triggerFileInput = (target: UploadTarget) => {
    if (fileInputRef.current) { uploadTargetRef.current = target; fileInputRef.current.click(); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>
  );

  const { profile, units, buildings, allUnits, bills, expenses } = data;
  const buildingMap = new Map(buildings.map(b => [b.id, b.name]));
  const unitMap = new Map(allUnits.map(u => [u.id, u]));
  const unitIdSet = new Set(units.map(u => u.id));
  const myBills = bills.filter(b => unitIdSet.has(b.unit_id));

  const collected = myBills.filter(b => b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const outstanding = myBills.filter(b => !b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const expenseRecords = expenses.filter(e => e.period_month != null);
  const monthlyExpenses = expenseRecords.reduce((s, e) => s + Number(e.amount), 0);
  const netFund = collected - monthlyExpenses;

  type LedgerRow = { key: string; date: string; type: "income"|"expense"; label: string; ref: string; amount: number; status: string };
  const periodLabel = (d: string) => { const [y, m] = d.split("-"); return `${MONTHS[parseInt(m||"1")-1]} ${y}`; };
  const ledgerRows: LedgerRow[] = [
    ...myBills.map(b => ({ key:`b-${b.id}`, date:`${b.period_year}-${String(b.period_month).padStart(2,"0")}`, type:"income" as const, label:`${unitMap.get(b.unit_id)?.unit_name ?? "—"} — ${MONTHS[b.period_month-1]} ${b.period_year}`, ref: (b as {reference_code?: string}).reference_code ?? "—", amount: Math.abs(Number(b.total_amount)), status: b.paid_at ? "Paid" : b.status === "in_process" ? "In process" : b.status })),
    ...expenses.filter(e => e.period_month != null).map(e => ({ key:`e-${e.id}`, date: `${e.period_year!}-${String(e.period_month!).padStart(2,"0")}`, type:"expense" as const, label:`${e.title} · ${e.vendor}`, ref: (e as {reference_code?: string}).reference_code ?? expenseRef(e), amount: Number(e.amount), status: "Recurrent" })),
  ].sort((a,b) => b.date.localeCompare(a.date));
  let running = 0;
  const rowsWithBalance = [...ledgerRows].reverse().map(r => { running += r.type === "income" ? r.amount : -r.amount; return {...r, balance: running}; }).reverse();

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <input type="file" ref={fileInputRef} accept="image/*,.pdf" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; const t = uploadTargetRef.current; if (f && (t.billId || (t.periodMonth != null && t.periodYear != null))) uploadSlip(t, f); e.target.value = ""; }} />
      <header className="flex items-center justify-between mb-6">
        <Link href="/dashboard/tenant" className="flex items-center">
          <DomioLogo className="h-9 w-auto" />
          <span className="ml-2 text-sm text-muted-foreground font-normal hidden sm:inline">Tenant</span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell onSeeAllClick={() => setTab("notifications")} />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-9 md:w-auto md:px-3 md:gap-2">
                <User className="size-5 shrink-0" />
                <span className="hidden md:inline truncate max-w-[140px]">{profile?.name} {profile?.surname}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-3 space-y-2">
                <p className="font-semibold">{profile?.name} {profile?.surname}</p>
                <p className="text-sm text-muted-foreground capitalize">Role: {profile?.role}</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={handleSignOut}><LogOut className="size-4 mr-1" /> Logout</Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Collected</CardTitle></CardHeader>
          <CardContent className="pb-4"><p className="text-2xl font-bold text-green-600">{collected.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">From {myBills.filter(b=>b.paid_at).length} paid bills</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outstanding</CardTitle></CardHeader>
          <CardContent className="pb-4"><p className="text-2xl font-bold text-red-600">{outstanding.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">From {myBills.filter(b=>!b.paid_at).length} unpaid bills</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-orange-500">
          <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly Expenses</CardTitle></CardHeader>
          <CardContent className="pb-4"><p className="text-2xl font-bold text-orange-600">{monthlyExpenses.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">{expenseRecords.length} expense records</p></CardContent>
        </Card>
        <Card className={`border-l-4 ${netFund >= 0 ? "border-l-blue-500" : "border-l-red-500"}`}>
          <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Net Fund</CardTitle></CardHeader>
          <CardContent className="pb-4"><p className={`text-2xl font-bold ${netFund >= 0 ? "text-blue-600" : "text-red-600"}`}>{netFund.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">Collected minus expenses</p></CardContent>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-4 max-w-2xl mb-2">
          <TabsTrigger value="units">My Units</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="units">
          <Card className="mt-2">
            <CardHeader><CardTitle>My Units ({units.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead><tr className="border-b text-left"><th className="pb-3 pr-4 font-medium text-muted-foreground">Unit</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Building</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Type</th><th className="pb-3 font-medium text-muted-foreground text-center">m²</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {units.map(u => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{u.unit_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{buildingMap.get(u.building_id) ?? "—"}</td>
                      <td className="py-3 pr-4"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{u.type}</span></td>
                      <td className="py-3 pr-4 text-center">{u.size_m2 ?? "—"}</td>
                    </tr>
                  ))}
                  {!units.length && <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No units assigned to you.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-4 mt-2">
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            <Card>
              <CardHeader><CardTitle>My Bills ({myBills.length})</CardTitle><p className="text-sm text-muted-foreground">One PDF and one slip per period. Actions apply to all bills in that period.</p></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead><tr className="border-b text-left"><th className="pb-3 pr-4 font-medium text-muted-foreground">Reference</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Period</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Unit</th><th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Amount</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Paid on</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Invoice</th><th className="pb-3 font-medium text-muted-foreground">Action</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      const byPeriod = new Map<string, typeof myBills>();
                      myBills.forEach(b => {
                        const k = `${b.period_year}-${String(b.period_month).padStart(2, "0")}`;
                        const list = byPeriod.get(k) ?? []; list.push(b); byPeriod.set(k, list);
                      });
                      const sortedBills = [...myBills].sort((a, b) => b.period_year - a.period_year || b.period_month - a.period_month);
                      const seenPeriod = new Set<string>();
                      return sortedBills.map(b => {
                        const periodKey = `${b.period_year}-${String(b.period_month).padStart(2, "0")}`;
                        const bills = byPeriod.get(periodKey) ?? [];
                        const isFirstInPeriod = !seenPeriod.has(periodKey);
                        if (isFirstInPeriod) seenPeriod.add(periodKey);
                        const anyReceipt = bills.some(x => x.receipt_url || x.receipt_path);
                        const uploadKey = periodKey;
                        return (
                          <tr key={b.id} className="hover:bg-muted/30">
                            <td className="py-3 pr-4 font-mono text-xs">{(b as { reference_code?: string }).reference_code ?? "—"}</td>
                            <td className="py-3 pr-4 font-medium">{MONTHS[b.period_month - 1]} {b.period_year}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{unitMap.get(b.unit_id)?.unit_name ?? "—"}</td>
                            <td className="py-3 pr-4 text-right font-semibold">{Number(b.total_amount).toFixed(2)}</td>
                            <td className="py-3 pr-4">
                              {b.paid_at ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Paid</span> : b.status === "in_process" ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">In process</span> : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Unpaid</span>}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground text-xs">{b.paid_at ? new Date(b.paid_at).toLocaleDateString() : "—"}</td>
                            <td className="py-3 pr-4">
                              {isFirstInPeriod ? (
                                <a href={`/api/invoice?periodMonth=${b.period_month}&periodYear=${b.period_year}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><Download className="size-3" /> PDF</a>
                              ) : "—"}
                            </td>
                            <td className="py-3">
                              {isFirstInPeriod ? (
                                anyReceipt ? (
                                  <div className="flex flex-col gap-0.5">
                                    <span className="text-xs text-muted-foreground">Slip uploaded</span>
                                    <a href={`/api/receipt?billId=${bills[0].id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><FileText className="size-3" /> View</a>
                                  </div>
                                ) : (
                                  <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!uploadingFor} onClick={() => triggerFileInput({ periodMonth: b.period_month, periodYear: b.period_year })}>
                                    {uploadingFor === uploadKey ? "Uploading..." : <><Camera className="size-3 mr-1" /> Upload slip</>}
                                  </Button>
                                )
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    {!myBills.length && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No bills yet.</td></tr>}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <Card className="mt-2">
            <CardHeader><CardTitle>Full Ledger ({ledgerRows.length} entries)</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead><tr className="border-b text-left"><th className="pb-3 pr-4 font-medium text-muted-foreground">Reference</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Period</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Type</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Description</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th><th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Amount</th><th className="pb-3 font-medium text-muted-foreground text-right">Running Balance</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {rowsWithBalance.map(r => (
                    <tr key={r.key} className="hover:bg-muted/30">
                      <td className="py-3 pr-4 font-mono text-xs">{r.ref}</td>
                      <td className="py-3 pr-4 text-muted-foreground font-medium">{periodLabel(r.date)}</td>
                      <td className="py-3 pr-4">
                        {r.type === "income" ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Bill</span> : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Expense</span>}
                      </td>
                      <td className="py-3 pr-4">{r.label}</td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs capitalize">{r.status}</td>
                      <td className={`py-3 pr-4 text-right font-semibold ${r.type==="income"?"text-green-600":"text-red-600"}`}>{r.type==="income"?"+":"-"}{r.amount.toFixed(2)}</td>
                      <td className={`py-3 text-right font-mono text-sm ${r.balance>=0?"text-blue-600":"text-red-600"}`}>{r.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                  {!ledgerRows.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No transactions yet.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="mt-2">
            <CardHeader><CardTitle>Notifications ({notifications.length})</CardTitle></CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">No notifications.</p>
              ) : (
                <div className="space-y-2">
                  {notifications.map(n => (
                    <div
                      key={n.recipientId}
                      className={`p-4 rounded-lg border ${!n.readAt ? "bg-blue-50 dark:bg-blue-950/30 border-blue-200" : "bg-muted/20"}`}
                    >
                      <p className="font-medium">{n.title}</p>
                      {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
                      <p className="text-xs text-muted-foreground mt-2">{n.created_at ? new Date(n.created_at).toLocaleString() : ""}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
