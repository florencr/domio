"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { LogOut, User, Camera, FileText, Download, Home, BookOpen, Bell, SlidersHorizontal, AlertTriangle, CreditCard } from "lucide-react";
import { NotificationBell, NotificationItem } from "@/components/NotificationBell";
import { DomioLogo } from "@/components/DomioLogo";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
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
  const [unitsSortCol, setUnitsSortCol] = useState<string | null>(null);
  const [unitsSortDir, setUnitsSortDir] = useState<"asc" | "desc">("asc");
  const [billsSortCol, setBillsSortCol] = useState<string | null>(null);
  const [billsSortDir, setBillsSortDir] = useState<"asc" | "desc">("asc");
  const [ledgerSortCol, setLedgerSortCol] = useState<string | null>(null);
  const [ledgerSortDir, setLedgerSortDir] = useState<"asc" | "desc">("asc");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterUnitType, setFilterUnitType] = useState("all");
  const [filterUnitId, setFilterUnitId] = useState("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");
  const [filterLedgerPeriod, setFilterLedgerPeriod] = useState("all");
  const [filterLedgerType, setFilterLedgerType] = useState("all");
  const [filterLedgerStatus, setFilterLedgerStatus] = useState("all");
  const [showBillingFilters, setShowBillingFilters] = useState(false);
  const [showLedgerFilters, setShowLedgerFilters] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<{ site_name: string | null; bank_name: string | null; iban: string | null; swift_code: string | null; vat_account: string | null; manager_name: string | null; manager_email: string | null; manager_phone: string | null; payment_methods: string[] } | null>(null);
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

  const loadPaymentInfo = async () => {
    const res = await fetch("/api/payment-info", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setPaymentInfo(json);
  };
  useEffect(() => { if (tab === "payments") loadPaymentInfo(); }, [tab]);

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
  ];
  const getUnitValue = (u: { id: string; unit_name: string; building_id: string; type: string; size_m2: number | null }, col: string): string | number => {
    switch (col) { case "unit": return u.unit_name; case "building": return buildingMap.get(u.building_id) ?? ""; case "type": return u.type; case "size": return u.size_m2 ?? 0; default: return ""; }
  };
  const sortedUnits = unitsSortCol ? sortBy(units, unitsSortCol, unitsSortDir, getUnitValue) : units;
  const handleUnitsSort = (col: string) => { setUnitsSortDir(prev => unitsSortCol === col && prev === "asc" ? "desc" : "asc"); setUnitsSortCol(col); };
  const getTenantBillValue = (b: typeof myBills[0], col: string): string | number => {
    switch (col) {
      case "ref": return ((b as { reference_code?: string }).reference_code ?? "") as string;
      case "period": return b.period_year * 100 + b.period_month;
      case "unit": return (unitMap.get(b.unit_id)?.unit_name ?? "") as string;
      case "amount": return Math.abs(Number(b.total_amount));
      case "status": return (b.paid_at ? "Paid" : b.status) as string;
      case "paidOn": return b.paid_at ? new Date(b.paid_at).getTime() : 0;
      default: return "";
    }
  };
  let filteredBills = myBills;
  if (filterPeriod !== "all") { const [y, m] = filterPeriod.split("-").map(Number); filteredBills = filteredBills.filter(b => b.period_year === y && b.period_month === m); }
  if (filterUnitType !== "all") { const unitIdsByType = new Set(units.filter(u => u.type === filterUnitType).map(u => u.id)); filteredBills = filteredBills.filter(b => unitIdsByType.has(b.unit_id)); }
  if (filterUnitId !== "all") filteredBills = filteredBills.filter(b => b.unit_id === filterUnitId);
  if (filterPaymentStatus !== "all") {
    if (filterPaymentStatus === "paid") filteredBills = filteredBills.filter(b => b.paid_at);
    else if (filterPaymentStatus === "unpaid") filteredBills = filteredBills.filter(b => !b.paid_at && b.status !== "in_process");
    else if (filterPaymentStatus === "in_process") filteredBills = filteredBills.filter(b => b.status === "in_process");
  }
  const sortedBillsForDisplay = billsSortCol ? sortBy(filteredBills, billsSortCol, billsSortDir, getTenantBillValue) : [...filteredBills].sort((a, b) => b.period_year - a.period_year || b.period_month - a.period_month);
  const handleBillsSort = (col: string) => { setBillsSortDir(prev => billsSortCol === col && prev === "asc" ? "desc" : "asc"); setBillsSortCol(col); };
  const getLedgerValue = (r: LedgerRow & { balance?: number }, col: string): string | number => {
    switch (col) { case "ref": return r.ref; case "date": return r.date; case "type": return r.type; case "label": return r.label; case "status": return r.status; case "amount": return r.amount; case "balance": return r.balance ?? 0; default: return ""; }
  };
  let filteredLedgerRows = ledgerRows;
  if (filterLedgerPeriod !== "all") { const [y, m] = filterLedgerPeriod.split("-").map(Number); const prefix = `${y}-${String(m).padStart(2, "0")}`; filteredLedgerRows = filteredLedgerRows.filter(r => r.date.startsWith(prefix)); }
  if (filterLedgerType !== "all") filteredLedgerRows = filteredLedgerRows.filter(r => r.type === filterLedgerType);
  if (filterLedgerStatus !== "all") filteredLedgerRows = filteredLedgerRows.filter(r => r.status === filterLedgerStatus);
  const sortedLedgerRows = ledgerSortCol ? sortBy(filteredLedgerRows, ledgerSortCol, ledgerSortDir, getLedgerValue) : [...filteredLedgerRows].sort((a,b) => b.date.localeCompare(a.date));
  let running = 0;
  const rowsWithBalance = [...sortedLedgerRows].reverse().map(r => { running += r.type === "income" ? r.amount : -r.amount; return {...r, balance: running}; }).reverse();
  const handleLedgerSort = (col: string) => { setLedgerSortDir(prev => ledgerSortCol === col && prev === "asc" ? "desc" : "asc"); setLedgerSortCol(col); };

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <input type="file" ref={fileInputRef} accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; const t = uploadTargetRef.current; if (f && (t.billId || (t.periodMonth != null && t.periodYear != null))) uploadSlip(t, f); e.target.value = ""; }} />
      <header className="sticky top-0 z-30 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-4 md:static md:mx-0 md:mt-0 md:px-0 md:pt-0 md:pb-0 md:mb-6 bg-white/90 backdrop-blur-sm md:bg-transparent flex items-center justify-between">
        <Link href="/dashboard/tenant" className="flex items-center gap-2">
          <DomioLogo className="h-9 w-auto shrink-0" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Tenant Dashboard</span>
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
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer">
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {myBills.filter(b => !b.paid_at).length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="text-sm">
            You have <strong>{myBills.filter(b => !b.paid_at).length} unpaid bill{myBills.filter(b => !b.paid_at).length > 1 ? "s" : ""}</strong> ({outstanding.toFixed(2)} total). Please pay or upload your payment slip in the Billing tab.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Card className="border-l-4 border-l-green-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-green-600 shrink-0">{collected.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Collected</p>
            <p className="text-xs text-muted-foreground mt-0.5">From {myBills.filter(b=>b.paid_at).length} paid bills</p>
          </div>
        </Card>
        <Card className="border-l-4 border-l-red-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-red-600 shrink-0">{outstanding.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Outstanding</p>
            <p className="text-xs text-muted-foreground mt-0.5">From {myBills.filter(b=>!b.paid_at).length} unpaid bills</p>
          </div>
        </Card>
        <Card className="border-l-4 border-l-orange-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-orange-600 shrink-0">{monthlyExpenses.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Monthly Expenses</p>
            <p className="text-xs text-muted-foreground mt-0.5">{expenseRecords.length} expense records</p>
          </div>
        </Card>
        <Card className={`border-l-4 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start ${netFund >= 0 ? "border-l-blue-500" : "border-l-amber-500"}`}>
          <p className={`text-xl font-extrabold shrink-0 ${netFund >= 0 ? "text-blue-600" : "text-amber-600"}`}>{netFund.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Net Fund</p>
            <p className="text-xs text-muted-foreground mt-0.5">Collected minus expenses</p>
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="hidden md:block mb-2">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
            <TabsTrigger value="units" className="flex items-center gap-2"><Home className="size-4" />My Units</TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2"><FileText className="size-4" />Billing</TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2"><CreditCard className="size-4" />Payments</TabsTrigger>
            <TabsTrigger value="ledger" className="flex items-center gap-2"><BookOpen className="size-4" />Ledger</TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2"><Bell className="size-4" />Notifications</TabsTrigger>
          </TabsList>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-20 md:hidden bg-muted/90 border-t px-4 pt-1.5 pb-4">
          <TabsList className="grid w-full grid-cols-4 h-12 min-h-[48px] p-1.5 rounded-lg">
            <TabsTrigger value="units" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><Home className="size-4" />My Units</TabsTrigger>
            <TabsTrigger value="billing" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><FileText className="size-4" />Billing</TabsTrigger>
            <TabsTrigger value="payments" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><CreditCard className="size-4" />Payments</TabsTrigger>
            <TabsTrigger value="ledger" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><BookOpen className="size-4" />Ledger</TabsTrigger>
          </TabsList>
        </div>
        <div className="pb-24 md:pb-0">
        <TabsContent value="units">
          <div className="space-y-4 mt-2">
          <Card>
            <CardHeader><CardTitle>My Units ({units.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full text-sm min-w-[400px]">
                <thead><tr className="border-b text-left">
                  <SortableTh column="unit" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Unit</SortableTh>
                  <SortableTh column="building" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Building</SortableTh>
                  <SortableTh column="type" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Type</SortableTh>
                  <SortableTh column="size" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 font-medium text-muted-foreground text-center">m²</SortableTh>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {sortedUnits.map(u => (
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
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="space-y-4 mt-2">
            <Card>
              <CardHeader><CardTitle>Bank Account & Payment Methods</CardTitle><p className="text-sm text-muted-foreground mt-1">Payment details for your property manager.</p></CardHeader>
              <CardContent className="space-y-4">
                {paymentInfo ? (
                  <>
                    {paymentInfo.site_name && <p className="font-medium">{paymentInfo.site_name}</p>}
                    {(paymentInfo.bank_name || paymentInfo.iban || paymentInfo.swift_code) && (
                      <div className="space-y-2">
                        {paymentInfo.bank_name && <div><p className="text-sm font-medium text-muted-foreground">Bank name</p><p className="text-sm mt-0.5">{paymentInfo.bank_name}</p></div>}
                        {paymentInfo.iban && <div><p className="text-sm font-medium text-muted-foreground">IBAN</p><p className="text-sm mt-0.5 break-words">{paymentInfo.iban}</p></div>}
                        {paymentInfo.swift_code && <div><p className="text-sm font-medium text-muted-foreground">SWIFT code</p><p className="text-sm mt-0.5">{paymentInfo.swift_code}</p></div>}
                      </div>
                    )}
                    {paymentInfo.vat_account && (
                      <div>
                        <p className="text-sm font-medium text-muted-foreground">VAT</p>
                        <p className="text-sm mt-0.5">{paymentInfo.vat_account}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Manager contact</p>
                      <div className="text-sm mt-0.5 space-y-1">
                        {paymentInfo.manager_name && <p>{paymentInfo.manager_name}</p>}
                        {paymentInfo.manager_email && <p><a href={`mailto:${paymentInfo.manager_email}`} className="text-primary hover:underline">{paymentInfo.manager_email}</a></p>}
                        {paymentInfo.manager_phone && <p>{paymentInfo.manager_phone}</p>}
                        {!paymentInfo.manager_name && !paymentInfo.manager_email && !paymentInfo.manager_phone && <p className="text-muted-foreground">—</p>}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-muted-foreground">Payment methods</p>
                      <ul className="text-sm mt-0.5 list-disc list-inside space-y-1">
                        {paymentInfo.payment_methods?.map((m, i) => <li key={i}>{m}</li>) ?? <li>Contact your property manager for payment instructions.</li>}
                      </ul>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">Loading payment info...</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-4 mt-2">
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                  <CardTitle>My Bills ({myBills.length}{sortedBillsForDisplay.length !== myBills.length ? ` — showing ${sortedBillsForDisplay.length}` : ""})</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">One PDF and one slip per period. Actions apply to all bills in that period.</p>
                </div>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowBillingFilters(v => !v)} aria-label="Toggle filters">
                  <SlidersHorizontal className="size-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`grid transition-[grid-template-rows] duration-200 ${showBillingFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-wrap gap-2 items-end pb-3">
                      <div><Label className="text-xs">Period</Label>
                        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All periods</SelectItem>
                            {[...new Set(myBills.map(b => `${b.period_year}-${b.period_month}`))].sort((a,b)=>b.localeCompare(a)).slice(0,24).map(k => { const [y,m]=k.split("-"); return <SelectItem key={k} value={k}>{MONTHS[parseInt(m)-1]} {y}</SelectItem> })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Unit type</Label>
                        <Select value={filterUnitType} onValueChange={setFilterUnitType}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All types</SelectItem>{[...new Set(units.map(u=>u.type))].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Unit</Label>
                        <Select value={filterUnitId} onValueChange={setFilterUnitId}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All units</SelectItem>{units.map(u=><SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Status</Label>
                        <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem><SelectItem value="in_process">In process</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead><tr className="border-b text-left">
                    <SortableTh column="ref" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Reference</SortableTh>
                    <SortableTh column="period" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Period</SortableTh>
                    <SortableTh column="unit" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Unit</SortableTh>
                    <SortableTh column="amount" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground text-right" align="right">Amount</SortableTh>
                    <SortableTh column="status" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Status</SortableTh>
                    <SortableTh column="paidOn" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">Paid on</SortableTh>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">Invoice</th>
                    <th className="pb-3 font-medium text-muted-foreground">Action</th>
                  </tr></thead>
                  <tbody className="divide-y divide-border">
                    {(() => {
                      const byPeriod = new Map<string, typeof myBills>();
                      filteredBills.forEach(b => {
                        const k = `${b.period_year}-${String(b.period_month).padStart(2, "0")}`;
                        const list = byPeriod.get(k) ?? []; list.push(b); byPeriod.set(k, list);
                      });
                      const seenPeriod = new Set<string>();
                      return sortedBillsForDisplay.map(b => {
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
                    {(myBills.length === 0 || sortedBillsForDisplay.length === 0) && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{myBills.length === 0 ? "No bills yet." : "No bills match filters."}</td></tr>}
                  </tbody>
                </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="ledger">
          <Card className="mt-2">
            <CardHeader className="flex flex-row items-start justify-between gap-4">
              <CardTitle>Full Ledger ({ledgerRows.length}{filteredLedgerRows.length !== ledgerRows.length ? ` — showing ${filteredLedgerRows.length}` : ""} entries)</CardTitle>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowLedgerFilters(v => !v)} aria-label="Toggle filters">
                <SlidersHorizontal className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`grid transition-[grid-template-rows] duration-200 ${showLedgerFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="flex flex-wrap gap-2 items-end pb-3">
                    <div><Label className="text-xs">Period</Label>
                      <Select value={filterLedgerPeriod} onValueChange={setFilterLedgerPeriod}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All periods</SelectItem>
                          {[...new Set(ledgerRows.map(r => r.date.slice(0,7)))].sort((a,b)=>b.localeCompare(a)).slice(0,24).map(k => { const [y,m]=k.split("-"); return <SelectItem key={k} value={k}>{MONTHS[parseInt(m)-1]} {y}</SelectItem> })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Type</Label>
                      <Select value={filterLedgerType} onValueChange={setFilterLedgerType}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="income">Income</SelectItem><SelectItem value="expense">Expense</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">Status</Label>
                      <Select value={filterLedgerStatus} onValueChange={setFilterLedgerStatus}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="Paid">Paid</SelectItem><SelectItem value="Unpaid">Unpaid</SelectItem><SelectItem value="In process">In process</SelectItem><SelectItem value="Recurrent">Recurrent</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead><tr className="border-b text-left">
                  <SortableTh column="ref" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Reference</SortableTh>
                  <SortableTh column="date" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Period</SortableTh>
                  <SortableTh column="type" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Type</SortableTh>
                  <SortableTh column="label" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Description</SortableTh>
                  <SortableTh column="status" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Status</SortableTh>
                  <SortableTh column="amount" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground text-right" align="right">Amount</SortableTh>
                  <SortableTh column="balance" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 font-medium text-muted-foreground text-right" align="right">Running Balance</SortableTh>
                </tr></thead>
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
                  {(ledgerRows.length === 0 || rowsWithBalance.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{ledgerRows.length === 0 ? "No transactions yet." : "No transactions match filters."}</td></tr>}
                </tbody>
              </table>
              </div>
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
        </div>
      </Tabs>
    </div>
  );
}
