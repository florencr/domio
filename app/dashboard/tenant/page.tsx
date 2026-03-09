"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

type TenantData = {
  profile: { id: string; name: string; surname: string; email: string; role: string; phone?: string | null } | null;
  siteNames: string[];
  units: { id: string; unit_name: string; type: string; size_m2: number | null; building_id: string; entrance?: string | null; floor?: string | null }[];
  allUnits: { id: string; unit_name: string }[];
  buildings: { id: string; name: string; site_id?: string | null }[];
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
  const { locale } = useLocale();
  const [data, setData] = useState<TenantData>({ profile: null, siteNames: [], units: [], allUnits: [], buildings: [], bills: [], expenses: [], unitTenantAssignments: [] });
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
  const [showPaymentFilters, setShowPaymentFilters] = useState(false);
  const [filterPaymentPeriod, setFilterPaymentPeriod] = useState("all");
  const [filterPaymentUnitId, setFilterPaymentUnitId] = useState("all");
  const [paymentSortCol, setPaymentSortCol] = useState<string | null>(null);
  const [paymentSortDir, setPaymentSortDir] = useState<"asc" | "desc">("asc");
  const [paymentInfo, setPaymentInfo] = useState<{ site_name: string | null; bank_name: string | null; iban: string | null; swift_code: string | null; vat_account: string | null; manager_name: string | null; manager_email: string | null; manager_phone: string | null; payment_methods: string[] } | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {}
  }, []);
  const fileInputRef = useRef<HTMLInputElement>(null);
  type UploadTarget = { billId?: string; periodMonth?: number; periodYear?: number };
  const uploadTargetRef = useRef<UploadTarget>({});

  const load = async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const res = await fetch("/api/tenant/data", { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 401) router.push("/login");
      setLoading(false);
      return;
    }
    const json = await res.json().catch(() => ({}));
    let profile = json.profile ?? null;
    if (!profile) {
      const apiRes = await fetch("/api/profile");
      if (apiRes.ok) profile = (await apiRes.json()) as typeof profile;
    }
    setData({
      profile,
      siteNames: json.siteNames ?? [],
      units: json.units ?? [],
      allUnits: json.allUnits ?? [],
      buildings: json.buildings ?? [],
      bills: json.bills ?? [],
      expenses: json.expenses ?? [],
      unitTenantAssignments: json.unitTenantAssignments ?? [],
    });
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
      else { const err = await res.json().catch(() => ({})); setUploadError(err.error || t(locale, "tenant.couldNotRecordSlip")); }
    } else setUploadError(upErr.message || t(locale, "tenant.uploadFailed"));
    setUploadingFor(null);
  }

  const triggerFileInput = (target: UploadTarget) => {
    if (fileInputRef.current) { uploadTargetRef.current = target; fileInputRef.current.click(); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">{t(locale, "common.loading")}</p></div>
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
    ...expenses.filter(e => e.period_month != null).map(e => ({ key:`e-${e.id}`, date: `${e.period_year!}-${String(e.period_month!).padStart(2,"0")}`, type:"expense" as const, label:`${e.title} · ${e.vendor}`, ref: (e as {reference_code?: string}).reference_code ?? expenseRef(e), amount: Number(e.amount), status: (e as {paid_at?: string | null}).paid_at ? "Paid" : "Unpaid" })),
  ];
  const getUnitValue = (u: { id: string; unit_name: string; building_id: string; type: string; size_m2: number | null; entrance?: string | null; floor?: string | null }, col: string): string | number => {
    switch (col) { case "unit": return u.unit_name; case "building": return buildingMap.get(u.building_id) ?? ""; case "type": return u.type; case "entrance": return u.entrance ?? ""; case "floor": return u.floor ?? ""; case "size": return u.size_m2 ?? 0; default: return ""; }
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

  const myPaidBills = myBills.filter(b => b.paid_at);
  let paidRaw = myPaidBills;
  if (filterPaymentPeriod !== "all") {
    const [y, m] = filterPaymentPeriod.split("-").map(Number);
    paidRaw = paidRaw.filter(b => b.period_year === y && b.period_month === m);
  }
  if (filterPaymentUnitId !== "all") paidRaw = paidRaw.filter(b => b.unit_id === filterPaymentUnitId);
  const getPaidValue = (b: typeof myPaidBills[0], col: string): string | number => {
    switch (col) {
      case "ref": return ((b as { reference_code?: string }).reference_code ?? "") as string;
      case "paidOn": return new Date(b.paid_at!).getTime();
      case "unit": return (unitMap.get(b.unit_id)?.unit_name ?? "") as string;
      case "period": return b.period_year * 100 + b.period_month;
      case "amount": return Math.abs(Number(b.total_amount));
      default: return "";
    }
  };
  const paidSorted = paymentSortCol ? sortBy(paidRaw, paymentSortCol, paymentSortDir, getPaidValue) : [...paidRaw].sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime());
  const totalPaidByTenant = myPaidBills.reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const handlePaymentSort = (col: string) => { setPaymentSortDir(prev => paymentSortCol === col && prev === "asc" ? "desc" : "asc"); setPaymentSortCol(col); };

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <input type="file" ref={fileInputRef} accept="image/*,.pdf" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; const t = uploadTargetRef.current; if (f && (t.billId || (t.periodMonth != null && t.periodYear != null))) uploadSlip(t, f); e.target.value = ""; }} />
      <header className="sticky top-0 z-30 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-4 md:static md:mx-0 md:mt-0 md:px-0 md:pt-0 md:pb-0 md:mb-6 bg-white/90 dark:bg-background/90 backdrop-blur-sm md:bg-transparent flex items-center justify-between">
        <Link href="/dashboard/tenant" className="flex items-center gap-2">
          <DomioLogo className="h-9 w-auto shrink-0" />
          <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">{t(locale, "tenant.tenantDashboard")}</span>
        </Link>
        <div className="flex items-center gap-2">
          <Link href="/dashboard/tenant/preferences">
            <Button variant="ghost" size="icon" title={t(locale, "common.preferences")}><SlidersHorizontal className="size-5" /></Button>
          </Link>
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
                <p className="text-sm text-muted-foreground capitalize">{t(locale, "common.role")}: {profile?.role}</p>
                <p className="text-sm text-muted-foreground">{t(locale, "common.site")}: {data.siteNames?.length ? data.siteNames.join(", ") : "—"}</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.phone && <p className="text-sm text-muted-foreground"><a href={`tel:${profile.phone.replace(/[\s\-\(\)\.]/g, "")}`} className="text-primary hover:underline">{profile.phone}</a></p>}
              </div>
              <DropdownMenuSeparator />
              <Link href="/dashboard/tenant/preferences">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <SlidersHorizontal className="size-4" />
                  {t(locale, "common.preferences")}
                </DropdownMenuItem>
              </Link>
              <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer">
                <LogOut className="size-4" />
                {t(locale, "common.logout")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {myBills.filter(b => !b.paid_at).length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="text-sm">
            {myBills.filter(b => !b.paid_at).length === 1 ? t(locale, "owner.unpaidBillsAlert", { count: "1", total: outstanding.toFixed(2) }) : t(locale, "owner.unpaidBillsAlertPlural", { count: String(myBills.filter(b => !b.paid_at).length), total: outstanding.toFixed(2) })}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Card className="border-l-4 border-l-green-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-green-600 shrink-0">{collected.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "manager.collected")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t(locale, "tenant.collectedFromPaidBills", { count: String(myBills.filter(b=>b.paid_at).length) })}</p>
          </div>
        </Card>
        <Card className="border-l-4 border-l-red-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-red-600 shrink-0">{outstanding.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "manager.outstanding")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t(locale, "manager.outstandingFrom", { count: String(myBills.filter(b=>!b.paid_at).length) })}</p>
          </div>
        </Card>
        <Card className="border-l-4 border-l-orange-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-orange-600 shrink-0">{monthlyExpenses.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "manager.monthlyExpenses")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t(locale, "manager.expenseRecords", { count: String(expenseRecords.length) })}</p>
          </div>
        </Card>
        <Card className={`border-l-4 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start ${netFund >= 0 ? "border-l-blue-500" : "border-l-amber-500"}`}>
          <p className={`text-xl font-extrabold shrink-0 ${netFund >= 0 ? "text-blue-600" : "text-amber-600"}`}>{netFund.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "manager.netFund")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{t(locale, "manager.collectedMinusExpenses")}</p>
          </div>
        </Card>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <div className="hidden md:block mb-2">
          <TabsList className="grid w-full grid-cols-5 max-w-2xl">
            <TabsTrigger value="units" className="flex items-center gap-2"><Home className="size-4" />{t(locale, "nav.owner.myUnits")}</TabsTrigger>
            <TabsTrigger value="billing" className="flex items-center gap-2"><FileText className="size-4" />{t(locale, "nav.owner.billing")}</TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2"><CreditCard className="size-4" />{t(locale, "nav.owner.payments")}</TabsTrigger>
            <TabsTrigger value="ledger" className="flex items-center gap-2"><BookOpen className="size-4" />{t(locale, "nav.owner.ledger")}</TabsTrigger>
            <TabsTrigger value="notifications" className="flex items-center gap-2"><Bell className="size-4" />{t(locale, "nav.owner.notifications")}</TabsTrigger>
          </TabsList>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-20 md:hidden bg-muted/90 border-t px-4 pt-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <TabsList className="grid w-full grid-cols-4 h-12 min-h-[48px] p-1.5 rounded-lg">
            <TabsTrigger value="units" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><Home className="size-4" />{t(locale, "nav.owner.myUnits")}</TabsTrigger>
            <TabsTrigger value="billing" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><FileText className="size-4" />{t(locale, "nav.owner.billing")}</TabsTrigger>
            <TabsTrigger value="payments" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><CreditCard className="size-4" />{t(locale, "nav.owner.payments")}</TabsTrigger>
            <TabsTrigger value="ledger" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><BookOpen className="size-4" />{t(locale, "nav.owner.ledger")}</TabsTrigger>
          </TabsList>
        </div>
        <div className="pb-24 md:pb-0">
        <TabsContent value="units">
          <div className="space-y-4 mt-2">
          <Card>
            <CardHeader><CardTitle>{t(locale, "headers.myUnits")} ({units.length})</CardTitle></CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-full text-sm table-fixed">
                <colgroup>
                  <col style={{ width: "16%" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                  <col style={{ width: "12%" }} />
                </colgroup>
                <thead><tr className="border-b text-left">
                  <SortableTh column="unit" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.unit")}</SortableTh>
                  <SortableTh column="building" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.building")}</SortableTh>
                  <SortableTh column="type" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.type")}</SortableTh>
                  <SortableTh column="entrance" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} align="center" className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.entrance")}</SortableTh>
                  <SortableTh column="floor" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} align="center" className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.floor")}</SortableTh>
                  <SortableTh column="size" sortCol={unitsSortCol} sortDir={unitsSortDir} onSort={handleUnitsSort} align="center" className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.sizeM2")}</SortableTh>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {sortedUnits.map(u => (
                    <tr key={u.id} className="hover:bg-muted/30">
                      <td className="py-3 pr-4 font-medium">{u.unit_name}</td>
                      <td className="py-3 pr-4 text-muted-foreground">{buildingMap.get(u.building_id) ?? "—"}</td>
                      <td className="py-3 pr-4"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{u.type}</span></td>
                      <td className="py-3 pr-4 text-center text-muted-foreground">{u.entrance ?? "—"}</td>
                      <td className="py-3 pr-4 text-center text-muted-foreground">{u.floor ?? "—"}</td>
                      <td className="py-3 pr-4 text-center">{u.size_m2 ?? "—"}</td>
                    </tr>
                  ))}
                  {!units.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{t(locale, "tenant.noUnitsAssigned")}</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments">
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Card className="border-l-4 border-l-green-500 py-3 gap-1 px-4">
                <CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "tenant.totalPaidByTenant")}</CardTitle></CardHeader>
                <CardContent className="pb-2 pt-0 px-0"><p className="text-lg font-extrabold text-green-600">{totalPaidByTenant.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-0.5">{t(locale, "owner.paymentsReceived", { count: String(myPaidBills.length) })}</p></CardContent>
              </Card>
              <Card className="py-3 gap-1 px-4">
                <CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "owner.managerContacts")}</CardTitle></CardHeader>
                <CardContent className="pb-2 pt-0 px-0 space-y-1">
                  {paymentInfo ? (
                    (paymentInfo.manager_name || paymentInfo.manager_email || paymentInfo.manager_phone || paymentInfo.vat_account) ? (
                      <>
                        {paymentInfo.manager_name && <p className="text-sm font-medium">{paymentInfo.manager_name}</p>}
                        {paymentInfo.manager_email && <p><a href={`mailto:${paymentInfo.manager_email}`} className="text-sm text-primary hover:underline">{paymentInfo.manager_email}</a></p>}
                        {paymentInfo.manager_phone && <p><a href={`tel:${paymentInfo.manager_phone.replace(/[\s\-\(\)\.]/g, "")}`} className="text-sm text-primary hover:underline">{paymentInfo.manager_phone}</a></p>}
                        {paymentInfo.vat_account && <p className="select-text"><span className="text-xs font-medium text-muted-foreground">{t(locale, "invoice.vat")} </span><span role="button" tabIndex={0} onClick={() => copyToClipboard(paymentInfo.vat_account!, "vat")} onKeyDown={(e) => e.key === "Enter" && copyToClipboard(paymentInfo.vat_account!, "vat")} className="text-sm cursor-pointer hover:underline">{paymentInfo.vat_account}</span>{copiedField === "vat" && <span className="text-xs text-green-600 ml-1">{t(locale, "common.copied")}</span>}</p>}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">—</p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">{t(locale, "common.loading")}</p>
                  )}
                </CardContent>
              </Card>
              <Card className="py-3 gap-1 px-4">
                <CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "owner.bankAccountInfo")}</CardTitle></CardHeader>
                <CardContent className="pb-2 pt-0 px-0 space-y-1">
                  {paymentInfo ? (
                    (paymentInfo.bank_name || paymentInfo.iban || paymentInfo.swift_code) ? (
                      <div className="text-sm select-text break-words space-y-1">
                        {paymentInfo.bank_name && <p><span className="text-muted-foreground">Bank Name: </span><span>{paymentInfo.bank_name}</span></p>}
                        {paymentInfo.iban && <p><span className="text-muted-foreground">IBAN: </span><span role="button" tabIndex={0} onClick={() => copyToClipboard(paymentInfo.iban!, "iban")} onKeyDown={(e) => e.key === "Enter" && copyToClipboard(paymentInfo.iban!, "iban")} className="cursor-pointer hover:underline">{paymentInfo.iban}</span>{copiedField === "iban" && <span className="text-xs text-green-600 ml-1">{t(locale, "common.copied")}</span>}</p>}
                        {paymentInfo.swift_code && <p><span className="text-muted-foreground">Swift: </span><span>{paymentInfo.swift_code}</span></p>}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{t(locale, "owner.contactManagerForPayment")}</p>
                    )
                  ) : (
                    <p className="text-sm text-muted-foreground">{t(locale, "common.loading")}</p>
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader className="flex flex-row items-start justify-between gap-4">
                <CardTitle>{t(locale, "owner.paymentHistory")} ({paidSorted.length}{paidRaw.length !== myPaidBills.length ? ` ${t(locale, "owner.of")} ${myPaidBills.length}` : ""})</CardTitle>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowPaymentFilters(v => !v)} aria-label={t(locale, "common.toggleFilters")}>
                  <SlidersHorizontal className="size-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`grid transition-[grid-template-rows] duration-200 ${showPaymentFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-wrap gap-2 items-end pb-3">
                      <div><Label className="text-xs">{t(locale, "table.period")}</Label>
                        <Select value={filterPaymentPeriod} onValueChange={setFilterPaymentPeriod}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">{t(locale, "filters.allPeriods")}</SelectItem>
                            {[...new Set(myPaidBills.map(b => `${b.period_year}-${b.period_month}`))].sort((a, b) => b.localeCompare(a)).slice(0, 24).map(k => { const [y, m] = k.split("-"); return <SelectItem key={k} value={k}>{t(locale, `common.month${parseInt(m || "1")}`)} {y}</SelectItem> })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">{t(locale, "table.unit")}</Label>
                        <Select value={filterPaymentUnitId} onValueChange={setFilterPaymentUnitId}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">{t(locale, "filters.allUnits")}</SelectItem>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full text-sm table-fixed">
                    <thead><tr className="border-b text-left">
                      <SortableTh column="ref" sortCol={paymentSortCol} sortDir={paymentSortDir} onSort={handlePaymentSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.reference")}</SortableTh>
                      <SortableTh column="paidOn" sortCol={paymentSortCol} sortDir={paymentSortDir} onSort={handlePaymentSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.paidOn")}</SortableTh>
                      <SortableTh column="unit" sortCol={paymentSortCol} sortDir={paymentSortDir} onSort={handlePaymentSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.unit")}</SortableTh>
                      <SortableTh column="period" sortCol={paymentSortCol} sortDir={paymentSortDir} onSort={handlePaymentSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.period")}</SortableTh>
                      <SortableTh column="amount" sortCol={paymentSortCol} sortDir={paymentSortDir} onSort={handlePaymentSort} className="pb-3 font-medium text-muted-foreground" align="right">{t(locale, "table.amount")}</SortableTh>
                    </tr></thead>
                    <tbody className="divide-y divide-border">
                      {paidSorted.map(b => (
                        <tr key={b.id} className="hover:bg-muted/30">
                          <td className="py-3 pr-4 font-mono text-xs select-text">{(b as { reference_code?: string }).reference_code ?? "—"}</td>
                          <td className="py-3 pr-4 font-medium">{new Date(b.paid_at!).toLocaleDateString()}</td>
                          <td className="py-3 pr-4">{unitMap.get(b.unit_id)?.unit_name ?? "—"}</td>
                          <td className="py-3 pr-4 text-muted-foreground">{t(locale, `common.month${b.period_month}`)} {b.period_year}</td>
                          <td className="py-3 text-right font-semibold text-green-600">{Number(b.total_amount).toFixed(2)}</td>
                        </tr>
                      ))}
                      {!paidSorted.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{paidRaw.length === 0 && myPaidBills.length > 0 ? t(locale, "owner.noPaymentsMatchFilters") : t(locale, "owner.noPaymentsYet")}</td></tr>}
                    </tbody>
                  </table>
                </div>
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
                  <CardTitle>{t(locale, "headers.myBills")} ({myBills.length}{sortedBillsForDisplay.length !== myBills.length ? ` — ${t(locale, "ledger.showing")} ${sortedBillsForDisplay.length}` : ""})</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{t(locale, "headers.myBillsDescription")}</p>
                </div>
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowBillingFilters(v => !v)} aria-label={t(locale, "common.toggleFilters")}>
                  <SlidersHorizontal className="size-4" />
                </Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className={`grid transition-[grid-template-rows] duration-200 ${showBillingFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
                  <div className="min-h-0 overflow-hidden">
                    <div className="flex flex-wrap gap-2 items-end pb-3">
                      <div><Label className="text-xs">{t(locale, "table.period")}</Label>
                        <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">{t(locale, "filters.allPeriods")}</SelectItem>
                            {[...new Set(myBills.map(b => `${b.period_year}-${b.period_month}`))].sort((a,b)=>b.localeCompare(a)).slice(0,24).map(k => { const [y,m]=k.split("-"); return <SelectItem key={k} value={k}>{t(locale, `common.month${parseInt(m)}`)} {y}</SelectItem> })}
                          </SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">Unit type</Label>
                        <Select value={filterUnitType} onValueChange={setFilterUnitType}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">All types</SelectItem>{[...new Set(units.map(u=>u.type))].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">{t(locale, "table.unit")}</Label>
                        <Select value={filterUnitId} onValueChange={setFilterUnitId}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">{t(locale, "filters.allUnits")}</SelectItem>{units.map(u=><SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
                        </Select>
                      </div>
                      <div><Label className="text-xs">{t(locale, "table.status")}</Label>
                        <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                          <SelectContent><SelectItem value="all">{t(locale, "common.all")}</SelectItem><SelectItem value="paid">{t(locale, "filters.paid")}</SelectItem><SelectItem value="unpaid">{t(locale, "filters.unpaid")}</SelectItem><SelectItem value="in_process">{t(locale, "filters.inProcess")}</SelectItem></SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="overflow-x-auto">
                <table className="w-full min-w-full text-sm table-fixed">
                  <thead><tr className="border-b text-left">
                    <SortableTh column="ref" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.reference")}</SortableTh>
                    <SortableTh column="period" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.period")}</SortableTh>
                    <SortableTh column="unit" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.unit")}</SortableTh>
                    <SortableTh column="amount" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground text-right" align="right">{t(locale, "table.amount")}</SortableTh>
                    <SortableTh column="status" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.status")}</SortableTh>
                    <SortableTh column="paidOn" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.paidOn")}</SortableTh>
                    <th className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "owner.pdf")}</th>
                    <th className="pb-3 font-medium text-muted-foreground">{t(locale, "table.action")}</th>
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
                            <td className="py-3 pr-4 font-mono text-xs select-text">{(b as { reference_code?: string }).reference_code ?? "—"}</td>
                            <td className="py-3 pr-4 font-medium">{t(locale, `common.month${b.period_month}`)} {b.period_year}</td>
                            <td className="py-3 pr-4 text-muted-foreground">{unitMap.get(b.unit_id)?.unit_name ?? "—"}</td>
                            <td className="py-3 pr-4 text-right font-semibold">{Number(b.total_amount).toFixed(2)}</td>
                            <td className="py-3 pr-4">
                              {b.paid_at ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ {t(locale, "filters.paid")}</span> : b.status === "in_process" ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "filters.inProcess")}</span> : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "filters.unpaid")}</span>}
                            </td>
                            <td className="py-3 pr-4 text-muted-foreground text-xs">{b.paid_at ? new Date(b.paid_at).toLocaleDateString() : "—"}</td>
                            <td className="py-3 pr-4">
                              {isFirstInPeriod ? (
                                <a href={`/api/invoice?periodMonth=${b.period_month}&periodYear=${b.period_year}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><Download className="size-3" /> {t(locale, "owner.pdf")}</a>
                              ) : "—"}
                            </td>
                            <td className="py-3">
                              {isFirstInPeriod ? (
                                <div className="flex flex-col gap-1">
                                  {anyReceipt && (
                                    <a href={`/api/receipt?billId=${bills[0].id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><FileText className="size-3" /> {t(locale, "owner.view")}</a>
                                  )}
                                  {!b.paid_at && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs w-fit" disabled={!!uploadingFor} onClick={() => triggerFileInput({ periodMonth: b.period_month, periodYear: b.period_year })}>
                                      {uploadingFor === uploadKey ? t(locale, "owner.uploading") : <><Camera className="size-3 mr-1" /> {anyReceipt ? t(locale, "owner.uploadNewSlip") : t(locale, "owner.uploadSlip")}</>}
                                    </Button>
                                  )}
                                </div>
                              ) : "—"}
                            </td>
                          </tr>
                        );
                      });
                    })()}
                    {(myBills.length === 0 || sortedBillsForDisplay.length === 0) && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{myBills.length === 0 ? t(locale, "tenant.noBillsYet") : t(locale, "tenant.noBillsMatchFilters")}</td></tr>}
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
              <CardTitle>{t(locale, "headers.fullLedger")} ({ledgerRows.length}{filteredLedgerRows.length !== ledgerRows.length ? ` — ${t(locale, "ledger.showing")} ${filteredLedgerRows.length}` : ""} {t(locale, "headers.entries")})</CardTitle>
              <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowLedgerFilters(v => !v)} aria-label={t(locale, "common.toggleFilters")}>
                <SlidersHorizontal className="size-4" />
              </Button>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className={`grid transition-[grid-template-rows] duration-200 ${showLedgerFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="flex flex-wrap gap-2 items-end pb-3">
                    <div><Label className="text-xs">{t(locale, "table.period")}</Label>
                      <Select value={filterLedgerPeriod} onValueChange={setFilterLedgerPeriod}>
                        <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">{t(locale, "filters.allPeriods")}</SelectItem>
                          {[...new Set(ledgerRows.map(r => r.date.slice(0,7)))].sort((a,b)=>b.localeCompare(a)).slice(0,24).map(k => { const [y,m]=k.split("-"); return <SelectItem key={k} value={k}>{t(locale, `common.month${parseInt(m)}`)} {y}</SelectItem> })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">{t(locale, "table.type")}</Label>
                      <Select value={filterLedgerType} onValueChange={setFilterLedgerType}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">{t(locale, "common.all")}</SelectItem><SelectItem value="income">{t(locale, "tenant.income")}</SelectItem><SelectItem value="expense">{t(locale, "tenant.expense")}</SelectItem></SelectContent>
                      </Select>
                    </div>
                    <div><Label className="text-xs">{t(locale, "table.status")}</Label>
                      <Select value={filterLedgerStatus} onValueChange={setFilterLedgerStatus}>
                        <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="all">{t(locale, "common.all")}</SelectItem><SelectItem value="Paid">{t(locale, "filters.paid")}</SelectItem><SelectItem value="Unpaid">{t(locale, "filters.unpaid")}</SelectItem><SelectItem value="In process">{t(locale, "filters.inProcess")}</SelectItem></SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-full text-sm table-fixed">
                <thead><tr className="border-b text-left">
                  <SortableTh column="ref" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.reference")}</SortableTh>
                  <SortableTh column="date" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.period")}</SortableTh>
                  <SortableTh column="type" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.type")}</SortableTh>
                  <SortableTh column="label" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.description")}</SortableTh>
                  <SortableTh column="status" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.status")}</SortableTh>
                  <SortableTh column="amount" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground text-right" align="right">{t(locale, "table.amount")}</SortableTh>
                  <SortableTh column="balance" sortCol={ledgerSortCol} sortDir={ledgerSortDir} onSort={handleLedgerSort} className="pb-3 font-medium text-muted-foreground text-right" align="right">{t(locale, "table.runningBalance")}</SortableTh>
                </tr></thead>
                <tbody className="divide-y divide-border">
                  {rowsWithBalance.map(r => (
                    <tr key={r.key} className="hover:bg-muted/30">
                      <td className="py-3 pr-4 font-mono text-xs">{r.ref}</td>
                      <td className="py-3 pr-4 text-muted-foreground font-medium">{periodLabel(r.date)}</td>
                      <td className="py-3 pr-4">
                        {r.type === "income" ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "tenant.bill")}</span> : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "tenant.expense")}</span>}
                      </td>
                      <td className="py-3 pr-4">{r.label}</td>
                      <td className="py-3 pr-4 text-muted-foreground text-xs capitalize">{r.status}</td>
                      <td className={`py-3 pr-4 text-right font-semibold ${r.type==="income"?"text-green-600":"text-red-600"}`}>{r.type==="income"?"+":"-"}{r.amount.toFixed(2)}</td>
                      <td className={`py-3 text-right font-mono text-sm ${r.balance>=0?"text-blue-600":"text-red-600"}`}>{r.balance.toFixed(2)}</td>
                    </tr>
                  ))}
                  {(ledgerRows.length === 0 || rowsWithBalance.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{ledgerRows.length === 0 ? t(locale, "tenant.noTransactionsYet") : t(locale, "tenant.noTransactionsMatchFilters")}</td></tr>}
                </tbody>
              </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card className="mt-2">
            <CardHeader><CardTitle>{t(locale, "notifications.bellTitle")} ({notifications.length})</CardTitle></CardHeader>
            <CardContent>
              {notifications.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{t(locale, "notifications.noNotificationsYet")}</p>
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
