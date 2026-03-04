"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import Link from "next/link";
import { LogOut, Settings, User, FileText, Wallet, CreditCard, BookOpen, SlidersHorizontal, ChevronDown, ChevronUp, Paperclip, X } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { DomioLogo } from "@/components/DomioLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";

// ─── Types ──────────────────────────────────────────────────────────────
type Profile = { id: string; name: string; surname: string; email: string; role: string; phone?: string | null; avatar_url?: string | null };
type Building = { id: string; name: string; site_id?: string | null };
type Site = { id: string; name: string; address?: string };
type Unit = { id: string; unit_name: string; type: string; size_m2: number | null; building_id: string; entrance: string | null; floor: string | null };
type Service = { id: string; name: string; unit_type: string; pricing_model: string; price_value: number; frequency: string; category?: string | null };
type Expense = { id: string; title: string; category: string; vendor: string; amount: number; frequency: string; created_at?: string | null; paid_at?: string | null; period_month?: number | null; period_year?: number | null; template_id?: string | null; reference_code?: string | null };
type UnitType = { id: string; name: string };
type Vendor = { id: string; name: string };
type ServiceCategory = { id: string; name: string };
type Bill = { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; status: string; paid_at: string | null; receipt_url?: string | null; receipt_filename?: string | null; receipt_path?: string | null; reference_code?: string | null };
type UnitOwner = { unit_id: string; owner_id: string };
type UnitTenantAssignment = { unit_id: string; tenant_id: string; is_payment_responsible?: boolean };

type Data = {
  profile: Profile | null;
  site: Site | null;
  buildings: Building[]; units: Unit[]; services: Service[];
  expenses: Expense[]; profiles: Profile[]; unitTypes: UnitType[];
  vendors: Vendor[]; serviceCategories: ServiceCategory[];
  bills: Bill[]; unitOwners: UnitOwner[]; unitTenantAssignments: UnitTenantAssignment[];
};

const EMPTY: Data = {
  profile: null, site: null, buildings: [], units: [], services: [], expenses: [],
  profiles: [], unitTypes: [], vendors: [], serviceCategories: [],
  bills: [], unitOwners: [], unitTenantAssignments: [],
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Bill generation can be deleted only for current month. */
function isPeriodCurrent(periodMonth: number, periodYear: number): boolean {
  const now = new Date();
  return periodMonth === now.getMonth() + 1 && periodYear === now.getFullYear();
}

/** Period editable for generate (current or previous month). */
function isPeriodEditable(periodMonth: number, periodYear: number): boolean {
  const now = new Date();
  const curM = now.getMonth() + 1, curY = now.getFullYear();
  const prevM = curM === 1 ? 12 : curM - 1, prevY = curM === 1 ? curY - 1 : curY;
  return (periodMonth === curM && periodYear === curY) || (periodMonth === prevM && periodYear === prevY);
}

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

// ─── Send Notification Form ─────────────────────────────────────────────
function SendNotificationForm({ unitTypes, onClose }: { unitTypes: UnitType[]; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetAudience, setTargetAudience] = useState<"owners" | "tenants" | "both">("both");
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<string[]>([]);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });

  const toggleUnitType = (name: string) => {
    setSelectedUnitTypes(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  };

  async function send() {
    if (!title.trim()) { setMsg({ text: "Enter a title", ok: false }); return; }
    setSending(true);
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim() || null,
        targetAudience,
        targetUnitTypes: selectedUnitTypes.length > 0 ? selectedUnitTypes : null,
        unpaidOnly,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok && json.success) {
      setMsg({ text: `Sent to ${json.recipients ?? 0} recipients`, ok: true });
      setTimeout(() => { setTitle(""); setBody(""); setSelectedUnitTypes([]); setUnpaidOnly(false); onClose(); }, 800);
    } else {
      setMsg({ text: json.error || "Failed to send", ok: false });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-md m-4" onClick={e => e.stopPropagation()}>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Send Notification</CardTitle>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Payment reminder" className="mt-1" />
          </div>
          <div>
            <Label>Message (optional)</Label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." rows={3} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1" />
          </div>
          <div>
            <Label>Send to</Label>
            <Select value={targetAudience} onValueChange={(v: "owners" | "tenants" | "both") => setTargetAudience(v)}>
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owners">Owners only</SelectItem>
                <SelectItem value="tenants">Tenants only</SelectItem>
                <SelectItem value="both">Owners and Tenants</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {unitTypes.length > 0 && (
            <div>
              <Label>Filter by unit type (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {unitTypes.map(ut => (
                  <button key={ut.id} type="button" onClick={() => toggleUnitType(ut.name)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${selectedUnitTypes.includes(ut.name) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 hover:bg-muted"}`}>
                    {ut.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="unpaid" checked={unpaidOnly} onChange={e => setUnpaidOnly(e.target.checked)} className="rounded" />
            <Label htmlFor="unpaid" className="cursor-pointer">Only users with unpaid bills</Label>
          </div>
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
          <div className="flex gap-2">
            <Button onClick={send} disabled={sending}>{sending ? "Sending..." : "Send"}</Button>
            <Button variant="outline" onClick={onClose}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────
export default function ManagerPage() {
  const router = useRouter();
  const [data, setData] = useState<Data>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("billing");
  const [showSendNotif, setShowSendNotif] = useState(false);
  const [configSubTab, setConfigSubTab] = useState("buildings");

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const results = await Promise.all([
      sb.from("profiles").select("id,name,surname,email,role,phone,avatar_url").eq("id", user.id).single(),
      sb.from("sites").select("id,name,address").eq("manager_id", user.id).maybeSingle(),
      sb.from("buildings").select("id,name,site_id"),
      sb.from("units").select("id,unit_name,type,size_m2,building_id,entrance,floor"),
      sb.from("services").select("id,name,unit_type,pricing_model,price_value,frequency,category,site_id"),
      sb.from("expenses").select("id,title,category,vendor,amount,frequency,created_at,paid_at,period_month,period_year,template_id,site_id"),
      sb.from("profiles").select("id,name,surname,email,role,phone,avatar_url"),
      sb.from("unit_types").select("id,name,site_id"),
      sb.from("vendors").select("id,name,site_id"),
      sb.from("service_categories").select("id,name,site_id"),
      sb.from("bills").select("id,unit_id,period_month,period_year,total_amount,status,paid_at,receipt_url,receipt_filename,receipt_path,reference_code").order("period_year",{ascending:false}).order("period_month",{ascending:false}).limit(200),
      sb.from("unit_owners").select("unit_id,owner_id"),
      sb.from("unit_tenant_assignments").select("unit_id,tenant_id,is_payment_responsible"),
    ]);

    const profile = results[0].data as Profile | null;
    if (profile?.role !== "manager") { router.push("/dashboard"); return; }

    const site = (results[1].data ?? null) as Site | null;
    const siteId = site?.id ?? null;
    const buildingsData = (results[2].data ?? []) as Building[];
    const allUnits = (results[3].data ?? []) as Unit[];
    const allServices = (results[4].data ?? []) as Service[];
    const allExpenses = (results[5].data ?? []) as Expense[];
    const allUnitTypes = (results[7].data ?? []) as UnitType[];
    const allVendors = (results[8].data ?? []) as Vendor[];
    const allServiceCategories = (results[9].data ?? []) as ServiceCategory[];

    const buildings = siteId ? buildingsData.filter(b => b.site_id === siteId) : buildingsData;
    const buildingIds = new Set(buildings.map(b => b.id));
    const units = siteId ? allUnits.filter(u => buildingIds.has(u.building_id)) : allUnits;
    const unitIds = new Set(units.map(u => u.id));
    const unitOwnersFiltered = siteId ? (results[11].data ?? []).filter((uo: UnitOwner) => unitIds.has(uo.unit_id)) as UnitOwner[] : (results[11].data ?? []) as UnitOwner[];
    const unitTenantAssignmentsFiltered = siteId ? (results[12].data ?? []).filter((a: UnitTenantAssignment) => unitIds.has(a.unit_id)) as UnitTenantAssignment[] : (results[12].data ?? []) as UnitTenantAssignment[];
    const siteUserIds = new Set([...unitOwnersFiltered.map((uo: UnitOwner) => uo.owner_id), ...unitTenantAssignmentsFiltered.map((a: UnitTenantAssignment) => a.tenant_id)]);
    const allProfiles = (results[6].data ?? []) as Profile[];
    const profiles = siteId ? allProfiles.filter(p => siteUserIds.has(p.id)) : allProfiles;
    const services = siteId ? allServices.filter((s: Service & { site_id?: string | null }) => !s.site_id || s.site_id === siteId) : allServices;
    const expenses = siteId ? allExpenses.filter((e: Expense & { site_id?: string | null }) => !e.site_id || e.site_id === siteId) : allExpenses;
    const unitTypes = siteId ? allUnitTypes.filter((ut: UnitType & { site_id?: string | null }) => !ut.site_id || ut.site_id === siteId) : allUnitTypes;
    const vendors = siteId ? allVendors.filter((v: Vendor & { site_id?: string | null }) => !v.site_id || v.site_id === siteId) : allVendors;
    const serviceCategories = siteId ? allServiceCategories.filter((c: ServiceCategory & { site_id?: string | null }) => !c.site_id || c.site_id === siteId) : allServiceCategories;

    setData({
      profile,
      site,
      buildings,
      units,
      services,
      expenses,
      profiles,
      unitTypes,
      vendors,
      serviceCategories,
      bills: siteId ? (results[10].data ?? []).filter((b: Bill) => unitIds.has(b.unit_id)) as Bill[] : (results[10].data ?? []) as Bill[],
      unitOwners: unitOwnersFiltered,
      unitTenantAssignments: unitTenantAssignmentsFiltered,
    });
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  const { profile, bills, expenses } = data;
  const collected = bills.filter(b => b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const outstanding = bills.filter(b => !b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const expenseRecords = expenses.filter(e => e.period_month != null);
  const monthlyExpenses = expenseRecords.reduce((s, e) => s + Number(e.amount), 0);
  const netFund = collected - monthlyExpenses;

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      {showSendNotif && <SendNotificationForm unitTypes={data.unitTypes} onClose={() => setShowSendNotif(false)} />}
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/manager" className="flex items-center gap-2">
            <DomioLogo className="h-9 w-auto" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">{data.site?.name ? `${data.site.name} Manager` : "Manager"}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell isManager onSendClick={() => { setTab("config"); setConfigSubTab("notifications"); setShowSendNotif(false); }} onSeeAllClick={() => { setTab("config"); setConfigSubTab("notifications"); }} />
          <Button variant="ghost" size="icon" onClick={() => setTab("config")} title="Configuration"><Settings className="size-5" /></Button>
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
              <DropdownMenuItem onClick={signOut} className="gap-2 cursor-pointer">
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Card className="border-l-4 border-l-green-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-green-600 shrink-0">{collected.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Collected</p>
            <p className="text-xs text-muted-foreground mt-0.5">From {bills.filter(b=>b.paid_at).length} paid bills</p>
          </div>
        </Card>
        <Card className="border-l-4 border-l-red-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-red-600 shrink-0">{outstanding.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Outstanding</p>
            <p className="text-xs text-muted-foreground mt-0.5">From {bills.filter(b=>!b.paid_at).length} unpaid bills</p>
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
            <TabsTrigger value="billing" className="flex items-center gap-2"><FileText className="size-4" />Billing</TabsTrigger>
            <TabsTrigger value="expenses" className="flex items-center gap-2"><Wallet className="size-4" />Expenses</TabsTrigger>
            <TabsTrigger value="payments" className="flex items-center gap-2"><CreditCard className="size-4" />Payments</TabsTrigger>
            <TabsTrigger value="ledger" className="flex items-center gap-2"><BookOpen className="size-4" />Ledger</TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2"><Settings className="size-4" />Config</TabsTrigger>
          </TabsList>
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-20 md:hidden bg-muted/90 border-t px-4 pt-1.5 pb-4">
          <TabsList className="grid w-full grid-cols-4 h-12 min-h-[48px] p-1.5 rounded-lg">
            <TabsTrigger value="billing" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><FileText className="size-4" />Billing</TabsTrigger>
            <TabsTrigger value="expenses" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><Wallet className="size-4" />Expenses</TabsTrigger>
            <TabsTrigger value="payments" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><CreditCard className="size-4" />Payments</TabsTrigger>
            <TabsTrigger value="ledger" className="py-2.5 text-xs font-semibold flex flex-col items-center gap-0.5"><BookOpen className="size-4" />Ledger</TabsTrigger>
          </TabsList>
        </div>
        <div className="pb-24 md:pb-0">
        <TabsContent value="billing"><BillingTab data={data} reload={load} addBills={newBills => setData(prev => ({ ...prev, bills: [...(prev.bills || []), ...newBills] }))} /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab data={data} reload={load} /></TabsContent>
        <TabsContent value="payments"><PaymentsTab bills={data.bills} units={data.units} profiles={data.profiles} unitOwners={data.unitOwners} /></TabsContent>
        <TabsContent value="ledger"><LedgerTab bills={data.bills} expenses={data.expenses} units={data.units} unitTypes={data.unitTypes} vendors={data.vendors} serviceCategories={data.serviceCategories} /></TabsContent>
        <TabsContent value="config"><ConfigTab data={data} reload={load} configSubTab={configSubTab} setConfigSubTab={setConfigSubTab} /></TabsContent>
        </div>
      </Tabs>
    </div>
  );
}

// ─── Billing Tab ─────────────────────────────────────────────────────────
function BillingTab({ data, reload, addBills }: { data: Data; reload: () => void; addBills?: (bills: Bill[]) => void }) {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [generating, setGenerating] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterUnitType, setFilterUnitType] = useState<string>("all");
  const [filterUnitId, setFilterUnitId] = useState<string>("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showGenerateBills, setShowGenerateBills] = useState(false);

  const unitMap = new Map(data.units.map(u => [u.id, u]));
  const ownerMap = new Map(data.unitOwners.map(uo => [uo.unit_id, uo.owner_id]));
  const profileMap = new Map(data.profiles.map(p => [p.id, p]));
  const buildingMap = new Map(data.buildings.map(b => [b.id, b.name]));
  const unitBillToMap = new Map<string, string>();
  data.unitTenantAssignments.forEach(a => {
    if (!unitBillToMap.has(a.unit_id) && a.is_payment_responsible !== false) unitBillToMap.set(a.unit_id, a.tenant_id);
    if (a.is_payment_responsible === true) unitBillToMap.set(a.unit_id, a.tenant_id);
  });

  async function generate() {
    setGenerating(true);
    setMsg({text:"",ok:true});
    try {
      const sb = createClient();
      const m = parseInt(month), y = parseInt(year);

      const existing = await sb.from("bills").select("unit_id").eq("period_month", m).eq("period_year", y);
      const done = new Set((existing.data ?? []).map((b: {unit_id:string}) => b.unit_id));
      const toProcess = data.units.filter(u => !done.has(u.id));
      if (!toProcess.length) { setMsg({text:"Bills already generated for this period.",ok:false}); setGenerating(false); return; }

      // Recurrent templates = template_id null, period null (definitions in Config)
      const recurrentTemplates = data.expenses.filter(e => e.frequency === "recurrent" && e.template_id == null && e.period_month == null);
      // Generate expense records for this period (if not already)
      for (const t of recurrentTemplates) {
        const existingExp = await sb.from("expenses").select("id").eq("template_id", t.id).eq("period_month", m).eq("period_year", y).limit(1);
        if (!(existingExp.data?.length)) {
          const ins = await sb.from("expenses").insert({ title: t.title, category: t.category, vendor: t.vendor, amount: t.amount, frequency: "recurrent", template_id: t.id, period_month: m, period_year: y }).select();
          if (ins.error) { setMsg({text: ins.error.message || "Failed to create expense record", ok: false}); setGenerating(false); return; }
        }
      }
      // Bills = services only (no shared expenses in unit bills)
      const recurrentServices = data.services.filter(s => s.frequency === "recurrent");
      const rows = toProcess.map(unit => {
        const unitServices = recurrentServices.filter(s => s.unit_type === unit.type);
        const servicesTotal = unitServices.reduce((s, svc) => {
          if (svc.pricing_model === "per_m2" && unit.size_m2) return s + Number(svc.price_value) * Number(unit.size_m2);
          return s + Number(svc.price_value);
        }, 0);
        return { unit_id: unit.id, period_month: m, period_year: y, total_amount: Math.round(servicesTotal * 100) / 100, status: "draft" };
      });

      const insBills = await sb.from("bills").insert(rows).select();
      if (insBills.error) { setMsg({text: insBills.error.message || "Failed to create bills", ok: false}); setGenerating(false); return; }
      const inserted = (insBills.data ?? []) as Bill[];
      if (addBills && inserted.length) addBills(inserted);
      setMsg({text:`✓ Generated ${rows.length} bill${rows.length>1?"s":""}.`,ok:true});
      await reload();
    } catch (err) {
      setMsg({text: (err as Error).message || "An error occurred", ok: false});
    }
    setGenerating(false);
  }

  async function markPaid(id: string) {
    const res = await fetch("/api/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billId: id, paid: true }) });
    const r = await res.json();
    if (r.success) reload();
    else setMsg({ text: r.error || "Failed", ok: false });
  }
  async function markUnpaid(id: string) {
    const res = await fetch("/api/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billId: id, paid: false }) });
    const r = await res.json();
    if (r.success) reload();
    else setMsg({ text: r.error || "Failed", ok: false });
  }
  async function markAllPaid(ownerId: string, periodMonth: number, periodYear: number) {
    const res = await fetch("/api/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId, periodMonth, periodYear, paid: true }) });
    const r = await res.json();
    if (r.success) reload();
    else setMsg({ text: r.error || "Failed", ok: false });
  }
  async function markAllUnpaid(ownerId: string, periodMonth: number, periodYear: number) {
    const res = await fetch("/api/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId, periodMonth, periodYear, paid: false }) });
    const r = await res.json();
    if (r.success) reload();
    else setMsg({ text: r.error || "Failed", ok: false });
  }

  const yrs = [new Date().getFullYear(), new Date().getFullYear() - 1];
  const getBillValue = (b: Bill, col: string): string | number => {
    const unit = unitMap.get(b.unit_id);
    const ownerId = ownerMap.get(b.unit_id);
    const owner = ownerId ? profileMap.get(ownerId) : null;
    const billToId = unitBillToMap.get(b.unit_id);
    const billTo = billToId ? profileMap.get(billToId) : null;
    switch (col) {
      case "ref": return (b.reference_code ?? "") as string;
      case "period": return b.period_year * 100 + b.period_month;
      case "unit": return (unit?.unit_name ?? "") as string;
      case "building": return (unit ? buildingMap.get(unit.building_id) ?? "" : "") as string;
      case "owner": return (owner ? `${owner.name} ${owner.surname}` : "") as string;
      case "billTo": return (billTo ? `${billTo.name} ${billTo.surname}` : "Owner") as string;
      case "amount": return Math.abs(Number(b.total_amount));
      case "status": return (b.paid_at ? "Paid" : b.status) as string;
      default: return "";
    }
  };
  let filteredBills = data.bills;
  if (filterPeriod !== "all") {
    const [y, m] = filterPeriod.split("-").map(Number);
    filteredBills = filteredBills.filter(b => b.period_year === y && b.period_month === m);
  }
  if (filterUnitType !== "all") {
    const unitIdsByType = new Set(data.units.filter(u => u.type === filterUnitType).map(u => u.id));
    filteredBills = filteredBills.filter(b => unitIdsByType.has(b.unit_id));
  }
  if (filterUnitId !== "all") filteredBills = filteredBills.filter(b => b.unit_id === filterUnitId);
  if (filterPaymentStatus !== "all") {
    if (filterPaymentStatus === "paid") filteredBills = filteredBills.filter(b => b.paid_at);
    else if (filterPaymentStatus === "unpaid") filteredBills = filteredBills.filter(b => !b.paid_at && b.status !== "in_process");
    else if (filterPaymentStatus === "in_process") filteredBills = filteredBills.filter(b => b.status === "in_process");
  }
  const sortedBills = sortCol ? sortBy(filteredBills, sortCol, sortDir, getBillValue) : [...filteredBills].sort((a,b) => b.period_year - a.period_year || b.period_month - a.period_month);
  const handleSort = (col: string) => { setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc"); setSortCol(col); };
  const ownerPeriodCount = new Map<string, number>();
  sortedBills.forEach(b => {
    const ownerId = ownerMap.get(b.unit_id) ?? "_none";
    const k = `${ownerId}-${b.period_month}-${b.period_year}`;
    ownerPeriodCount.set(k, (ownerPeriodCount.get(k) ?? 0) + 1);
  });

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle>All Bills ({sortedBills.length}{filteredBills.length !== data.bills.length ? ` of ${data.bills.length}` : ""})</CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" className="h-8 gap-1 bg-green-600 hover:bg-green-700 text-white border-0" onClick={() => setShowGenerateBills(v => !v)}>
              {showGenerateBills ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              Generate bills
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowFilters(v => !v)} aria-label="Toggle filters">
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {showGenerateBills && (
            <div className="rounded-md border-l-4 border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 space-y-2">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Generate monthly bills (per-unit services). Expenses are tracked separately.</p>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{yrs.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" className="h-8" onClick={generate} disabled={generating}>{generating ? "..." : "Generate"}</Button>
                <Button variant="outline" size="sm" className="h-8" disabled={!isPeriodCurrent(parseInt(month), parseInt(year))} onClick={async () => {
                  const sb = createClient();
                  const m = parseInt(month), y = parseInt(year);
                  const res = await sb.from("bills").delete().eq("period_month", m).eq("period_year", y).select("*");
                  const n = res.data?.length ?? 0;
                  setMsg({text:`✓ Deleted ${n} bill(s).`,ok:true});
                  reload();
                }}>Delete period</Button>
              </div>
              <div className="text-xs text-muted-foreground">
                <strong>Recurrent services:</strong> {data.services.filter(s=>s.frequency==="recurrent").length} &nbsp;|&nbsp;
                <strong>Shared expenses/month:</strong> {data.expenses.filter(e=>e.frequency==="recurrent").reduce((s,e)=>s+Number(e.amount),0).toFixed(2)} &nbsp;|&nbsp;
                <strong>Units to bill:</strong> {data.units.length}
              </div>
              {msg.text && <p className={`text-xs ${msg.ok?"text-green-600":"text-amber-600"}`}>{msg.text}</p>}
            </div>
          )}
          <div className={`grid transition-[grid-template-rows] duration-200 ${showFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-wrap gap-2 items-end pb-3">
            <div><Label className="text-xs">Period</Label>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All periods</SelectItem>
                  {[...new Set(data.bills.map(b => `${b.period_year}-${b.period_month}`))].sort((a,b)=>b.localeCompare(a)).slice(0,24).map(k => { const [y,m]=k.split("-"); return <SelectItem key={k} value={k}>{MONTHS[parseInt(m)-1]} {y}</SelectItem> })}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Unit type</Label>
              <Select value={filterUnitType} onValueChange={setFilterUnitType}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All types</SelectItem>{[...new Set(data.units.map(u=>u.type))].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Unit</Label>
              <Select value={filterUnitId} onValueChange={setFilterUnitId}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All units</SelectItem>{data.units.map(u=><SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
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
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b text-left">
                <SortableTh column="ref" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">Reference</SortableTh>
                <SortableTh column="period" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">Period</SortableTh>
                <SortableTh column="unit" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">Unit</SortableTh>
                <SortableTh column="building" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">Building</SortableTh>
                <SortableTh column="owner" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">Owner</SortableTh>
                <SortableTh column="billTo" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">Bill to</SortableTh>
                <SortableTh column="amount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground" align="right">Amount</SortableTh>
                <SortableTh column="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">Status</SortableTh>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Slip</th>
                <th className="pb-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sortedBills.map(b => {
                const unit = unitMap.get(b.unit_id);
                const ownerId = ownerMap.get(b.unit_id);
                const owner = ownerId ? profileMap.get(ownerId) : null;
                const billToId = unitBillToMap.get(b.unit_id);
                const billTo = billToId ? profileMap.get(billToId) : null;
                return (
                  <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-mono text-xs">{b.reference_code ?? "—"}</td>
                    <td className="py-3 pr-4 font-medium">{MONTHS[b.period_month-1]} {b.period_year}</td>
                    <td className="py-3 pr-4">{unit?.unit_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{unit ? buildingMap.get(unit.building_id)??"—" : "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{owner ? `${owner.name} ${owner.surname}` : <span className="text-xs text-amber-600">No owner</span>}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{billTo ? `${billTo.name} ${billTo.surname}` : <span className="text-xs text-muted-foreground">Owner</span>}</td>
                    <td className="py-3 pr-4 text-right font-semibold">{Number(b.total_amount).toFixed(2)}</td>
                    <td className="py-3 pr-4">
                      {b.paid_at
                        ? <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Paid</span>
                        : b.status === "in_process"
                        ? <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">In process</span>
                        : <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Unpaid</span>}
                    </td>
                    <td className="py-3 pr-4">
                      {(b.receipt_url || b.receipt_path) ? (
                        <a href={`/api/receipt?billId=${b.id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><FileText className="size-3" /> View</a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="py-3">
                      {(() => {
                        const ownerId = ownerMap.get(b.unit_id);
                        const k = ownerId ? `${ownerId}-${b.period_month}-${b.period_year}` : "";
                        const count = ownerId ? ownerPeriodCount.get(k) ?? 1 : 1;
                        if (count > 1 && ownerId) {
                          const allPaid = sortedBills.filter(x => ownerMap.get(x.unit_id) === ownerId && x.period_month === b.period_month && x.period_year === b.period_year).every(x => x.paid_at);
                          return (
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => allPaid ? markAllUnpaid(ownerId, b.period_month, b.period_year) : markAllPaid(ownerId, b.period_month, b.period_year)}>
                              {allPaid ? `Mark all ${count} unpaid` : `Mark all ${count} paid`}
                            </Button>
                          );
                        }
                        return (
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => b.paid_at ? markUnpaid(b.id) : markPaid(b.id)}>
                            {b.paid_at ? "Mark unpaid" : "Mark paid"}
                          </Button>
                        );
                      })()}
                    </td>
                  </tr>
                );
              })}
              {!sortedBills.length && <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">{filteredBills.length === 0 && data.bills.length > 0 ? "No bills match filters." : "No bills yet. Use Generate bills to create."}</td></tr>}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Expense Documents Panel (contracts, invoices per expense) ───────────
function ExpenseDocsPanel({ expense, onClose, onReload }: { expense: Expense; onClose: () => void; onReload?: () => void }) {
  const [docs, setDocs] = useState<{ id: string; name: string; category: string; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });

  const loadDocs = useCallback(() => {
    fetch(`/api/documents?expenseId=${expense.id}`).then(r => r.ok ? r.json() : { documents: [] }).then(j => { setDocs(j.documents ?? []); setLoading(false); });
  }, [expense.id]);

  useEffect(() => { setLoading(true); loadDocs(); }, [loadDocs]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    const cat = (form.querySelector('select[name="category"]') as HTMLSelectElement)?.value || "invoice";
    if (!file) { setMsg({ text: "Select a file", ok: false }); return; }
    setUploading(true); setMsg({ text: "", ok: true });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("expenseId", expense.id);
    fd.append("category", cat);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) { setMsg({ text: "Uploaded.", ok: true }); fileInput.value = ""; loadDocs(); onReload?.(); }
    else { const j = await res.json().catch(() => ({})); setMsg({ text: j.error || "Upload failed", ok: false }); }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) { loadDocs(); onReload?.(); } else { setMsg({ text: "Delete failed", ok: false }); }
  }

  async function download(id: string) {
    const res = await fetch(`/api/documents/${id}`);
    const j = await res.json().catch(() => ({}));
    if (j.url) window.open(j.url, "_blank");
  }

  return (
    <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900">
      <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <Paperclip className="size-4" /> Documents: {expense.title} · {expense.vendor}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Contracts, invoices (e.g. plumber, electrician)</p>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={onClose} aria-label="Close"><X className="size-4" /></Button>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
        <form onSubmit={upload} className="flex flex-wrap gap-2 items-end p-3 border rounded-lg bg-background">
          <div><Label>File</Label><Input type="file" name="file" className="mt-1" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" /></div>
          <div><Label>Type</Label><select name="category" className="flex h-9 rounded-md border px-3 mt-1 text-sm"><option value="invoice">Invoice</option><option value="contract">Contract</option><option value="maintenance">Maintenance</option><option value="other">Other</option></select></div>
          <Button type="submit" size="sm" disabled={uploading}>{uploading ? "Uploading..." : "Upload"}</Button>
        </form>
        <div className="space-y-2">
          {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {!loading && docs.map(d => (
            <div key={d.id} className="flex items-center justify-between py-2 px-3 rounded border bg-muted/30 text-sm">
              <div><span className="font-medium">{d.name}</span><span className="text-muted-foreground ml-2">({d.category})</span><span className="text-muted-foreground ml-2 text-xs">{new Date(d.created_at).toLocaleDateString()}</span></div>
              <div className="flex gap-1"><Button variant="outline" size="sm" onClick={() => download(d.id)}>Download</Button><Button variant="ghost" size="sm" onClick={() => remove(d.id)} className="text-red-600">Delete</Button></div>
            </div>
          ))}
          {!loading && !docs.length && <p className="text-sm text-muted-foreground">No documents. Upload invoice or contract above.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Expenses Tab ────────────────────────────────────────────────────────
function ExpensesTab({ data, reload }: { data: Data; reload: () => void }) {
  const { expenses, vendors, serviceCategories } = data;
  const now = new Date();
  const [month, setMonth] = useState(String(now.getMonth() + 1));
  const [year, setYear] = useState(String(now.getFullYear()));
  const [generating, setGenerating] = useState(false);
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [showAdd, setShowAdd] = useState(false);
  const [addF, setAddF] = useState({title:"",category:"",vendor:"",amount:"",periodM:String(now.getMonth()+1),periodY:String(now.getFullYear())});
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterVendor, setFilterVendor] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [expenseDocsFor, setExpenseDocsFor] = useState<Expense | null>(null);
  const [showGenerateExpenses, setShowGenerateExpenses] = useState(false);

  const recurrentTemplates = expenses.filter(e => e.frequency === "recurrent" && e.template_id == null && e.period_month == null);
  const allExpenseRecords = expenses.filter(e => e.period_month != null);
  let expenseRecords = allExpenseRecords;
  if (filterPeriod !== "all") {
    const [y, m] = filterPeriod.split("-").map(Number);
    expenseRecords = expenseRecords.filter(e => e.period_year === y && e.period_month === m);
  }
  if (filterCategory !== "all") expenseRecords = expenseRecords.filter(e => e.category === filterCategory);
  if (filterVendor !== "all") expenseRecords = expenseRecords.filter(e => e.vendor === filterVendor);
  if (filterType !== "all") expenseRecords = expenseRecords.filter(e => e.frequency === filterType);
  const getExpValue = (e: Expense, col: string): string | number => {
    switch (col) {
      case "ref": return (e.reference_code ?? expenseRef(e)) as string;
      case "period": return (e.period_year ?? 0) * 100 + (e.period_month ?? 0);
      case "title": return e.title;
      case "category": return e.category;
      case "vendor": return e.vendor;
      case "amount": return Number(e.amount);
      case "freq": return e.frequency;
      case "status": return (e.paid_at ? "Paid" : "Unpaid") as string;
      default: return "";
    }
  };
  const displayExpenses = sortCol ? sortBy(expenseRecords, sortCol, sortDir, getExpValue) : expenseRecords;
  const handleExpSort = (col: string) => { setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc"); setSortCol(col); };
  const adhocAny = expenses.filter(e => e.frequency !== "recurrent");
  const monthlyTotal = recurrentTemplates.reduce((s, e) => s + Number(e.amount), 0);
  const adhocTotal = adhocAny.reduce((s, e) => s + Number(e.amount), 0);

  async function generateRecurrent() {
    setGenerating(true);
    setMsg({text:"",ok:true});
    const sb = createClient();
    const m = parseInt(month), y = parseInt(year);
    let inserted = 0;
    for (const t of recurrentTemplates) {
      const existing = await sb.from("expenses").select("id").eq("template_id", t.id).eq("period_month", m).eq("period_year", y).limit(1);
      if (!(existing.data?.length)) {
        await sb.from("expenses").insert({ title: t.title, category: t.category, vendor: t.vendor, amount: t.amount, frequency: "recurrent", template_id: t.id, period_month: m, period_year: y });
        inserted++;
      }
    }
    setMsg({text: inserted ? `✓ Generated ${inserted} recurrent expense(s) for ${MONTHS[m-1]} ${y}.` : `All recurrent expenses already generated for ${MONTHS[m-1]} ${y}.`, ok: true});
    setGenerating(false);
    reload();
  }

  async function addAdhoc() {
    const sb = createClient();
    const m = parseInt(addF.periodM), y = parseInt(addF.periodY);
    const { error } = await sb.from("expenses").insert({
      title: addF.title,
      category: addF.category || "Misc",
      vendor: addF.vendor || "—",
      amount: parseFloat(addF.amount) || 0,
      frequency: "ad_hoc",
      period_month: m,
      period_year: y,
    });
    if (error) { setMsg({text: "Could not add expense: " + error.message, ok: false}); return; }
    setMsg({text: "✓ Ad-hoc expense recorded.", ok: true});
    setAddF({title:"",category:"",vendor:"",amount:"",periodM:String(now.getMonth()+1),periodY:String(now.getFullYear())});
    setShowAdd(false);
    reload();
  }

  async function markExpensePaid(id: string) {
    const res = await fetch("/api/expenses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expenseId: id, paid: true }) });
    const r = await res.json();
    if (r.success) reload();
    else setMsg({ text: r.error || "Failed", ok: false });
  }
  async function markExpenseUnpaid(id: string) {
    const res = await fetch("/api/expenses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expenseId: id, paid: false }) });
    const r = await res.json();
    if (r.success) reload();
    else setMsg({ text: r.error || "Failed", ok: false });
  }

  const yrs = [new Date().getFullYear(), new Date().getFullYear() - 1];

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 gap-2 w-full">
        <Card className="py-2 px-4 gap-1 w-full">
          <CardHeader className="pb-0 pt-2 px-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Monthly Recurrent (templates)</CardTitle>
          </CardHeader>
          <CardContent className="pb-2 pt-0 px-0">
            <p className="text-lg font-extrabold">{monthlyTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{recurrentTemplates.length} items</p>
          </CardContent>
        </Card>
        <Card className="py-2 px-4 gap-1 w-full">
          <CardHeader className="pb-0 pt-2 px-0">
            <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Ad-hoc</CardTitle>
          </CardHeader>
          <CardContent className="pb-2 pt-0 px-0">
            <p className="text-lg font-extrabold">{adhocTotal.toFixed(2)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{adhocAny.length} items</p>
          </CardContent>
        </Card>
      </div>

      {expenseDocsFor && (
        <ExpenseDocsPanel expense={expenseDocsFor} onClose={() => setExpenseDocsFor(null)} onReload={reload} />
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-2">
          <CardTitle>All Expenses ({displayExpenses.length}{expenseRecords.length !== allExpenseRecords.length ? ` of ${allExpenseRecords.length}` : ""})</CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Button variant="outline" size="sm" className="h-8 gap-1 bg-muted/50 hover:bg-muted border-gray-300" onClick={() => { setShowGenerateExpenses(v => !v); setShowAdd(false); }}>
              {showGenerateExpenses ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              Generate recurrent
            </Button>
            <Button size="sm" className="h-8 bg-teal-500 hover:bg-teal-600 text-white border-0" onClick={() => { setShowAdd(v => !v); setShowGenerateExpenses(false); }}>
              + Record expense
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowFilters(v => !v)} aria-label="Toggle filters">
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {showGenerateExpenses && (
            <div className="rounded-md border-l-4 border-amber-400 bg-amber-50/60 dark:bg-amber-950/20 p-3 space-y-2">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-200">Generate recurrent expenses</p>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={month} onValueChange={setMonth}>
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={year} onValueChange={setYear}>
                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{yrs.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" className="h-8" onClick={generateRecurrent} disabled={generating}>{generating ? "..." : "Generate"}</Button>
                <Button variant="outline" size="sm" className="h-8" disabled={expenses.some(e => e.period_month === parseInt(month) && e.period_year === parseInt(year) && e.paid_at)} onClick={async () => {
                  const sb = createClient();
                  const m = parseInt(month), y = parseInt(year);
                  const res = await sb.from("expenses").delete().eq("period_month", m).eq("period_year", y).select("*");
                  const n = res.data?.length ?? 0;
                  setMsg({ text: `✓ Deleted ${n} expense(s).`, ok: true });
                  reload();
                }}>Delete period</Button>
              </div>
              {msg.text && showGenerateExpenses && !showAdd && <p className={`text-xs ${msg.ok ? "text-green-600" : "text-amber-600"}`}>{msg.text}</p>}
            </div>
          )}
          {showAdd && (
            <div className="rounded-md border-l-4 border-teal-400 bg-teal-50/60 dark:bg-teal-950/20 p-3 space-y-2">
              <p className="text-xs font-medium text-teal-800 dark:text-teal-200">Record expense</p>
              <div className="flex flex-wrap gap-2 items-end">
                <Input value={addF.title} onChange={e=>setAddF({...addF,title:e.target.value})} placeholder="Title" className="h-8 w-32" />
                <Select value={addF.category||"none"} onValueChange={v=>setAddF({...addF,category:v==="none"?"":v})}>
                  <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{serviceCategories.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={addF.vendor||"none"} onValueChange={v=>setAddF({...addF,vendor:v==="none"?"":v})}>
                  <SelectTrigger className="h-8 w-28"><SelectValue placeholder="Vendor" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">—</SelectItem>{vendors.map(v=><SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="number" step="0.01" value={addF.amount} onChange={e=>setAddF({...addF,amount:e.target.value})} placeholder="Amount" className="h-8 w-20" />
                <Select value={addF.periodM} onValueChange={v=>setAddF({...addF,periodM:v})}><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m,i)=><SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select>
                <Select value={addF.periodY} onValueChange={v=>setAddF({...addF,periodY:v})}><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger><SelectContent>{yrs.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                <Button size="sm" className="h-8" onClick={addAdhoc}>Save</Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
              {msg.text && showAdd && <p className={`text-xs ${msg.ok ? "text-green-600" : "text-amber-600"}`}>{msg.text}</p>}
            </div>
          )}
          {msg.text && !showGenerateExpenses && !showAdd && <p className={`text-xs ${msg.ok ? "text-green-600" : "text-amber-600"}`}>{msg.text}</p>}
          <div className={`grid transition-[grid-template-rows] duration-200 ${showFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-wrap gap-2 items-end pb-3">
            <div><Label className="text-xs">Period</Label>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All periods</SelectItem>
                  {[...new Set(allExpenseRecords.map(e=>`${e.period_year}-${e.period_month}`))].sort((a,b)=>b.localeCompare(a)).slice(0,24).map(k=>{const [y,m]=k.split("-");return <SelectItem key={k} value={k}>{MONTHS[parseInt(m)-1]} {y}</SelectItem>})}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{[...new Set(allExpenseRecords.map(e=>e.category))].filter(Boolean).map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Vendor</Label>
              <Select value={filterVendor} onValueChange={setFilterVendor}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem>{[...new Set(allExpenseRecords.map(e=>e.vendor))].filter(Boolean).map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="recurrent">Recurrent</SelectItem><SelectItem value="ad_hoc">Ad-hoc</SelectItem></SelectContent>
              </Select>
            </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead><tr className="border-b text-left">
              <SortableTh column="ref" sortCol={sortCol} sortDir={sortDir} onSort={handleExpSort} className="pb-3 pr-4 font-medium text-muted-foreground">Reference</SortableTh>
              <SortableTh column="period" sortCol={sortCol} sortDir={sortDir} onSort={handleExpSort} className="pb-3 pr-4 font-medium text-muted-foreground">Period</SortableTh>
              <SortableTh column="title" sortCol={sortCol} sortDir={sortDir} onSort={handleExpSort} className="pb-3 pr-4 font-medium text-muted-foreground">Title</SortableTh>
              <SortableTh column="category" sortCol={sortCol} sortDir={sortDir} onSort={handleExpSort} className="pb-3 pr-4 font-medium text-muted-foreground">Category</SortableTh>
              <SortableTh column="vendor" sortCol={sortCol} sortDir={sortDir} onSort={handleExpSort} className="pb-3 pr-4 font-medium text-muted-foreground">Vendor</SortableTh>
              <SortableTh column="amount" sortCol={sortCol} sortDir={sortDir} onSort={handleExpSort} className="pb-3 pr-4 font-medium text-muted-foreground" align="right">Amount</SortableTh>
              <SortableTh column="freq" sortCol={sortCol} sortDir={sortDir} onSort={handleExpSort} className="pb-3 pr-4 font-medium text-muted-foreground">Recurrent / Ad-hoc</SortableTh>
              <SortableTh column="status" sortCol={sortCol} sortDir={sortDir} onSort={handleExpSort} className="pb-3 pr-4 font-medium text-muted-foreground">Status</SortableTh>
              <th className="pb-3 font-medium text-muted-foreground">Action</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {displayExpenses.map(e => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="py-3 pr-4 font-mono text-xs">{e.reference_code ?? expenseRef(e)}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {e.period_month != null && e.period_year != null ? `${MONTHS[e.period_month-1]} ${e.period_year}` : (e.frequency === "recurrent" ? "Monthly" : (e.created_at ? new Date(e.created_at).toLocaleDateString("en-GB", { month: "short", year: "numeric" }) : "—"))}
                  </td>
                  <td className="py-3 pr-4 font-medium">{e.title}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{e.category}</td>
                  <td className="py-3 pr-4 text-muted-foreground">{e.vendor}</td>
                  <td className="py-3 pr-4 text-right font-semibold text-red-600">{Number(e.amount).toFixed(2)}</td>
                  <td className="py-3 pr-4">
                    {e.frequency === "recurrent"
                      ? <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Recurrent</span>
                      : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Ad-hoc</span>}
                  </td>
                  <td className="py-3 pr-4">
                    {e.paid_at
                      ? <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Paid</span>
                      : <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Unpaid</span>}
                  </td>
                  <td className="py-3">
                    <div className="flex items-center gap-1">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExpenseDocsFor(e)} title="Attach documents (invoice, contract)">
                        <Paperclip className="size-3.5 mr-0.5" /> Docs
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => e.paid_at ? markExpenseUnpaid(e.id) : markExpensePaid(e.id)}>
                        {e.paid_at ? "Unpaid" : "Paid"}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {!displayExpenses.length && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{expenseRecords.length === 0 && allExpenseRecords.length > 0 ? "No expenses match filters." : "No expenses. Generate recurrent or record ad-hoc above. Define templates in Configuration."}</td></tr>}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────
function PaymentsTab({ bills, units, profiles, unitOwners }: { bills: Bill[]; units: Unit[]; profiles: Profile[]; unitOwners: UnitOwner[] }) {
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterUnitId, setFilterUnitId] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const unitMap = new Map(units.map(u => [u.id, u]));
  const ownerMap = new Map(unitOwners.map(uo => [uo.unit_id, uo.owner_id]));
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  let paidRaw = bills.filter(b => b.paid_at);
  if (filterPeriod !== "all") { const [y, m] = filterPeriod.split("-").map(Number); paidRaw = paidRaw.filter(b => b.period_year === y && b.period_month === m); }
  if (filterUnitId !== "all") paidRaw = paidRaw.filter(b => b.unit_id === filterUnitId);
  const getPaidValue = (b: Bill, col: string): string | number => {
    const unit = unitMap.get(b.unit_id);
    const ownerId = ownerMap.get(b.unit_id);
    const owner = ownerId ? profileMap.get(ownerId) : null;
    switch (col) {
      case "ref": return (b.reference_code ?? "") as string;
      case "paidOn": return new Date(b.paid_at!).getTime();
      case "unit": return (unit?.unit_name ?? "") as string;
      case "owner": return (owner ? `${owner.name} ${owner.surname}` : "") as string;
      case "period": return b.period_year * 100 + b.period_month;
      case "amount": return Math.abs(Number(b.total_amount));
      default: return "";
    }
  };
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const paid = sortCol ? sortBy(paidRaw, sortCol, sortDir, getPaidValue) : [...paidRaw].sort((a,b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime());
  const totalPaid = paid.reduce((s,b) => s + Math.abs(Number(b.total_amount)), 0);
  const handlePaidSort = (col: string) => { setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc"); setSortCol(col); };
  return (
    <div className="space-y-4 mt-2">
      <Card className="border-l-4 border-l-green-500 py-2 px-4 gap-1">
        <CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Collected</CardTitle></CardHeader>
        <CardContent className="pb-2 pt-0 px-0"><p className="text-lg font-extrabold text-green-600">{totalPaid.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-0.5">{paid.length} payments received</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle>Payment History ({paid.length}{paidRaw.length !== bills.filter(b=>b.paid_at).length ? ` of ${bills.filter(b=>b.paid_at).length}` : ""})</CardTitle>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowFilters(v => !v)} aria-label="Toggle filters">
            <SlidersHorizontal className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`grid transition-[grid-template-rows] duration-200 ${showFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-wrap gap-2 items-end pb-3">
            <div><Label className="text-xs">Period</Label>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All periods</SelectItem>
                  {[...new Set(bills.filter(b=>b.paid_at).map(b=>`${b.period_year}-${b.period_month}`))].sort((a,b)=>b.localeCompare(a)).slice(0,24).map(k=>{const [y,m]=k.split("-");return <SelectItem key={k} value={k}>{MONTHS[parseInt(m)-1]} {y}</SelectItem>})}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Unit</Label>
              <Select value={filterUnitId} onValueChange={setFilterUnitId}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All units</SelectItem>{units.map(u=><SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead><tr className="border-b text-left">
              <SortableTh column="ref" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 pr-4 font-medium text-muted-foreground">Reference</SortableTh>
              <SortableTh column="paidOn" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 pr-4 font-medium text-muted-foreground">Paid On</SortableTh>
              <SortableTh column="unit" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 pr-4 font-medium text-muted-foreground">Unit</SortableTh>
              <SortableTh column="owner" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 pr-4 font-medium text-muted-foreground">Owner</SortableTh>
              <SortableTh column="period" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 pr-4 font-medium text-muted-foreground">Period</SortableTh>
              <SortableTh column="amount" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 font-medium text-muted-foreground" align="right">Amount</SortableTh>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {paid.map(b => {
                const unit = unitMap.get(b.unit_id);
                const ownerId = ownerMap.get(b.unit_id);
                const owner = ownerId ? profileMap.get(ownerId) : null;
                return (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-4 font-mono text-xs">{b.reference_code ?? "—"}</td>
                    <td className="py-3 pr-4 font-medium">{new Date(b.paid_at!).toLocaleDateString()}</td>
                    <td className="py-3 pr-4">{unit?.unit_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{owner ? `${owner.name} ${owner.surname}` : "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{MONTHS[b.period_month-1]} {b.period_year}</td>
                    <td className="py-3 text-right font-semibold text-green-600">{Number(b.total_amount).toFixed(2)}</td>
                  </tr>
                );
              })}
              {!paid.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{paidRaw.length === 0 && bills.filter(b=>b.paid_at).length > 0 ? "No payments match filters." : "No payments yet."}</td></tr>}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────
function LedgerTab({ bills, expenses, units, unitTypes, vendors, serviceCategories }: { bills: Bill[]; expenses: Expense[]; units: Unit[]; unitTypes: UnitType[]; vendors: Vendor[]; serviceCategories: ServiceCategory[] }) {
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterUnitType, setFilterUnitType] = useState<string>("all");
  const [filterUnitId, setFilterUnitId] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterVendor, setFilterVendor] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const unitMap = new Map(units.map(u => [u.id, u]));
  const unitNameMap = new Map(units.map(u => [u.id, u.unit_name]));

  let filteredBills = bills;
  let filteredExpenses = expenses.filter(e => e.period_month != null);
  if (filterPeriod !== "all") { const [y, m] = filterPeriod.split("-").map(Number); filteredBills = filteredBills.filter(b => b.period_year === y && b.period_month === m); filteredExpenses = filteredExpenses.filter(e => e.period_year === y && e.period_month === m); }
  if (filterUnitType !== "all") filteredBills = filteredBills.filter(b => unitMap.get(b.unit_id)?.type === filterUnitType);
  if (filterUnitId !== "all") filteredBills = filteredBills.filter(b => b.unit_id === filterUnitId);
  if (filterCategory !== "all") filteredExpenses = filteredExpenses.filter(e => e.category === filterCategory);
  if (filterVendor !== "all") filteredExpenses = filteredExpenses.filter(e => e.vendor === filterVendor);
  if (filterPaymentStatus === "paid") { filteredBills = filteredBills.filter(b => b.paid_at); filteredExpenses = filteredExpenses.filter(e => e.paid_at); }
  else if (filterPaymentStatus === "unpaid") { filteredBills = filteredBills.filter(b => !b.paid_at); filteredExpenses = filteredExpenses.filter(e => !e.paid_at); }
  if (filterType === "bill") filteredExpenses = [];
  else if (filterType === "expense") filteredBills = [];

  type LedgerRow = { key: string; date: string; type: "income"|"expense"; label: string; ref: string; amount: number; status: string };
  const periodLabel = (d: string) => { const [y, m] = d.split("-"); return `${MONTHS[parseInt(m||"1")-1]} ${y}`; };
  const rows: LedgerRow[] = [
    ...filteredBills.map(b => ({ key:`b-${b.id}`, date:`${b.period_year}-${String(b.period_month).padStart(2,"0")}`, type:"income" as const, label:`${unitNameMap.get(b.unit_id)??"—"} — ${MONTHS[b.period_month-1]} ${b.period_year}`, ref: b.reference_code ?? "—", amount: Math.abs(Number(b.total_amount)), status: b.paid_at ? "Paid" : b.status === "in_process" ? "In process" : b.status })),
    ...filteredExpenses.map(e => ({ key:`e-${e.id}`, date: `${e.period_year}-${String(e.period_month!).padStart(2,"0")}`, type:"expense" as const, label:`${e.title} · ${e.vendor}`, ref: e.reference_code ?? expenseRef(e), amount: Number(e.amount), status: e.paid_at ? "Paid" : e.frequency })),
  ];
  const getLedgerValue = (r: LedgerRow & { balance?: number }, col: string): string | number => {
    switch (col) {
      case "ref": return r.ref;
      case "date": return r.date;
      case "type": return r.type;
      case "label": return r.label;
      case "status": return r.status;
      case "amount": return r.amount;
      case "balance": return r.balance ?? 0;
      default: return "";
    }
  };
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const sortedRows = sortCol ? sortBy(rows, sortCol, sortDir, getLedgerValue) : [...rows].sort((a,b) => b.date.localeCompare(a.date));
  let running = 0;
  const rowsWithBalance = [...sortedRows].reverse().map(r => { running += r.type === "income" ? r.amount : -r.amount; return {...r, balance: running}; }).reverse();

  const totalIn = rows.filter(r=>r.type==="income").reduce((s,r)=>s+r.amount,0);
  const totalOut = rows.filter(r=>r.type==="expense").reduce((s,r)=>s+r.amount,0);
  const handleLedgerSort = (col: string) => { setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc"); setSortCol(col); };

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="py-2 px-4 gap-1"><CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Billed</CardTitle></CardHeader><CardContent className="pb-2 pt-0 px-0"><p className="text-lg font-extrabold text-green-600">+{totalIn.toFixed(2)}</p></CardContent></Card>
        <Card className="py-2 px-4 gap-1"><CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Expenses</CardTitle></CardHeader><CardContent className="pb-2 pt-0 px-0"><p className="text-lg font-extrabold text-red-600">-{totalOut.toFixed(2)}</p></CardContent></Card>
        <Card className="py-2 px-4 gap-1"><CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Balance</CardTitle></CardHeader><CardContent className="pb-2 pt-0 px-0"><p className={`text-lg font-extrabold ${totalIn-totalOut>=0?"text-blue-600":"text-red-600"}`}>{(totalIn-totalOut).toFixed(2)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle>Full Ledger ({rows.length}{rows.length !== bills.length + expenses.filter(e=>e.period_month!=null).length ? ` of ${bills.length + expenses.filter(e=>e.period_month!=null).length}` : ""} entries)</CardTitle>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowFilters(v => !v)} aria-label="Toggle filters">
            <SlidersHorizontal className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`grid transition-[grid-template-rows] duration-200 ${showFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-wrap gap-2 items-end pb-3">
            <div><Label className="text-xs">Period</Label>
              <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All periods</SelectItem>
                  {[...new Set([...bills.map(b=>`${b.period_year}-${b.period_month}`), ...expenses.filter(e=>e.period_month!=null).map(e=>`${e.period_year}-${e.period_month}`)])].sort((a,b)=>b.localeCompare(a)).slice(0,24).map(k=>{const [y,m]=k.split("-");return <SelectItem key={k} value={k}>{MONTHS[parseInt(m)-1]} {y}</SelectItem>})}
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Unit type</Label>
              <Select value={filterUnitType} onValueChange={setFilterUnitType}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All types</SelectItem>{unitTypes.map(t=><SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Unit</Label>
              <Select value={filterUnitId} onValueChange={setFilterUnitId}>
                <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All units</SelectItem>{units.map(u=><SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Category</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All categories</SelectItem>{[...new Set(expenses.map(e=>e.category).filter((c): c is string => !!c))].sort().map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Vendor</Label>
              <Select value={filterVendor} onValueChange={setFilterVendor}>
                <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All vendors</SelectItem>{[...new Set(expenses.map(e=>e.vendor).filter((v): v is string => !!v))].sort().map(v=><SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Type</Label>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Bill & Expense</SelectItem><SelectItem value="bill">Bill only</SelectItem><SelectItem value="expense">Expense only</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Payment</Label>
              <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="paid">Paid</SelectItem><SelectItem value="unpaid">Unpaid</SelectItem></SelectContent>
              </Select>
            </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="border-b text-left">
              <SortableTh column="ref" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Reference</SortableTh>
              <SortableTh column="date" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Period</SortableTh>
              <SortableTh column="type" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Type</SortableTh>
              <SortableTh column="label" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Description</SortableTh>
              <SortableTh column="status" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">Status</SortableTh>
              <SortableTh column="amount" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground" align="right">Amount</SortableTh>
              <SortableTh column="balance" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 font-medium text-muted-foreground" align="right">Running Balance</SortableTh>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {rowsWithBalance.map(r => (
                <tr key={r.key} className="hover:bg-muted/30">
                  <td className="py-3 pr-4 font-mono text-xs">{r.ref}</td>
                  <td className="py-3 pr-4 text-muted-foreground font-medium">{periodLabel(r.date)}</td>
                  <td className="py-3 pr-4">
                    {r.type === "income"
                      ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Bill</span>
                      : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Expense</span>}
                  </td>
                  <td className="py-3 pr-4">{r.label}</td>
                  <td className="py-3 pr-4 text-muted-foreground text-xs capitalize">{r.status}</td>
                  <td className={`py-3 pr-4 text-right font-semibold ${r.type==="income"?"text-green-600":"text-red-600"}`}>
                    {r.type==="income"?"+":"-"}{r.amount.toFixed(2)}
                  </td>
                  <td className={`py-3 text-right font-mono text-sm ${r.balance>=0?"text-blue-600":"text-red-600"}`}>{r.balance.toFixed(2)}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{bills.length + expenses.filter(e=>e.period_month!=null).length > 0 ? "No entries match filters." : "No transactions yet."}</td></tr>}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Notifications Config (full-screen form for mobile) ─────────────────────
type SentNotification = { id: string; title: string; body: string | null; created_at: string; target_audience: string; recipients: number };
function NotificationsCfg({ unitTypes, onBack }: { unitTypes: UnitType[]; onBack: () => void }) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetAudience, setTargetAudience] = useState<"owners" | "tenants" | "both">("both");
  const [selectedUnitTypes, setSelectedUnitTypes] = useState<string[]>([]);
  const [unpaidOnly, setUnpaidOnly] = useState(false);
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [sentLog, setSentLog] = useState<SentNotification[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const loadSent = async () => {
    setLogLoading(true);
    const res = await fetch("/api/notifications/sent", { cache: "no-store" });
    const json = await res.json().catch(() => ({}));
    setSentLog(json.notifications ?? []);
    setLogLoading(false);
  };

  useEffect(() => {
    loadSent();
  }, []);

  const toggleUnitType = (name: string) => {
    setSelectedUnitTypes(prev => prev.includes(name) ? prev.filter(x => x !== name) : [...prev, name]);
  };

  async function send() {
    if (!title.trim()) { setMsg({ text: "Enter a title", ok: false }); return; }
    setSending(true);
    setMsg({ text: "", ok: true });
    const res = await fetch("/api/notifications/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: title.trim(),
        body: body.trim() || null,
        targetAudience,
        targetUnitTypes: selectedUnitTypes.length > 0 ? selectedUnitTypes : null,
        unpaidOnly,
      }),
    });
    const json = await res.json().catch(() => ({}));
    setSending(false);
    if (res.ok && json.success) {
      const count = json.recipients ?? 0;
      setMsg({ text: count > 0 ? `Sent to ${count} recipients` : "Notification saved. No recipients found — add owners/tenants in Config > Units.", ok: true });
      loadSent();
      setTitle(""); setBody(""); setSelectedUnitTypes([]); setUnpaidOnly(false);
      if (count > 0) setTimeout(() => onBack(), 800);
    } else {
      setMsg({ text: json.error || "Failed to send", ok: false });
    }
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-16rem)] md:min-h-[420px]">
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 w-full">
          <div className="space-y-4 max-w-md">
          <div>
            <Label>Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Payment reminder" className="mt-1 w-full" />
          </div>
          <div>
            <Label>Message (optional)</Label>
            <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Write your message..." rows={4} className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 mt-1" />
          </div>
          <div>
            <Label>Send to</Label>
            <Select value={targetAudience} onValueChange={(v: "owners" | "tenants" | "both") => setTargetAudience(v)}>
              <SelectTrigger className="mt-1 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="owners">Owners only</SelectItem>
                <SelectItem value="tenants">Tenants only</SelectItem>
                <SelectItem value="both">Owners and Tenants</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {unitTypes.length > 0 && (
            <div>
              <Label>Filter by unit type (optional)</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {unitTypes.map(ut => (
                  <button key={ut.id} type="button" onClick={() => toggleUnitType(ut.name)}
                    className={`text-xs px-2 py-1 rounded-full border transition-colors ${selectedUnitTypes.includes(ut.name) ? "bg-primary text-primary-foreground border-primary" : "bg-muted/50 hover:bg-muted"}`}>
                    {ut.name}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input type="checkbox" id="unpaid-cfg" checked={unpaidOnly} onChange={e => setUnpaidOnly(e.target.checked)} className="rounded" />
            <Label htmlFor="unpaid-cfg" className="cursor-pointer">Only users with unpaid bills</Label>
          </div>
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-600"}`}>{msg.text}</p>}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onBack} className="flex-1 md:flex-none">Cancel</Button>
            <Button onClick={send} disabled={sending} className="flex-1 md:flex-none">{sending ? "Sending..." : "Send"}</Button>
          </div>
          </div>
          <Card className="w-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Notifications sent</CardTitle>
              <p className="text-xs text-muted-foreground">Log of all notifications you have sent.</p>
            </CardHeader>
            <CardContent className="w-full px-4 pb-4 pt-0 md:p-6">
              {logLoading ? (
                <p className="text-sm text-muted-foreground py-4 px-4">Loading...</p>
              ) : (
                <div className="overflow-x-auto w-full">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Date</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Message</th>
                        <th className="px-4 py-3 text-left font-medium text-muted-foreground">Audience</th>
                        <th className="px-4 py-3 text-right font-medium text-muted-foreground">Recipients</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {sentLog.map(n => (
                        <tr key={n.id} className="hover:bg-muted/20">
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{n.created_at ? new Date(n.created_at).toLocaleString() : "—"}</td>
                          <td className="px-4 py-3 font-medium">{n.title}</td>
                          <td className="px-4 py-3 text-muted-foreground truncate max-w-[200px]" title={n.body ?? ""}>{n.body ?? "—"}</td>
                          <td className="px-4 py-3 capitalize">{n.target_audience}</td>
                          <td className="px-4 py-3 text-right font-medium">{n.recipients}</td>
                        </tr>
                      ))}
                      {sentLog.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No notifications sent yet.</td></tr>}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Documents Config (contracts, maintenance docs per building/unit) ─────
function DocumentsCfg({ data }: { data: Data }) {
  const [buildingId, setBuildingId] = useState<string>("");
  const [unitId, setUnitId] = useState<string>("");
  const [docs, setDocs] = useState<{ id: string; name: string; category: string; created_at: string; unit_id: string | null }[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });

  const unitsInBuilding = data.units.filter(u => u.building_id === buildingId);

  const loadDocs = useCallback(() => {
    if (!buildingId) { setDocs([]); return; }
    setLoading(true);
    let u = `/api/documents?buildingId=${buildingId}`;
    if (unitId) u += `&unitId=${unitId}`;
    fetch(u).then(r => r.ok ? r.json() : { documents: [] }).then(j => { setDocs(j.documents ?? []); setLoading(false); });
  }, [buildingId, unitId]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  async function upload(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const fileInput = form.querySelector('input[type="file"]') as HTMLInputElement;
    const file = fileInput?.files?.[0];
    const cat = (form.querySelector('select[name="category"]') as HTMLSelectElement)?.value || "other";
    if (!file || !buildingId) { setMsg({ text: "Select building and file", ok: false }); return; }
    setUploading(true); setMsg({ text: "", ok: true });
    const fd = new FormData();
    fd.append("file", file);
    fd.append("buildingId", buildingId);
    if (unitId) fd.append("unitId", unitId);
    fd.append("category", cat);
    const res = await fetch("/api/documents", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) { setMsg({ text: "Uploaded.", ok: true }); fileInput.value = ""; loadDocs(); }
    else { const j = await res.json().catch(() => ({})); setMsg({ text: j.error || "Upload failed", ok: false }); }
  }

  async function remove(id: string) {
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) { loadDocs(); } else { setMsg({ text: "Delete failed", ok: false }); }
  }

  async function download(id: string) {
    const res = await fetch(`/api/documents/${id}`);
    const j = await res.json().catch(() => ({}));
    if (j.url) window.open(j.url, "_blank");
  }

  return (
    <Card>
      <CardHeader><CardTitle>Documents</CardTitle><p className="text-sm text-muted-foreground">Contracts, maintenance docs per building or unit.</p></CardHeader>
      <CardContent className="space-y-4">
        {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>}
        <div className="flex flex-wrap gap-2 items-center">
          <Label className="shrink-0">Building</Label>
          <Select value={buildingId} onValueChange={v => { setBuildingId(v); setUnitId(""); }}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select building" /></SelectTrigger>
            <SelectContent>
              {data.buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {buildingId && unitsInBuilding.length > 0 && (
            <>
              <Label className="shrink-0 ml-2">Unit (optional)</Label>
              <Select value={unitId || "__building__"} onValueChange={v => setUnitId(v === "__building__" ? "" : v)}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="All / building" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__building__">— Building level —</SelectItem>
                  {unitsInBuilding.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </>
          )}
        </div>
        {buildingId && (
          <form onSubmit={upload} className="flex flex-wrap gap-2 items-end p-3 border rounded-lg">
            <div><Label>File</Label><Input type="file" name="file" className="mt-1" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" /></div>
            <div><Label>Category</Label><select name="category" className="flex h-9 rounded-md border px-3 mt-1 text-sm"><option value="contract">Contract</option><option value="maintenance">Maintenance</option><option value="other">Other</option></select></div>
            {unitId && <input type="hidden" name="unitId" value={unitId} />}
            <Button type="submit" disabled={uploading}>{uploading ? "Uploading..." : "Upload"}</Button>
          </form>
        )}
        {buildingId && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Documents</p>
            {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
            {!loading && docs.map(d => (
              <div key={d.id} className="flex items-center justify-between py-2 px-3 rounded border bg-muted/30 text-sm">
                <div>
                  <span className="font-medium">{d.name}</span>
                  <span className="text-muted-foreground ml-2">({d.category})</span>
                  <span className="text-muted-foreground ml-2 text-xs">{new Date(d.created_at).toLocaleDateString()}</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" onClick={() => download(d.id)}>Download</Button>
                  <Button variant="ghost" size="sm" onClick={() => remove(d.id)} className="text-red-600">Delete</Button>
                </div>
              </div>
            ))}
            {!loading && !docs.length && <p className="text-sm text-muted-foreground">No documents.</p>}
          </div>
        )}
        {!buildingId && data.buildings.length > 0 && <p className="text-sm text-muted-foreground">Select a building to view or upload documents.</p>}
        {!data.buildings.length && <p className="text-sm text-muted-foreground">No buildings. Add buildings first.</p>}
      </CardContent>
    </Card>
  );
}

// ─── Audit Config (manager sees own site's audit log) ───────────────────────
function AuditCfg() {
  const [entries, setEntries] = useState<{ id: string; created_at: string; user_email: string | null; action: string; entity_type: string; entity_label: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    fetch("/api/admin/audit-log?limit=50")
      .then(r => r.ok ? r.json() : { entries: [] })
      .then(j => { setEntries(j.entries ?? []); setLoading(false); });
  }, []);
  const formatDate = (d: string) => new Date(d).toLocaleString();
  return (
    <Card>
      <CardHeader><CardTitle>Audit Log</CardTitle><p className="text-sm text-muted-foreground">Recent changes for your site.</p></CardHeader>
      <CardContent>
        {loading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {!loading && (
          <div className="space-y-2 max-h-[300px] overflow-y-auto text-sm">
            {entries.map(e => (
              <div key={e.id} className="py-2 px-3 rounded border bg-muted/30">
                <span className="text-muted-foreground">{formatDate(e.created_at)}</span> · <span className="font-medium">{e.user_email ?? "system"}</span> <span className="text-amber-600">{e.action}</span> {e.entity_type}{e.entity_label ? ` (${e.entity_label})` : ""}
              </div>
            ))}
          </div>
        )}
        {!loading && !entries.length && <p className="text-muted-foreground">No entries yet.</p>}
      </CardContent>
    </Card>
  );
}

// ─── Configuration Tab ────────────────────────────────────────────────────
function ConfigTab({ data, reload, configSubTab, setConfigSubTab }: { data: Data; reload: () => void; configSubTab: string; setConfigSubTab: (v: string) => void }) {
  const tabs = ["buildings","units","unit-types","services","expenses","vendors","categories","users","documents","notifications","audit"];
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1 mb-4">
        {tabs.map(t => (
          <Button key={t} size="sm" variant={configSubTab===t?"default":"outline"} onClick={() => setConfigSubTab(t)} className="capitalize">{t.replace("-"," ")}</Button>
        ))}
      </div>
      {configSubTab==="buildings" && <BuildingsCfg data={data} reload={reload} />}
      {configSubTab==="units" && <UnitsCfg data={data} reload={reload} />}
      {configSubTab==="unit-types" && <UnitTypesCfg data={data} reload={reload} />}
      {configSubTab==="services" && <ServicesCfg data={data} reload={reload} />}
      {configSubTab==="expenses" && <ExpensesCfg data={data} reload={reload} />}
      {configSubTab==="vendors" && <VendorsCfg data={data} reload={reload} />}
      {configSubTab==="categories" && <CategoriesCfg data={data} reload={reload} />}
      {configSubTab==="users" && <UsersCfg data={data} reload={reload} />}
      {configSubTab==="documents" && <DocumentsCfg data={data} />}
      {configSubTab==="notifications" && <NotificationsCfg unitTypes={data.unitTypes} onBack={() => setConfigSubTab("buildings")} />}
      {configSubTab==="audit" && <AuditCfg />}
    </div>
  );
}

// ─── Buildings Config ─────────────────────────────────────────────────────
function BuildingsCfg({ data, reload }: { data: Data; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [editingBuilding, setEditingBuilding] = useState<Building|null>(null);
  const [editF, setEditF] = useState({name:""});

  const sb = createClient();

  // Count units per building per type
  const unitCountMap = new Map<string, Map<string,number>>();
  data.units.forEach(u => {
    if (!unitCountMap.has(u.building_id)) unitCountMap.set(u.building_id, new Map());
    const typeMap = unitCountMap.get(u.building_id)!;
    typeMap.set(u.type, (typeMap.get(u.type) ?? 0) + 1);
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!data.site) { setMsg({text:"No site. Contact admin to create a site for you.",ok:false}); return; }
    const { error } = await sb.from("buildings").insert({ name: newName, site_id: data.site.id });
    if (!error) { setMsg({text:"Building created.",ok:true}); setNewName(""); setShowCreate(false); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function saveEdit() {
    if (!editingBuilding) return;
    const { error } = await sb.from("buildings").update({ name: editF.name }).eq("id", editingBuilding.id);
    if (!error) { setMsg({text:"Building updated.",ok:true}); setEditingBuilding(null); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function del(id: string) {
    const { data: units } = await sb.from("units").select("id").eq("building_id", id).limit(1);
    if (units && units.length > 0) { setMsg({text:"Cannot delete: building has units. Remove units first.",ok:false}); return; }
    const { error } = await sb.from("buildings").delete().eq("id", id);
    if (!error) { setMsg({text:"Deleted.",ok:true}); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok?"text-green-600":"text-red-500"}`}>{msg.text}</p>}
      {data.site?.address && <p className="text-sm text-muted-foreground">Site address: {data.site.address}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Buildings ({data.buildings.length})</h3>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingBuilding(null); }}>
          {showCreate ? "Cancel" : "+ Add building"}
        </Button>
      </div>

      {showCreate && (
        <div className="border border-green-200 bg-green-50/20 rounded-lg p-4">
          <p className="text-base font-semibold mb-3">Add Building</p>
          <form onSubmit={create} className="flex gap-3 flex-wrap items-end">
              <div><Label>Name</Label><Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Building A" required className="w-44"/></div>
              <Button type="submit">Create</Button>
            </form>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Buildings Table */}
        <div className={`overflow-x-auto ${editingBuilding ? "md:col-span-1" : "md:col-span-2"}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Building</th>
                  {data.unitTypes.map(t => (
                    <th key={t.id} className="px-3 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">{t.name}</th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.buildings.map(b => {
                  const typeMap = unitCountMap.get(b.id);
                  const totalUnits = typeMap ? Array.from(typeMap.values()).reduce((s,n)=>s+n,0) : 0;
                  const isActive = editingBuilding?.id === b.id;
                  return (
                    <tr key={b.id} className={`transition-colors ${isActive?"bg-blue-50":"hover:bg-muted/20"}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.name}</div>
                        <div className="text-xs text-muted-foreground">{totalUnits} unit{totalUnits!==1?"s":""} total</div>
                      </td>
                      {data.unitTypes.map(t => (
                        <td key={t.id} className="px-3 py-3 text-center">
                          {typeMap?.get(t.name)
                            ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{typeMap.get(t.name)}</span>
                            : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        <Button size="sm" variant={isActive?"default":"ghost"} className="h-7 px-3 text-xs"
                          onClick={() => { if (isActive) setEditingBuilding(null); else { setEditingBuilding(b); setEditF({name:b.name}); setShowCreate(false); } }}>
                          {isActive ? "Close" : "Edit"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!data.buildings.length && (
                  <tr><td colSpan={2 + data.unitTypes.length} className="px-4 py-8 text-center text-muted-foreground">No buildings yet.</td></tr>
                )}
              </tbody>
            </table>
        </div>

        {/* Edit Panel */}
        {editingBuilding && (
          <div className="border border-blue-200 rounded-lg p-4">
            <p className="text-base font-semibold pb-3 border-b">{editingBuilding.name}</p>
            <div className="space-y-4 pt-4">
              <div><Label className="text-xs">Building Name</Label><Input value={editF.name} onChange={e=>setEditF({...editF,name:e.target.value})} className="h-8 text-sm mt-1" /></div>

              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={saveEdit}>Save changes</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingBuilding(null)}>Cancel</Button>
              </div>

              <div className="pt-2 border-t">
                {(() => {
                  const unitCount = Array.from(unitCountMap.get(editingBuilding.id)?.values() ?? []).reduce((s,n)=>s+n,0);
                  return unitCount > 0
                    ? <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-3 py-2">Cannot delete — {unitCount} unit{unitCount!==1?"s":""} assigned. Remove units first.</div>
                    : <Button size="sm" variant="destructive" className="w-full" onClick={() => del(editingBuilding.id)}>Delete building</Button>;
                })()}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Units Config ──────────────────────────────────────────────────────────
function UnitsCfg({ data, reload }: { data: Data; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [f, setF] = useState({buildingId:"", name:"", type:"", size:"", entrance:"", floor:"", ownerId:"none", tenantId:"none"});
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [editingUnit, setEditingUnit] = useState<Unit|null>(null);
  const [editF, setEditF] = useState({buildingId:"", name:"", type:"", size:"", entrance:"", floor:"", ownerId:"none", tenantId:"none"});
  const [filterBuilding, setFilterBuilding] = useState("all");

  const sb = createClient();
  const buildingMap = new Map(data.buildings.map(b => [b.id, b.name]));
  const ownerMap = new Map(data.unitOwners.map(uo => [uo.unit_id, uo.owner_id]));
  const tenantMap = new Map(data.unitTenantAssignments.map(a => [a.unit_id, a.tenant_id]));
  const profileMap = new Map(data.profiles.map(p => [p.id, p]));

  const filteredUnits = filterBuilding === "all"
    ? data.units
    : data.units.filter(u => u.building_id === filterBuilding);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { data: inserted, error } = await sb.from("units").insert({ building_id:f.buildingId, unit_name:f.name, type:f.type, size_m2:f.size?parseFloat(f.size):null, entrance:f.entrance||null, floor:f.floor||null }).select("id").single();
    if (error) { setMsg({text:error.message,ok:false}); return; }
    if (f.ownerId && f.ownerId !== "none" && inserted?.id) {
      await sb.from("unit_owners").insert({ unit_id: inserted.id, owner_id: f.ownerId });
    }
    if (f.tenantId && f.tenantId !== "none" && inserted?.id) {
      await sb.from("unit_tenant_assignments").upsert({ unit_id: inserted.id, tenant_id: f.tenantId, is_payment_responsible: true });
    }
    setMsg({text:"Unit created.",ok:true}); setF({buildingId:"",name:"",type:"",size:"",entrance:"",floor:"",ownerId:"none",tenantId:"none"}); setShowCreate(false); reload();
  }

  async function saveEdit() {
    if (!editingUnit) return;
    const { error } = await sb.from("units").update({ building_id:editF.buildingId, unit_name:editF.name, type:editF.type, size_m2:editF.size?parseFloat(editF.size):null, entrance:editF.entrance||null, floor:editF.floor||null }).eq("id", editingUnit.id);
    if (error) { setMsg({text:error.message,ok:false}); return; }
    await sb.from("unit_owners").delete().eq("unit_id", editingUnit.id);
    if (editF.ownerId && editF.ownerId !== "none") {
      await sb.from("unit_owners").insert({ unit_id: editingUnit.id, owner_id: editF.ownerId });
    }
    await sb.from("unit_tenant_assignments").delete().eq("unit_id", editingUnit.id);
    if (editF.tenantId && editF.tenantId !== "none") {
      await sb.from("unit_tenant_assignments").insert({ unit_id: editingUnit.id, tenant_id: editF.tenantId, is_payment_responsible: true });
    }
    setMsg({text:"Unit updated.",ok:true}); setEditingUnit(null); reload();
  }

  async function del(id: string) {
    const { error } = await sb.from("units").delete().eq("id", id);
    if (!error) { setMsg({text:"Unit deleted.",ok:true}); setEditingUnit(null); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok?"text-green-600":"text-red-500"}`}>{msg.text}</p>}

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Units ({filteredUnits.length})</h3>
          <Select value={filterBuilding} onValueChange={setFilterBuilding}>
            <SelectTrigger className="h-7 w-44 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All buildings</SelectItem>
              {data.buildings.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingUnit(null); }}>
          {showCreate ? "Cancel" : "+ Add unit"}
        </Button>
      </div>

      {showCreate && (
        <div className="border border-green-200 bg-green-50/20 rounded-lg p-4">
          <p className="text-base font-semibold mb-3">Add Unit</p>
          <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <div><Label className="text-xs">Building</Label>
                <Select value={f.buildingId} onValueChange={v=>setF({...f,buildingId:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select building"/></SelectTrigger>
                  <SelectContent>{data.buildings.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Unit name</Label><Input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="AP-101" required className="h-8 text-sm"/></div>
              <div><Label className="text-xs">Type</Label>
                <Select value={f.type} onValueChange={v=>setF({...f,type:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select type"/></SelectTrigger>
                  <SelectContent>{data.unitTypes.map(t=><SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Size (m²)</Label><Input type="number" step="0.01" value={f.size} onChange={e=>setF({...f,size:e.target.value})} className="h-8 text-sm" placeholder="e.g. 75"/></div>
              <div><Label className="text-xs">Entrance</Label><Input value={f.entrance} onChange={e=>setF({...f,entrance:e.target.value})} className="h-8 text-sm" placeholder="e.g. A"/></div>
              <div><Label className="text-xs">Floor</Label><Input value={f.floor} onChange={e=>setF({...f,floor:e.target.value})} className="h-8 text-sm" placeholder="e.g. 3"/></div>
              <div className="col-span-2 md:col-span-1"><Label className="text-xs">Owner</Label>
                <Select value={f.ownerId} onValueChange={v=>setF({...f,ownerId:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select owner"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No owner —</SelectItem>
                    {data.profiles.filter(p=>p.role==="owner").map(p=><SelectItem key={p.id} value={p.id}>{p.name} {p.surname} ({p.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-1"><Label className="text-xs">Tenant (optional)</Label>
                <Select value={f.tenantId} onValueChange={v=>setF({...f,tenantId:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select tenant"/></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No tenant —</SelectItem>
                    {data.profiles.filter(p=>p.role==="tenant").map(p=><SelectItem key={p.id} value={p.id}>{p.name} {p.surname} ({p.email})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-3 flex gap-2">
                <Button type="submit" size="sm" disabled={!f.buildingId || !f.type}>Create unit</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Units Table */}
        <div className={`overflow-x-auto ${editingUnit ? "md:col-span-1" : "md:col-span-2"}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unit</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Building</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">m²</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Entr.</th>
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground">Floor</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Owner</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUnits.map(u => {
                  const ownerId = ownerMap.get(u.id);
                  const owner = ownerId ? profileMap.get(ownerId) : null;
                  const isActive = editingUnit?.id === u.id;
                  return (
                    <tr key={u.id} className={`transition-colors ${isActive?"bg-blue-50":"hover:bg-muted/20"}`}>
                      <td className="px-4 py-3 font-semibold">{u.unit_name}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{buildingMap.get(u.building_id) ?? "—"}</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-muted px-2 py-0.5 rounded-full">{u.type}</span>
                      </td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{u.size_m2 ?? <span className="text-muted-foreground/30">—</span>}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{u.entrance ?? <span className="text-muted-foreground/30">—</span>}</td>
                      <td className="px-4 py-3 text-center text-muted-foreground">{u.floor ?? <span className="text-muted-foreground/30">—</span>}</td>
                      <td className="px-4 py-3">
                        {owner
                          ? <div className="flex items-center gap-2 flex-wrap"><Avatar profile={owner} /><span className="text-sm">{owner.name} {owner.surname}</span></div>
                          : <span className="text-xs text-muted-foreground/50">No owner</span>}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          const tid = tenantMap.get(u.id);
                          const tenant = tid ? profileMap.get(tid) : null;
                          return tenant
                            ? <div className="flex items-center gap-2 flex-wrap"><Avatar profile={tenant} /><span className="text-sm">{tenant.name} {tenant.surname}</span></div>
                            : <span className="text-xs text-muted-foreground/50">—</span>;
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant={isActive?"default":"ghost"} className="h-7 px-3 text-xs"
                          onClick={() => { if (isActive) setEditingUnit(null); else { const oid = ownerMap.get(u.id); const tid = tenantMap.get(u.id); setEditingUnit(u); setEditF({buildingId:u.building_id,name:u.unit_name,type:u.type,size:u.size_m2?.toString()??"",entrance:u.entrance??"",floor:u.floor??"",ownerId:oid??"none",tenantId:tid??"none"}); setShowCreate(false); } }}>
                          {isActive ? "Close" : "Edit"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!filteredUnits.length && (
                  <tr><td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">No units yet.</td></tr>
                )}
              </tbody>
            </table>
        </div>

        {/* Edit Panel */}
        {editingUnit && (
          <div className="border border-blue-200 rounded-lg p-4">
            <p className="text-base font-semibold pb-3 border-b">{editingUnit.unit_name} · {buildingMap.get(editingUnit.building_id)}</p>
            <div className="space-y-3 pt-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="col-span-2"><Label className="text-xs">Building</Label>
                  <Select value={editF.buildingId} onValueChange={v=>setEditF({...editF,buildingId:v})}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{data.buildings.map(b=><SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Unit name</Label><Input value={editF.name} onChange={e=>setEditF({...editF,name:e.target.value})} className="h-8 text-sm"/></div>
                <div><Label className="text-xs">Type</Label>
                  <Select value={editF.type} onValueChange={v=>setEditF({...editF,type:v})}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                    <SelectContent>{data.unitTypes.map(t=><SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Size (m²)</Label><Input type="number" step="0.01" value={editF.size} onChange={e=>setEditF({...editF,size:e.target.value})} className="h-8 text-sm"/></div>
                <div><Label className="text-xs">Entrance</Label><Input value={editF.entrance} onChange={e=>setEditF({...editF,entrance:e.target.value})} className="h-8 text-sm" placeholder="e.g. A"/></div>
                <div className="col-span-2"><Label className="text-xs">Floor</Label><Input value={editF.floor} onChange={e=>setEditF({...editF,floor:e.target.value})} className="h-8 text-sm" placeholder="e.g. 3"/></div>
                <div className="col-span-2"><Label className="text-xs">Owner</Label>
                  <Select value={editF.ownerId} onValueChange={v=>setEditF({...editF,ownerId:v})}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select owner"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No owner —</SelectItem>
                      {data.profiles.filter(p=>p.role==="owner").map(p=><SelectItem key={p.id} value={p.id}>{p.name} {p.surname} ({p.email})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2"><Label className="text-xs">Tenant (optional)</Label>
                  <Select value={editF.tenantId} onValueChange={v=>setEditF({...editF,tenantId:v})}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select tenant"/></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— No tenant —</SelectItem>
                      {data.profiles.filter(p=>p.role==="tenant").map(p=><SelectItem key={p.id} value={p.id}>{p.name} {p.surname} ({p.email})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={saveEdit}>Save changes</Button>
                <Button size="sm" variant="outline" onClick={() => setEditingUnit(null)}>Cancel</Button>
              </div>
              <div className="pt-2 border-t">
                <Button size="sm" variant="destructive" className="w-full" onClick={() => del(editingUnit.id)}>Delete unit</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Unit Types Config ────────────────────────────────────────────────────
function UnitTypesCfg({ data, reload }: { data: Data; reload: () => void }) {
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editName, setEditName] = useState("");

  const sb = createClient();

  // Count units per type
  const countMap = new Map<string,number>();
  data.units.forEach(u => countMap.set(u.type, (countMap.get(u.type) ?? 0) + 1));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb.from("unit_types").insert({ name: newName });
    if (!error) { setMsg({text:"Unit type created.",ok:true}); setNewName(""); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function save(id: string) {
    const { error } = await sb.from("unit_types").update({ name: editName }).eq("id", id);
    if (!error) { setMsg({text:"Updated.",ok:true}); setEditingId(null); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function del(id: string, typeName: string) {
    const count = countMap.get(typeName) ?? 0;
    if (count > 0) { setMsg({text:`Cannot delete — ${count} unit${count!==1?"s":""} use this type.`,ok:false}); return; }
    const { error } = await sb.from("unit_types").delete().eq("id", id);
    if (!error) { setMsg({text:"Deleted.",ok:true}); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok?"text-green-600":"text-red-500"}`}>{msg.text}</p>}

      <div>
        <h3 className="text-base font-semibold mb-1">Unit Types ({data.unitTypes.length})</h3>
        <p className="text-xs text-muted-foreground mb-4">Unit types are used to categorize units and link services to billing.</p>
        <div className="space-y-4">
          {/* Add form */}
          <form onSubmit={create} className="flex gap-2 items-end">
            <div className="flex-1 max-w-xs"><Label className="text-xs">New Type Name</Label><Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Apartment, Parking, Garden" required className="h-8 text-sm"/></div>
            <Button type="submit" size="sm">Add</Button>
          </form>

          {/* Table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Type Name</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Units Assigned</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Used in Services</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.unitTypes.map(t => {
                const unitCount = countMap.get(t.name) ?? 0;
                const serviceCount = data.services.filter(s => s.unit_type === t.name).length;
                const inUse = unitCount > 0 || serviceCount > 0;
                const isEditing = editingId === t.id;
                return (
                  <tr key={t.id} className={`transition-colors ${isEditing?"bg-blue-50":"hover:bg-muted/20"}`}>
                    <td className="px-4 py-3">
                      {isEditing
                        ? <Input value={editName} onChange={e=>setEditName(e.target.value)} className="h-8 text-sm w-48" autoFocus onKeyDown={e=>e.key==="Enter"&&save(t.id)} />
                        : <span className="font-medium">{t.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {unitCount > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{unitCount}</span>
                        : <span className="text-muted-foreground/30">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {serviceCount > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-green-100 text-green-700 text-xs font-bold">{serviceCount}</span>
                        : <span className="text-muted-foreground/30">0</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(t.id)}>Save</Button>
                          <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setEditingId(t.id); setEditName(t.name); }}>Edit</Button>
                          {inUse
                            ? <span className="text-xs text-muted-foreground/50 px-2 py-1">In use</span>
                            : <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => del(t.id, t.name)}>Delete</Button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.unitTypes.length && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No unit types yet. Add one above.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Services Config ──────────────────────────────────────────────────────
function ServicesCfg({ data, reload }: { data: Data; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [f, setF] = useState({name:"", unitType:"", category:"", pricing:"fixed_per_unit", price:"", freq:"recurrent"});
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editF, setEditF] = useState({name:"", unitType:"", category:"", pricing:"fixed_per_unit", price:"", freq:"recurrent"});

  const sb = createClient();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb.from("services").insert({ name:f.name, unit_type:f.unitType, category:f.category||null, pricing_model:f.pricing, price_value:parseFloat(f.price)||0, frequency:f.freq });
    if (!error) { setMsg({text:"Service created.",ok:true}); setF({name:"",unitType:"",category:"",pricing:"fixed_per_unit",price:"",freq:"recurrent"}); setShowCreate(false); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function save(id: string) {
    const { error } = await sb.from("services").update({ name:editF.name, unit_type:editF.unitType, category:editF.category||null, pricing_model:editF.pricing, price_value:parseFloat(editF.price)||0, frequency:editF.freq }).eq("id", id);
    if (!error) { setMsg({text:"Updated.",ok:true}); setEditingId(null); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function del(id: string) {
    const { error } = await sb.from("services").delete().eq("id", id);
    if (!error) { setMsg({text:"Deleted.",ok:true}); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  const pricingLabel = (m: string) => m === "per_m2" ? "Per m²" : "Fixed/unit";

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok?"text-green-600":"text-red-500"}`}>{msg.text}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Services ({data.services.length})</h3>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}>{showCreate?"Cancel":"+ Add service"}</Button>
      </div>

      {showCreate && (
        <div className="border border-green-200 bg-green-50/20 rounded-lg p-4">
          <p className="text-base font-semibold mb-3">Add Service</p>
          <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <div><Label className="text-xs">Service Name</Label><Input value={f.name} onChange={e=>setF({...f,name:e.target.value})} placeholder="e.g. Maintenance" required className="h-8 text-sm"/></div>
              <div><Label className="text-xs">Category</Label>
                <Select value={f.category} onValueChange={v=>setF({...f,category:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select category"/></SelectTrigger>
                  <SelectContent>{data.serviceCategories.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Unit Type</Label>
                <Select value={f.unitType} onValueChange={v=>setF({...f,unitType:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select type"/></SelectTrigger>
                  <SelectContent>{data.unitTypes.map(t=><SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Pricing Model</Label>
                <Select value={f.pricing} onValueChange={v=>setF({...f,pricing:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="fixed_per_unit">Fixed per unit</SelectItem><SelectItem value="per_m2">Per m²</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Price Value</Label><Input type="number" step="0.01" value={f.price} onChange={e=>setF({...f,price:e.target.value})} required className="h-8 text-sm" placeholder="0.00"/></div>
              <div><Label className="text-xs">Frequency</Label>
                <Select value={f.freq} onValueChange={v=>setF({...f,freq:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="recurrent">Recurrent</SelectItem><SelectItem value="one_time">One-time</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-3 flex gap-2">
                <Button type="submit" size="sm" disabled={!f.unitType}>Create service</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
        </div>
      )}

      <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Service</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Unit Type</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Pricing</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Price</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Frequency</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.services.map(s => {
                const isEditing = editingId === s.id;
                return (
                  <tr key={s.id} className={`transition-colors ${isEditing?"bg-blue-50":"hover:bg-muted/20"}`}>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2"><Input value={editF.name} onChange={e=>setEditF({...editF,name:e.target.value})} className="h-8 text-sm w-36"/></td>
                        <td className="px-4 py-2">
                          <Select value={editF.category||"none"} onValueChange={v=>setEditF({...editF,category:v==="none"?"":v})}>
                            <SelectTrigger className="h-8 text-sm w-32"><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="none">— None —</SelectItem>{data.serviceCategories.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <Select value={editF.unitType} onValueChange={v=>setEditF({...editF,unitType:v})}>
                            <SelectTrigger className="h-8 text-sm w-28"><SelectValue/></SelectTrigger>
                            <SelectContent>{data.unitTypes.map(t=><SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <Select value={editF.pricing} onValueChange={v=>setEditF({...editF,pricing:v})}>
                            <SelectTrigger className="h-8 text-sm w-32"><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="fixed_per_unit">Fixed/unit</SelectItem><SelectItem value="per_m2">Per m²</SelectItem></SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2"><Input type="number" step="0.01" value={editF.price} onChange={e=>setEditF({...editF,price:e.target.value})} className="h-8 text-sm w-20"/></td>
                        <td className="px-4 py-2">
                          <Select value={editF.freq} onValueChange={v=>setEditF({...editF,freq:v})}>
                            <SelectTrigger className="h-8 text-sm w-28"><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="recurrent">Recurrent</SelectItem><SelectItem value="one_time">One-time</SelectItem></SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(s.id)}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:bg-red-50" onClick={() => del(s.id)}>Delete</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium">{s.name}</td>
                        <td className="px-4 py-3">
                          {(s as Service & {category?:string}).category
                            ? <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">{(s as Service & {category?:string}).category}</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3"><span className="text-xs bg-muted px-2 py-0.5 rounded-full">{s.unit_type}</span></td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{pricingLabel(s.pricing_model)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{Number(s.price_value).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {s.frequency === "recurrent"
                            ? <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Recurrent</span>
                            : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">One-time</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setEditingId(s.id); setEditF({name:s.name, unitType:s.unit_type, category:(s as Service & {category?:string}).category??"", pricing:s.pricing_model, price:s.price_value.toString(), freq:s.frequency}); setShowCreate(false); }}>Edit</Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {!data.services.length && (
                <tr><td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">No services yet. Add one above.</td></tr>
              )}
            </tbody>
          </table>
      </div>
    </div>
  );
}

// ─── Expenses Config ──────────────────────────────────────────────────────
function ExpensesCfg({ data, reload }: { data: Data; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [f, setF] = useState({title:"", category:"", vendor:"", amount:"", freq:"recurrent"});
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editF, setEditF] = useState({title:"", category:"", vendor:"", amount:"", freq:"recurrent"});

  const sb = createClient();

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb.from("expenses").insert({ title:f.title, category:f.category, vendor:f.vendor, amount:parseFloat(f.amount)||0, frequency:f.freq });
    if (!error) { setMsg({text:"Expense created.",ok:true}); setF({title:"",category:"",vendor:"",amount:"",freq:"recurrent"}); setShowCreate(false); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function save(id: string) {
    const { error } = await sb.from("expenses").update({ title:editF.title, category:editF.category, vendor:editF.vendor, amount:parseFloat(editF.amount)||0, frequency:editF.freq }).eq("id", id);
    if (!error) { setMsg({text:"Updated.",ok:true}); setEditingId(null); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function del(id: string) {
    const { error } = await sb.from("expenses").delete().eq("id", id);
    if (!error) { setMsg({text:"Deleted.",ok:true}); setEditingId(null); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  const templates = data.expenses.filter(e => e.template_id == null && e.period_month == null);
  const monthlyTotal = templates.filter(e=>e.frequency==="recurrent").reduce((s,e)=>s+Number(e.amount),0);

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok?"text-green-600":"text-red-500"}`}>{msg.text}</p>}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold">Expense Templates ({templates.length})</h3>
          {monthlyTotal > 0 && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Monthly total: {monthlyTotal.toFixed(2)}</span>}
        </div>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingId(null); }}>{showCreate ? "Cancel" : "+ Add expense"}</Button>
      </div>

      {showCreate && (
        <div className="border border-green-200 bg-green-50/20 rounded-lg p-4">
          <p className="text-base font-semibold mb-3">Add Expense</p>
          <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-3 items-end">
              <div className="col-span-2 md:col-span-1"><Label className="text-xs">Title</Label><Input value={f.title} onChange={e=>setF({...f,title:e.target.value})} placeholder="e.g. Monthly Security" required className="h-8 text-sm"/></div>
              <div><Label className="text-xs">Category</Label>
                <Select value={f.category} onValueChange={v=>setF({...f,category:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select category"/></SelectTrigger>
                  <SelectContent>{data.serviceCategories.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Vendor</Label>
                <Select value={f.vendor} onValueChange={v=>setF({...f,vendor:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="Select vendor"/></SelectTrigger>
                  <SelectContent>{data.vendors.map(v=><SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Amount</Label><Input type="number" step="0.01" value={f.amount} onChange={e=>setF({...f,amount:e.target.value})} required className="h-8 text-sm" placeholder="0.00"/></div>
              <div><Label className="text-xs">Frequency</Label>
                <Select value={f.freq} onValueChange={v=>setF({...f,freq:v})}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="recurrent">Recurrent (monthly)</SelectItem><SelectItem value="ad_hoc">Ad-hoc (one-off)</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-3 flex gap-2">
                <Button type="submit" size="sm">Create expense</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
        </div>
      )}

      <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Title</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Frequency</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {templates.map(e => {
                const isEditing = editingId === e.id;
                return (
                  <tr key={e.id} className={`transition-colors ${isEditing?"bg-blue-50":"hover:bg-muted/20"}`}>
                    {isEditing ? (
                      <>
                        <td className="px-4 py-2"><Input value={editF.title} onChange={ev=>setEditF({...editF,title:ev.target.value})} className="h-8 text-sm w-40"/></td>
                        <td className="px-4 py-2">
                          <Select value={editF.category||"none"} onValueChange={v=>setEditF({...editF,category:v==="none"?"":v})}>
                            <SelectTrigger className="h-8 text-sm w-32"><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="none">— None —</SelectItem>{data.serviceCategories.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <Select value={editF.vendor||"none"} onValueChange={v=>setEditF({...editF,vendor:v==="none"?"":v})}>
                            <SelectTrigger className="h-8 text-sm w-32"><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="none">— None —</SelectItem>{data.vendors.map(v=><SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2"><Input type="number" step="0.01" value={editF.amount} onChange={ev=>setEditF({...editF,amount:ev.target.value})} className="h-8 text-sm w-24"/></td>
                        <td className="px-4 py-2">
                          <Select value={editF.freq} onValueChange={v=>setEditF({...editF,freq:v})}>
                            <SelectTrigger className="h-8 text-sm w-28"><SelectValue/></SelectTrigger>
                            <SelectContent><SelectItem value="recurrent">Recurrent</SelectItem><SelectItem value="ad_hoc">Ad-hoc</SelectItem></SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(e.id)}>Save</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-500 hover:bg-red-50" onClick={() => del(e.id)}>Delete</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-medium">{e.title}</td>
                        <td className="px-4 py-3">
                          {e.category
                            ? <span className="text-xs bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">{e.category}</span>
                            : <span className="text-muted-foreground/40">—</span>}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{e.vendor || <span className="text-muted-foreground/40">—</span>}</td>
                        <td className="px-4 py-3 text-right font-semibold text-red-600">{Number(e.amount).toFixed(2)}</td>
                        <td className="px-4 py-3">
                          {e.frequency === "recurrent"
                            ? <span className="text-xs bg-orange-50 text-orange-700 px-2 py-0.5 rounded-full">Recurrent</span>
                            : <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">Ad-hoc</span>}
                        </td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setEditingId(e.id); setEditF({title:e.title,category:e.category,vendor:e.vendor,amount:e.amount.toString(),freq:e.frequency}); setShowCreate(false); }}>Edit</Button>
                        </td>
                      </>
                    )}
                  </tr>
                );
              })}
              {!templates.length && (
                <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No expense templates yet. Add one above.</td></tr>
              )}
            </tbody>
          </table>
      </div>
    </div>
  );
}

// ─── Vendors Config ───────────────────────────────────────────────────────
function VendorsCfg({ data, reload }: { data: Data; reload: () => void }) {
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editName, setEditName] = useState("");
  const sb = createClient();

  const expenseCountMap = new Map<string,number>();
  data.expenses.forEach(e => expenseCountMap.set(e.vendor, (expenseCountMap.get(e.vendor) ?? 0) + 1));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb.from("vendors").insert({ name: newName });
    if (!error) { setMsg({text:"Vendor created.",ok:true}); setNewName(""); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function save(id: string) {
    const { error } = await sb.from("vendors").update({ name: editName }).eq("id", id);
    if (!error) { setMsg({text:"Updated.",ok:true}); setEditingId(null); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function del(id: string, name: string) {
    const count = expenseCountMap.get(name) ?? 0;
    if (count > 0) { setMsg({text:`Cannot delete — used in ${count} expense${count!==1?"s":""}.`,ok:false}); return; }
    const { error } = await sb.from("vendors").delete().eq("id", id);
    if (!error) { setMsg({text:"Deleted.",ok:true}); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok?"text-green-600":"text-red-500"}`}>{msg.text}</p>}
      <div>
        <h3 className="text-base font-semibold mb-1">Vendors ({data.vendors.length})</h3>
        <p className="text-xs text-muted-foreground mb-4">Companies or individuals providing services linked to expenses.</p>
        <div className="space-y-4">
          <form onSubmit={create} className="flex gap-2 items-end">
            <div className="flex-1 max-w-xs"><Label className="text-xs">Vendor Name</Label><Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Octapus Security" required className="h-8 text-sm"/></div>
            <Button type="submit" size="sm">Add</Button>
          </form>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Vendor Name</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">Linked Expenses</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground">Total Amount</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.vendors.map(v => {
                const linked = data.expenses.filter(e => e.vendor === v.name);
                const total = linked.reduce((s,e) => s + Number(e.amount), 0);
                const isEditing = editingId === v.id;
                return (
                  <tr key={v.id} className={`transition-colors ${isEditing?"bg-blue-50":"hover:bg-muted/20"}`}>
                    <td className="px-4 py-3">
                      {isEditing
                        ? <Input value={editName} onChange={e=>setEditName(e.target.value)} className="h-8 text-sm w-52" autoFocus onKeyDown={e=>e.key==="Enter"&&save(v.id)} />
                        : <span className="font-medium">{v.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {linked.length > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">{linked.length}</span>
                        : <span className="text-muted-foreground/30">0</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      {total > 0 ? <span className="text-red-600">{total.toFixed(2)}</span> : <span className="text-muted-foreground/30">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(v.id)}>Save</Button>
                          <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setEditingId(v.id); setEditName(v.name); }}>Edit</Button>
                          {linked.length > 0
                            ? <span className="text-xs text-muted-foreground/50 px-2 py-1">In use</span>
                            : <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => del(v.id, v.name)}>Delete</Button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.vendors.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No vendors yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Categories Config ────────────────────────────────────────────────────
function CategoriesCfg({ data, reload }: { data: Data; reload: () => void }) {
  const [newName, setNewName] = useState("");
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [editingId, setEditingId] = useState<string|null>(null);
  const [editName, setEditName] = useState("");
  const sb = createClient();

  // Count usages per category
  const expUsage = new Map<string,number>();
  data.expenses.forEach(e => expUsage.set(e.category, (expUsage.get(e.category) ?? 0) + 1));
  const svcUsage = new Map<string,number>();
  data.services.forEach(s => { const cat = (s as Service & {category?:string}).category; if (cat) svcUsage.set(cat, (svcUsage.get(cat) ?? 0) + 1); });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb.from("service_categories").insert({ name: newName });
    if (!error) { setMsg({text:"Category created.",ok:true}); setNewName(""); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function save(id: string) {
    const { error } = await sb.from("service_categories").update({ name: editName }).eq("id", id);
    if (!error) { setMsg({text:"Updated.",ok:true}); setEditingId(null); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function del(id: string, name: string) {
    const total = (expUsage.get(name) ?? 0) + (svcUsage.get(name) ?? 0);
    if (total > 0) { setMsg({text:`Cannot delete — used in ${total} item${total!==1?"s":""}.`,ok:false}); return; }
    const { error } = await sb.from("service_categories").delete().eq("id", id);
    if (!error) { setMsg({text:"Deleted.",ok:true}); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok?"text-green-600":"text-red-500"}`}>{msg.text}</p>}
      <div>
        <h3 className="text-base font-semibold mb-1">Service Categories ({data.serviceCategories.length})</h3>
        <p className="text-xs text-muted-foreground mb-4">Categories group expenses and services (e.g. Security, Cleaning, Utilities).</p>
        <div className="space-y-4">
          <form onSubmit={create} className="flex gap-2 items-end">
            <div className="flex-1 max-w-xs"><Label className="text-xs">Category Name</Label><Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="e.g. Security, Cleaning" required className="h-8 text-sm"/></div>
            <Button type="submit" size="sm">Add</Button>
          </form>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Category Name</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">In Expenses</th>
                <th className="px-4 py-3 text-center font-medium text-muted-foreground">In Services</th>
                <th className="px-4 py-3 text-left font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.serviceCategories.map(c => {
                const expCount = expUsage.get(c.name) ?? 0;
                const svcCount = svcUsage.get(c.name) ?? 0;
                const inUse = expCount > 0 || svcCount > 0;
                const isEditing = editingId === c.id;
                return (
                  <tr key={c.id} className={`transition-colors ${isEditing?"bg-blue-50":"hover:bg-muted/20"}`}>
                    <td className="px-4 py-3">
                      {isEditing
                        ? <Input value={editName} onChange={e=>setEditName(e.target.value)} className="h-8 text-sm w-52" autoFocus onKeyDown={e=>e.key==="Enter"&&save(c.id)} />
                        : <span className="font-medium">{c.name}</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {expCount > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-orange-100 text-orange-700 text-xs font-bold">{expCount}</span>
                        : <span className="text-muted-foreground/30">0</span>}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {svcCount > 0
                        ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-purple-100 text-purple-700 text-xs font-bold">{svcCount}</span>
                        : <span className="text-muted-foreground/30">0</span>}
                    </td>
                    <td className="px-4 py-3">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <Button size="sm" className="h-7 px-3 text-xs" onClick={() => save(c.id)}>Save</Button>
                          <Button size="sm" variant="outline" className="h-7 px-3 text-xs" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      ) : (
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 px-3 text-xs" onClick={() => { setEditingId(c.id); setEditName(c.name); }}>Edit</Button>
                          {inUse
                            ? <span className="text-xs text-muted-foreground/50 px-2 py-1">In use</span>
                            : <Button size="sm" variant="ghost" className="h-7 px-3 text-xs text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => del(c.id, c.name)}>Delete</Button>}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!data.serviceCategories.length && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">No categories yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Avatar component ─────────────────────────────────────────────────────
function Avatar({ profile, large = false }: { profile: Profile; large?: boolean }) {
  const initials = `${profile.name?.[0]??""}${profile.surname?.[0]??""}`.toUpperCase();
  const colors = ["bg-blue-500","bg-purple-500","bg-green-500","bg-orange-500","bg-pink-500","bg-indigo-500","bg-teal-500","bg-rose-500"];
  const color = colors[(profile.name.charCodeAt(0) ?? 0) % colors.length];
  const cls = large ? "w-12 h-12 text-base" : "w-8 h-8 text-xs";
  if (profile.avatar_url) {
    return <img src={profile.avatar_url} alt={initials} className={`${cls} rounded-full object-cover ring-2 ring-white flex-shrink-0`} />;
  }
  return <div className={`${cls} rounded-full ${color} flex items-center justify-center text-white font-bold ring-2 ring-white flex-shrink-0`}>{initials}</div>;
}

// ─── Users Config ─────────────────────────────────────────────────────────
function UsersCfg({ data, reload }: { data: Data; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [f, setF] = useState({name:"",surname:"",email:"",password:"",phone:"",role:"owner"});
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [assigningUnit, setAssigningUnit] = useState<{profileId:string}|null>(null);
  const [selectedUnit, setSelectedUnit] = useState("");
  const [editingUser, setEditingUser] = useState<Profile|null>(null);
  const [editF, setEditF] = useState({name:"",surname:"",phone:"",role:""});
  const [newPassword, setNewPassword] = useState("");
  const [uploadingFor, setUploadingFor] = useState<string|null>(null);

  // Build maps for quick lookup
  const ownerMap = new Map(data.unitOwners.map(uo => [uo.unit_id, uo.owner_id]));
  const profileUnitsMap = new Map<string, string[]>();
  data.unitOwners.forEach(uo => {
    const existing = profileUnitsMap.get(uo.owner_id) ?? [];
    profileUnitsMap.set(uo.owner_id, [...existing, uo.unit_id]);
  });
  const unitNameMap = new Map(data.units.map(u => [u.id, u.unit_name]));

  async function create(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await fetch("/api/users/create", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(f) });
      const r = await res.json();
      if(r.success){ setMsg({text:"User created successfully.",ok:true}); setF({name:"",surname:"",email:"",password:"",phone:"",role:"owner"}); setShowCreate(false); reload(); }
      else setMsg({text:r.error??"Failed",ok:false});
    } catch { setMsg({text:"Failed to create user.",ok:false}); }
  }

  async function saveEdit() {
    if (!editingUser) return;
    const res = await fetch("/api/users/update", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({userId:editingUser.id,...editF}) });
    const r = await res.json();
    if (r.success) { setMsg({text:"User updated.",ok:true}); setEditingUser(null); reload(); }
    else setMsg({text:r.error??"Failed",ok:false});
  }

  async function resetPassword() {
    if (!editingUser || newPassword.length < 6) { setMsg({text:"Password must be at least 6 characters.",ok:false}); return; }
    const res = await fetch("/api/users/update", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({userId:editingUser.id, newPassword}) });
    const r = await res.json();
    if (r.success) { setMsg({text:"Password reset.",ok:true}); setNewPassword(""); }
    else setMsg({text:r.error??"Failed",ok:false});
  }

  async function deleteUser(userId: string) {
    if (!confirm("Delete this user permanently? This cannot be undone.")) return;
    const res = await fetch(`/api/users/update?userId=${userId}`, { method:"DELETE" });
    const r = await res.json();
    if (r.success) { setMsg({text:"User deleted.",ok:true}); setEditingUser(null); reload(); }
    else setMsg({text:r.error??"Failed",ok:false});
  }

  async function assignUnit(profileId: string, unitId: string) {
    await createClient().from("unit_owners").upsert({unit_id:unitId, owner_id:profileId});
    setAssigningUnit(null); setSelectedUnit(""); reload();
  }

  async function removeUnit(unitId: string) {
    await createClient().from("unit_owners").delete().eq("unit_id", unitId);
    reload();
  }

  async function uploadAvatar(profileId: string, file: File) {
    setUploadingFor(profileId);
    const sb = createClient();
    const ext = file.name.split(".").pop();
    const path = `${profileId}.${ext}`;
    const { error: upErr } = await sb.storage.from("avatars").upload(path, file, { upsert: true });
    if (!upErr) {
      const { data: urlData } = sb.storage.from("avatars").getPublicUrl(path);
      await sb.from("profiles").update({ avatar_url: urlData.publicUrl }).eq("id", profileId);
      if (editingUser?.id === profileId) setEditingUser({...editingUser, avatar_url: urlData.publicUrl});
      reload();
    } else setMsg({text:"Upload failed: " + upErr.message, ok:false});
    setUploadingFor(null);
  }

  const roleBadge = (role: string) => {
    const styles: Record<string,string> = { manager:"bg-purple-100 text-purple-700", owner:"bg-blue-100 text-blue-700", tenant:"bg-green-100 text-green-700" };
    return <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${styles[role]??"bg-gray-100 text-gray-600"}`}>{role}</span>;
  };

  return (
    <div className="space-y-4">
      {msg.text && <p className={`text-sm ${msg.ok?"text-green-600":"text-red-500"}`}>{msg.text}</p>}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Users ({data.profiles.length})</h3>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingUser(null); }}>{showCreate ? "Cancel" : "+ Add user"}</Button>
      </div>

      {/* Create User Form */}
      {showCreate && (
        <div className="border border-green-200 bg-green-50/20 rounded-lg p-4">
          <p className="text-base font-semibold mb-3">Create New User</p>
          <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><Label>Name</Label><Input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required /></div>
              <div><Label>Surname</Label><Input value={f.surname} onChange={e=>setF({...f,surname:e.target.value})} required /></div>
              <div><Label>Email</Label><Input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} required /></div>
              <div><Label>Password</Label><Input type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} required minLength={6} /></div>
              <div><Label>Phone</Label><Input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} placeholder="+355..." /></div>
              <div><Label>Role</Label>
                <Select value={f.role} onValueChange={v=>setF({...f,role:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="tenant">Tenant</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-3 flex gap-2">
                <Button type="submit">Create user</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Users Table */}
        <div className={`overflow-x-auto ${editingUser ? "md:col-span-1" : "md:col-span-2"}`}>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground w-10"></th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Name</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Email</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Role</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Units</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.profiles.map(p => {
                  const assignedUnitIds = profileUnitsMap.get(p.id) ?? [];
                  const assignedNames = assignedUnitIds.map(uid => unitNameMap.get(uid)).filter(Boolean);
                  const isActive = editingUser?.id === p.id;
                  return (
                    <tr key={p.id} className={`transition-colors ${isActive ? "bg-blue-50" : "hover:bg-muted/20"}`}>
                      <td className="px-3 py-2"><Avatar profile={p} /></td>
                      <td className="px-3 py-3">
                        <div className="font-medium">{p.name} {p.surname}</div>
                        <div className="text-xs text-muted-foreground">{p.phone ?? ""}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-muted-foreground">{p.email}</td>
                      <td className="px-3 py-3">{roleBadge(p.role)}</td>
                      <td className="px-3 py-3">
                        {assignedNames.length > 0
                          ? <div className="flex flex-wrap gap-1">{assignedNames.map((n,i) => <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-1.5 py-0.5 rounded">{n}</span>)}</div>
                          : <span className="text-xs text-muted-foreground/50">—</span>}
                      </td>
                      <td className="px-3 py-3">
                        <Button size="sm" variant={isActive?"default":"ghost"} className="h-7 px-3 text-xs"
                          onClick={() => { if (isActive) { setEditingUser(null); setNewPassword(""); } else { setEditingUser(p); setEditF({name:p.name,surname:p.surname,phone:p.phone??"",role:p.role}); setNewPassword(""); setShowCreate(false); } }}>
                          {isActive ? "Close" : "Edit"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!data.profiles.length && <tr><td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">No users yet.</td></tr>}
              </tbody>
            </table>
        </div>

        {/* Edit Panel — shows alongside table when a user is selected */}
        {editingUser && (
          <div className="border border-blue-200 rounded-lg p-4">
            <div className="pb-3 border-b flex items-center gap-3">
              <label className="cursor-pointer relative group flex-shrink-0" title="Click to change photo">
                <Avatar profile={editingUser} large />
                <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadAvatar(editingUser.id, file); }} />
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold">📷</div>
                {uploadingFor === editingUser.id && <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white text-[10px]">...</div>}
              </label>
              <div>
                <p className="text-base font-semibold">{editingUser.name} {editingUser.surname}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{editingUser.email}</p>
              </div>
            </div>
            <div className="space-y-4 pt-4">

              {/* Edit Fields */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Profile</p>
                <div className="grid grid-cols-2 gap-2">
                  <div><Label className="text-xs">Name</Label><Input value={editF.name} onChange={e=>setEditF({...editF,name:e.target.value})} className="h-8 text-sm" /></div>
                  <div><Label className="text-xs">Surname</Label><Input value={editF.surname} onChange={e=>setEditF({...editF,surname:e.target.value})} className="h-8 text-sm" /></div>
                  <div className="col-span-2"><Label className="text-xs">Email</Label><Input value={editingUser.email} disabled className="h-8 text-sm bg-muted text-muted-foreground cursor-not-allowed" /></div>
                  <div><Label className="text-xs">Phone</Label><Input value={editF.phone} onChange={e=>setEditF({...editF,phone:e.target.value})} className="h-8 text-sm" placeholder="+355..." /></div>
                  <div><Label className="text-xs">Role</Label>
                    <Select value={editF.role} onValueChange={v=>setEditF({...editF,role:v})}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue/></SelectTrigger>
                      <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="tenant">Tenant</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                <Button size="sm" className="mt-2 w-full" onClick={saveEdit}>Save profile</Button>
              </div>

              {/* Unit Assignments */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Unit Assignments</p>
                {(() => {
                  const assignedUnitIds = profileUnitsMap.get(editingUser.id) ?? [];
                  const isAssigning = assigningUnit?.profileId === editingUser.id;
                  return (
                    <div className="space-y-2">
                      {assignedUnitIds.map(uid => (
                        <div key={uid} className="flex items-center justify-between bg-blue-50 border border-blue-200 rounded px-3 py-1.5">
                          <span className="text-sm text-blue-800 font-medium">{unitNameMap.get(uid)}</span>
                          <button onClick={() => removeUnit(uid)} className="text-xs text-red-500 hover:text-red-700">Remove</button>
                        </div>
                      ))}
                      {isAssigning ? (
                        <div className="flex gap-2">
                          <Select value={selectedUnit} onValueChange={setSelectedUnit}>
                            <SelectTrigger className="h-8 flex-1"><SelectValue placeholder="Select unit"/></SelectTrigger>
                            <SelectContent>{data.units.filter(u => !ownerMap.has(u.id) || ownerMap.get(u.id) === editingUser.id).map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
                          </Select>
                          <Button size="sm" className="h-8" onClick={() => selectedUnit && assignUnit(editingUser.id, selectedUnit)} disabled={!selectedUnit}>Assign</Button>
                          <Button size="sm" variant="ghost" className="h-8" onClick={() => { setAssigningUnit(null); setSelectedUnit(""); }}>✕</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="outline" className="w-full h-8 text-xs" onClick={() => { setAssigningUnit({profileId:editingUser.id}); setSelectedUnit(""); }}>+ Assign unit</Button>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Reset Password */}
              <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Reset Password</p>
                <div className="flex gap-2">
                  <Input type="password" value={newPassword} onChange={e=>setNewPassword(e.target.value)} placeholder="New password (min. 6)" className="h-8 text-sm flex-1" />
                  <Button size="sm" className="h-8" variant="outline" onClick={resetPassword} disabled={newPassword.length < 6}>Set</Button>
                </div>
              </div>

              {/* Delete */}
              <div className="pt-2 border-t">
                <Button size="sm" variant="destructive" className="w-full" onClick={() => deleteUser(editingUser.id)}>Delete user permanently</Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

