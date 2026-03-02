"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LogOut, Settings, User, FileText } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";

// ─── Types ──────────────────────────────────────────────────────────────
type Profile = { id: string; name: string; surname: string; email: string; role: string; phone?: string | null; avatar_url?: string | null };
type Building = { id: string; name: string; address: string; manager_id?: string | null };
type Unit = { id: string; unit_name: string; type: string; size_m2: number | null; building_id: string; entrance: string | null; floor: string | null };
type Service = { id: string; name: string; unit_type: string; pricing_model: string; price_value: number; frequency: string; category?: string | null };
type Expense = { id: string; title: string; category: string; vendor: string; amount: number; frequency: string; created_at?: string | null; paid_at?: string | null; period_month?: number | null; period_year?: number | null; template_id?: string | null };
type UnitType = { id: string; name: string };
type Vendor = { id: string; name: string };
type ServiceCategory = { id: string; name: string };
type Bill = { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; status: string; paid_at: string | null; receipt_url?: string | null; receipt_filename?: string | null; receipt_path?: string | null };
type UnitOwner = { unit_id: string; owner_id: string };
type UnitTenantAssignment = { unit_id: string; tenant_id: string; is_payment_responsible?: boolean };

type Data = {
  profile: Profile | null;
  buildings: Building[]; units: Unit[]; services: Service[];
  expenses: Expense[]; profiles: Profile[]; unitTypes: UnitType[];
  vendors: Vendor[]; serviceCategories: ServiceCategory[];
  bills: Bill[]; unitOwners: UnitOwner[]; unitTenantAssignments: UnitTenantAssignment[];
};

const EMPTY: Data = {
  profile: null, buildings: [], units: [], services: [], expenses: [],
  profiles: [], unitTypes: [], vendors: [], serviceCategories: [],
  bills: [], unitOwners: [], unitTenantAssignments: [],
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

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
      sb.from("buildings").select("id,name,address,manager_id"),
      sb.from("units").select("id,unit_name,type,size_m2,building_id,entrance,floor"),
      sb.from("services").select("id,name,unit_type,pricing_model,price_value,frequency,category"),
      sb.from("expenses").select("id,title,category,vendor,amount,frequency,created_at,paid_at,period_month,period_year,template_id"),
      sb.from("profiles").select("id,name,surname,email,role,phone,avatar_url"),
      sb.from("unit_types").select("id,name"),
      sb.from("vendors").select("id,name"),
      sb.from("service_categories").select("id,name"),
      sb.from("bills").select("id,unit_id,period_month,period_year,total_amount,status,paid_at,receipt_url,receipt_filename,receipt_path").order("period_year",{ascending:false}).order("period_month",{ascending:false}).limit(200),
      sb.from("unit_owners").select("unit_id,owner_id"),
      sb.from("unit_tenant_assignments").select("unit_id,tenant_id,is_payment_responsible"),
    ]);

    const profile = results[0].data as Profile | null;
    if (profile?.role !== "manager") { router.push("/dashboard"); return; }

    setData({
      profile,
      buildings: (results[1].data ?? []) as Building[],
      units: (results[2].data ?? []) as Unit[],
      services: (results[3].data ?? []) as Service[],
      expenses: (results[4].data ?? []) as Expense[],
      profiles: (results[5].data ?? []) as Profile[],
      unitTypes: (results[6].data ?? []) as UnitType[],
      vendors: (results[7].data ?? []) as Vendor[],
      serviceCategories: (results[8].data ?? []) as ServiceCategory[],
      bills: (results[9].data ?? []) as Bill[],
      unitOwners: (results[10].data ?? []) as UnitOwner[],
      unitTenantAssignments: (results[11].data ?? []) as UnitTenantAssignment[],
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
          <h1 className="text-xl font-bold">Domio</h1>
          <p className="text-xs text-muted-foreground">Manager Dashboard</p>
        </div>
        <div className="flex items-center gap-2">
          <NotificationBell isManager onSendClick={() => { setTab("config"); setConfigSubTab("notifications"); setShowSendNotif(false); }} />
          <span className="flex items-center gap-1 text-sm text-muted-foreground px-2 py-1 rounded-md bg-background border">
            <User className="size-3.5" />{profile?.name} {profile?.surname}
          </span>
          <Button variant="ghost" size="icon" onClick={() => setTab("config")} title="Configuration"><Settings className="size-5" /></Button>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="size-4 mr-1" />Logout</Button>
        </div>
      </header>

      <div className="grid gap-4 md:grid-cols-4 mb-6">
        <Card className="border-l-4 border-l-green-500">
          <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Collected</CardTitle></CardHeader>
          <CardContent className="pb-4"><p className="text-2xl font-bold text-green-600">{collected.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">From {bills.filter(b=>b.paid_at).length} paid bills</p></CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Outstanding</CardTitle></CardHeader>
          <CardContent className="pb-4"><p className="text-2xl font-bold text-red-600">{outstanding.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-1">From {bills.filter(b=>!b.paid_at).length} unpaid bills</p></CardContent>
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
        <TabsList className="grid w-full grid-cols-5 max-w-2xl mb-2">
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="expenses">Expenses</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
          <TabsTrigger value="config">Config ⚙</TabsTrigger>
        </TabsList>
        <TabsContent value="billing"><BillingTab data={data} reload={load} /></TabsContent>
        <TabsContent value="expenses"><ExpensesTab data={data} reload={load} /></TabsContent>
        <TabsContent value="payments"><PaymentsTab bills={data.bills} units={data.units} profiles={data.profiles} unitOwners={data.unitOwners} /></TabsContent>
        <TabsContent value="ledger"><LedgerTab bills={data.bills} expenses={data.expenses} units={data.units} /></TabsContent>
        <TabsContent value="config"><ConfigTab data={data} reload={load} configSubTab={configSubTab} setConfigSubTab={setConfigSubTab} /></TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Billing Tab ─────────────────────────────────────────────────────────
function BillingTab({ data, reload }: { data: Data; reload: () => void }) {
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [generating, setGenerating] = useState(false);

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
      const existing = await sb.from("expenses").select("id").eq("template_id", t.id).eq("period_month", m).eq("period_year", y).limit(1);
      if (!(existing.data?.length)) {
        await sb.from("expenses").insert({ title: t.title, category: t.category, vendor: t.vendor, amount: t.amount, frequency: "recurrent", template_id: t.id, period_month: m, period_year: y });
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

    await sb.from("bills").insert(rows);
    setMsg({text:`✓ Generated ${rows.length} bill${rows.length>1?"s":""}. Services + shared expenses calculated.`,ok:true});
    setGenerating(false);
    reload();
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

  const yrs = [new Date().getFullYear(), new Date().getFullYear() - 1];
  const sortedBills = [...data.bills].sort((a,b) => b.period_year - a.period_year || b.period_month - a.period_month);

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader>
          <CardTitle>Generate Monthly Bills</CardTitle>
          <p className="text-sm text-muted-foreground">Bills include only per-unit services (e.g. maintenance, parking fees). Expenses are tracked separately.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 items-end flex-wrap">
            <div><Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{yrs.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={generate} disabled={generating}>{generating?"Generating...":"Generate bills"}</Button>
            <Button variant="outline" onClick={async () => {
              const sb = createClient();
              const m = parseInt(month), y = parseInt(year);
              const res = await sb.from("bills").delete().eq("period_month", m).eq("period_year", y).select("*");
              const n = res.data?.length ?? 0;
              setMsg({text:`✓ Deleted ${n} bill(s) for ${MONTHS[m-1]} ${y}. You can regenerate now.`,ok:true});
              reload();
            }}>Delete all for period</Button>
          </div>
          {msg.text && <p className={`text-sm ${msg.ok?"text-green-600":"text-amber-600"}`}>{msg.text}</p>}
          <div className="text-xs text-muted-foreground border rounded p-2 bg-muted/30">
            <strong>Recurrent services:</strong> {data.services.filter(s=>s.frequency==="recurrent").length} &nbsp;|&nbsp;
            <strong>Shared expenses/month:</strong> {data.expenses.filter(e=>e.frequency==="recurrent").reduce((s,e)=>s+Number(e.amount),0).toFixed(2)} &nbsp;|&nbsp;
            <strong>Units to bill:</strong> {data.units.length}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Bills ({data.bills.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="border-b text-left">
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Period</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Unit</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Building</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Owner</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Bill to</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Amount</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th>
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
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => b.paid_at ? markUnpaid(b.id) : markPaid(b.id)}>
                        {b.paid_at ? "Mark unpaid" : "Mark paid"}
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!data.bills.length && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">No bills yet. Generate bills above.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
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

  const recurrentTemplates = expenses.filter(e => e.frequency === "recurrent" && e.template_id == null && e.period_month == null);
  const expenseRecords = expenses.filter(e => e.period_month != null);
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
    await createClient().from("expenses").update({ paid_at: new Date().toISOString() }).eq("id", id);
    reload();
  }
  async function markExpenseUnpaid(id: string) {
    await createClient().from("expenses").update({ paid_at: null }).eq("id", id);
    reload();
  }

  const yrs = [new Date().getFullYear(), new Date().getFullYear() - 1];
  const displayExpenses = expenseRecords;

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Card><CardHeader className="pb-1 pt-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Monthly Recurrent (templates)</CardTitle></CardHeader><CardContent className="pb-4"><p className="text-xl font-bold">{monthlyTotal.toFixed(2)}</p><p className="text-xs text-muted-foreground">{recurrentTemplates.length} items</p></CardContent></Card>
        <Card><CardHeader className="pb-1 pt-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Ad-hoc</CardTitle></CardHeader><CardContent className="pb-4"><p className="text-xl font-bold">{adhocTotal.toFixed(2)}</p><p className="text-xs text-muted-foreground">{adhocAny.length} items</p></CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate Recurrent Expenses</CardTitle>
          <p className="text-sm text-muted-foreground">Create period-specific records from your recurrent templates (in Config). Then generate bills in the Billing tab.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-3 items-end flex-wrap">
            <div><Label>Month</Label>
              <Select value={month} onValueChange={setMonth}>
                <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
                <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Year</Label>
              <Select value={year} onValueChange={setYear}>
                <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
                <SelectContent>{yrs.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={generateRecurrent} disabled={generating}>{generating ? "Generating..." : "Generate recurrent"}</Button>
            <Button variant="outline" onClick={async () => {
              const sb = createClient();
              const m = parseInt(month), y = parseInt(year);
              const res = await sb.from("expenses").delete().eq("period_month", m).eq("period_year", y).select("*");
              const n = res.data?.length ?? 0;
              setMsg({ text: `✓ Deleted ${n} expense(s) for ${MONTHS[m - 1]} ${y}.`, ok: true });
              reload();
            }}>Delete all for period</Button>
          </div>
          {msg.text && <p className={`text-sm ${msg.ok ? "text-green-600" : "text-amber-600"}`}>{msg.text}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Record Ad-hoc Expense</CardTitle>
          <p className="text-sm text-muted-foreground">Add a one-off expense whenever it happens.</p>
        </CardHeader>
        <CardContent>
          {!showAdd ? (
            <Button variant="outline" onClick={() => setShowAdd(true)}>+ Record new ad-hoc expense</Button>
          ) : (
            <div className="space-y-3 max-w-md">
              <div><Label>Title</Label><Input value={addF.title} onChange={e=>setAddF({...addF,title:e.target.value})} placeholder="e.g. Plumbing repair" /></div>
              <div><Label>Category</Label>
                <Select value={addF.category||"none"} onValueChange={v=>setAddF({...addF,category:v==="none"?"":v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— None —</SelectItem>{serviceCategories.map(c=><SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Vendor</Label>
                <Select value={addF.vendor||"none"} onValueChange={v=>setAddF({...addF,vendor:v==="none"?"":v})}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent><SelectItem value="none">— None —</SelectItem>{vendors.map(v=><SelectItem key={v.id} value={v.name}>{v.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Amount</Label><Input type="number" step="0.01" value={addF.amount} onChange={e=>setAddF({...addF,amount:e.target.value})} placeholder="0.00" /></div>
              <div><Label>Period</Label>
                <div className="flex gap-2 mt-1">
                  <Select value={addF.periodM} onValueChange={v=>setAddF({...addF,periodM:v})}><SelectTrigger className="w-24"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m,i)=><SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select>
                  <Select value={addF.periodY} onValueChange={v=>setAddF({...addF,periodY:v})}><SelectTrigger className="w-20"><SelectValue /></SelectTrigger><SelectContent>{yrs.map(y=><SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={addAdhoc}>Save</Button>
                <Button variant="ghost" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>All Expenses ({displayExpenses.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead><tr className="border-b text-left"><th className="pb-3 pr-4 font-medium text-muted-foreground">Period</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Title</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Category</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Vendor</th><th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Amount</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Recurrent / Ad-hoc</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th><th className="pb-3 font-medium text-muted-foreground">Action</th></tr></thead>
            <tbody className="divide-y divide-border">
              {displayExpenses.map(e => (
                <tr key={e.id} className="hover:bg-muted/30">
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
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => e.paid_at ? markExpenseUnpaid(e.id) : markExpensePaid(e.id)}>
                      {e.paid_at ? "Mark unpaid" : "Mark paid"}
                    </Button>
                  </td>
                </tr>
              ))}
              {!displayExpenses.length && <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">No expenses. Generate recurrent or record ad-hoc above. Define templates in Configuration.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Payments Tab ─────────────────────────────────────────────────────────
function PaymentsTab({ bills, units, profiles, unitOwners }: { bills: Bill[]; units: Unit[]; profiles: Profile[]; unitOwners: UnitOwner[] }) {
  const unitMap = new Map(units.map(u => [u.id, u]));
  const ownerMap = new Map(unitOwners.map(uo => [uo.unit_id, uo.owner_id]));
  const profileMap = new Map(profiles.map(p => [p.id, p]));
  const paid = [...bills.filter(b => b.paid_at)].sort((a,b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime());
  const totalPaid = paid.reduce((s,b) => s + Math.abs(Number(b.total_amount)), 0);
  return (
    <div className="space-y-4 mt-2">
      <Card className="border-l-4 border-l-green-500">
        <CardHeader className="pb-1 pt-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Total Collected</CardTitle></CardHeader>
        <CardContent className="pb-4"><p className="text-2xl font-bold text-green-600">{totalPaid.toFixed(2)}</p><p className="text-xs text-muted-foreground">{paid.length} payments received</p></CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Payment History ({paid.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[500px]">
            <thead><tr className="border-b text-left"><th className="pb-3 pr-4 font-medium text-muted-foreground">Paid On</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Unit</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Owner</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Period</th><th className="pb-3 font-medium text-muted-foreground text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-border">
              {paid.map(b => {
                const unit = unitMap.get(b.unit_id);
                const ownerId = ownerMap.get(b.unit_id);
                const owner = ownerId ? profileMap.get(ownerId) : null;
                return (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-4 font-medium">{new Date(b.paid_at!).toLocaleDateString()}</td>
                    <td className="py-3 pr-4">{unit?.unit_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{owner ? `${owner.name} ${owner.surname}` : "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{MONTHS[b.period_month-1]} {b.period_year}</td>
                    <td className="py-3 text-right font-semibold text-green-600">{Number(b.total_amount).toFixed(2)}</td>
                  </tr>
                );
              })}
              {!paid.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No payments yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Ledger Tab ───────────────────────────────────────────────────────────
function LedgerTab({ bills, expenses, units }: { bills: Bill[]; expenses: Expense[]; units: Unit[] }) {
  const unitMap = new Map(units.map(u => [u.id, u.unit_name]));

  // Combine and sort by period/date newest first
  type LedgerRow = { key: string; date: string; type: "income"|"expense"; label: string; amount: number; status: string };
  const periodLabel = (d: string) => { const [y, m] = d.split("-"); return `${MONTHS[parseInt(m||"1")-1]} ${y}`; };
  const rows: LedgerRow[] = [
    ...bills.map(b => ({ key:`b-${b.id}`, date:`${b.period_year}-${String(b.period_month).padStart(2,"0")}`, type:"income" as const, label:`${unitMap.get(b.unit_id)??"—"} — ${MONTHS[b.period_month-1]} ${b.period_year}`, amount: Math.abs(Number(b.total_amount)), status: b.paid_at ? "Paid" : b.status === "in_process" ? "In process" : b.status })),
    ...expenses.filter(e => e.period_month != null).map(e => ({ key:`e-${e.id}`, date: `${e.period_year}-${String(e.period_month!).padStart(2,"0")}`, type:"expense" as const, label:`${e.title} · ${e.vendor}`, amount: Number(e.amount), status: e.paid_at ? "Paid" : e.frequency })),
  ].sort((a,b) => b.date.localeCompare(a.date));

  let running = 0;
  const rowsWithBalance = [...rows].reverse().map(r => { running += r.type === "income" ? r.amount : -r.amount; return {...r, balance: running}; }).reverse();

  const totalIn = rows.filter(r=>r.type==="income").reduce((s,r)=>s+r.amount,0);
  const totalOut = rows.filter(r=>r.type==="expense").reduce((s,r)=>s+r.amount,0);

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-3 gap-4">
        <Card><CardHeader className="pb-1 pt-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Total Billed</CardTitle></CardHeader><CardContent className="pb-4"><p className="text-xl font-bold text-green-600">+{totalIn.toFixed(2)}</p></CardContent></Card>
        <Card><CardHeader className="pb-1 pt-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Total Expenses</CardTitle></CardHeader><CardContent className="pb-4"><p className="text-xl font-bold text-red-600">-{totalOut.toFixed(2)}</p></CardContent></Card>
        <Card><CardHeader className="pb-1 pt-4"><CardTitle className="text-xs text-muted-foreground uppercase tracking-wide">Balance</CardTitle></CardHeader><CardContent className="pb-4"><p className={`text-xl font-bold ${totalIn-totalOut>=0?"text-blue-600":"text-red-600"}`}>{(totalIn-totalOut).toFixed(2)}</p></CardContent></Card>
      </div>
      <Card>
        <CardHeader><CardTitle>Full Ledger ({rows.length} entries)</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead><tr className="border-b text-left"><th className="pb-3 pr-4 font-medium text-muted-foreground">Period</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Type</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Description</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th><th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Amount</th><th className="pb-3 font-medium text-muted-foreground text-right">Running Balance</th></tr></thead>
            <tbody className="divide-y divide-border">
              {rowsWithBalance.map(r => (
                <tr key={r.key} className="hover:bg-muted/30">
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
              {!rows.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No transactions yet.</td></tr>}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Notifications Config (full-screen form for mobile) ─────────────────────
function NotificationsCfg({ unitTypes, onBack }: { unitTypes: UnitType[]; onBack: () => void }) {
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
      setTimeout(() => { setTitle(""); setBody(""); setSelectedUnitTypes([]); setUnpaidOnly(false); onBack(); }, 800);
    } else {
      setMsg({ text: json.error || "Failed to send", ok: false });
    }
  }

  return (
    <div className="flex flex-col w-full min-h-[calc(100vh-16rem)] md:min-h-[420px]">
      <div className="flex-1 overflow-y-auto pb-24">
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
        </div>
      </div>
      <div className="fixed bottom-0 left-0 right-0 md:relative md:mt-4 p-4 bg-background border-t md:border-t-0 flex gap-2 justify-end">
        <Button variant="outline" onClick={onBack} className="flex-1 md:flex-none">Cancel</Button>
        <Button onClick={send} disabled={sending} className="flex-1 md:flex-none">{sending ? "Sending..." : "Send"}</Button>
      </div>
    </div>
  );
}

// ─── Configuration Tab ────────────────────────────────────────────────────
function ConfigTab({ data, reload, configSubTab, setConfigSubTab }: { data: Data; reload: () => void; configSubTab: string; setConfigSubTab: (v: string) => void }) {
  const tabs = ["buildings","units","unit-types","services","expenses","vendors","categories","users","notifications"];
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
      {configSubTab==="notifications" && <NotificationsCfg unitTypes={data.unitTypes} onBack={() => setConfigSubTab("buildings")} />}
    </div>
  );
}

// ─── Buildings Config ─────────────────────────────────────────────────────
function BuildingsCfg({ data, reload }: { data: Data; reload: () => void }) {
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newAddr, setNewAddr] = useState("");
  const [msg, setMsg] = useState<{text:string;ok:boolean}>({text:"",ok:true});
  const [editingBuilding, setEditingBuilding] = useState<Building|null>(null);
  const [editF, setEditF] = useState({name:"", address:"", manager_id:""});

  const sb = createClient();
  const profileMap = new Map(data.profiles.map(p => [p.id, p]));

  // Count units per building per type
  const unitCountMap = new Map<string, Map<string,number>>();
  data.units.forEach(u => {
    if (!unitCountMap.has(u.building_id)) unitCountMap.set(u.building_id, new Map());
    const typeMap = unitCountMap.get(u.building_id)!;
    typeMap.set(u.type, (typeMap.get(u.type) ?? 0) + 1);
  });

  async function create(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await sb.from("buildings").insert({ name: newName, address: newAddr });
    if (!error) { setMsg({text:"Building created.",ok:true}); setNewName(""); setNewAddr(""); setShowCreate(false); reload(); }
    else setMsg({text:error.message,ok:false});
  }

  async function saveEdit() {
    if (!editingBuilding) return;
    const { error } = await sb.from("buildings").update({
      name: editF.name,
      address: editF.address,
      manager_id: (editF.manager_id && editF.manager_id !== "none") ? editF.manager_id : null,
    }).eq("id", editingBuilding.id);
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

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Buildings ({data.buildings.length})</h3>
        <Button size="sm" onClick={() => { setShowCreate(!showCreate); setEditingBuilding(null); }}>
          {showCreate ? "Cancel" : "+ Add building"}
        </Button>
      </div>

      {showCreate && (
        <Card className="border-green-200 bg-green-50/20">
          <CardHeader className="pb-3"><CardTitle className="text-base">Add Building</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="flex gap-3 flex-wrap items-end">
              <div><Label>Name</Label><Input value={newName} onChange={e=>setNewName(e.target.value)} placeholder="Sofia Residence" required className="w-44"/></div>
              <div className="flex-1 min-w-48"><Label>Address</Label><Input value={newAddr} onChange={e=>setNewAddr(e.target.value)} placeholder="Rruga Kodra e Derhemit..." required /></div>
              <Button type="submit">Create</Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Buildings Table */}
        <Card className={editingBuilding ? "md:col-span-1" : "md:col-span-2"}>
          <CardContent className="p-0 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Building</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Address</th>
                  {data.unitTypes.map(t => (
                    <th key={t.id} className="px-3 py-3 text-center font-medium text-muted-foreground whitespace-nowrap">{t.name}</th>
                  ))}
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Manager</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Phone</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.buildings.map(b => {
                  const typeMap = unitCountMap.get(b.id);
                  const totalUnits = typeMap ? Array.from(typeMap.values()).reduce((s,n)=>s+n,0) : 0;
                  const manager = b.manager_id ? profileMap.get(b.manager_id) : null;
                  const isActive = editingBuilding?.id === b.id;
                  return (
                    <tr key={b.id} className={`transition-colors ${isActive?"bg-blue-50":"hover:bg-muted/20"}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.name}</div>
                        <div className="text-xs text-muted-foreground">{totalUnits} unit{totalUnits!==1?"s":""} total</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs max-w-[180px]">{b.address}</td>
                      {data.unitTypes.map(t => (
                        <td key={t.id} className="px-3 py-3 text-center">
                          {typeMap?.get(t.name)
                            ? <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-blue-100 text-blue-700 text-xs font-bold">{typeMap.get(t.name)}</span>
                            : <span className="text-muted-foreground/30">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3">
                        {manager
                          ? <div className="flex items-center gap-2"><Avatar profile={manager} /><span className="text-sm">{manager.name} {manager.surname}</span></div>
                          : <span className="text-xs text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Not assigned</span>}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{manager?.phone ?? <span className="text-muted-foreground/30">—</span>}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant={isActive?"default":"ghost"} className="h-7 px-3 text-xs"
                          onClick={() => { if (isActive) setEditingBuilding(null); else { setEditingBuilding(b); setEditF({name:b.name, address:b.address, manager_id:b.manager_id??"none"}); setShowCreate(false); } }}>
                          {isActive ? "Close" : "Edit"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {!data.buildings.length && (
                  <tr><td colSpan={4 + data.unitTypes.length} className="px-4 py-8 text-center text-muted-foreground">No buildings yet.</td></tr>
                )}
              </tbody>
            </table>
          </CardContent>
        </Card>

        {/* Edit Panel */}
        {editingBuilding && (
          <Card className="border-blue-200">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base">Edit Building</CardTitle>
              <p className="text-xs text-muted-foreground">{editingBuilding.name}</p>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              <div className="space-y-2">
                <div><Label className="text-xs">Building Name</Label><Input value={editF.name} onChange={e=>setEditF({...editF,name:e.target.value})} className="h-8 text-sm" /></div>
                <div><Label className="text-xs">Address</Label><Input value={editF.address} onChange={e=>setEditF({...editF,address:e.target.value})} className="h-8 text-sm" /></div>
              </div>

              <div>
                <Label className="text-xs">Assigned Manager</Label>
                <Select value={editF.manager_id} onValueChange={v=>setEditF({...editF,manager_id:v})}>
                  <SelectTrigger className="h-8 text-sm mt-1"><SelectValue placeholder="Select manager..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— No manager —</SelectItem>
                    {data.profiles.filter(p => p.role === "manager").map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          <span>{p.name} {p.surname}</span>
                          {p.phone && <span className="text-muted-foreground text-xs">· {p.phone}</span>}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {data.profiles.filter(p=>p.role==="manager").length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No manager-role users found. Create a user with Manager role first.</p>
                )}
              </div>

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
            </CardContent>
          </Card>
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
        <Card className="border-green-200 bg-green-50/20">
          <CardHeader className="pb-3"><CardTitle className="text-base">Add Unit</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Units Table */}
        <Card className={editingUnit ? "md:col-span-1" : "md:col-span-2"}>
          <CardContent className="p-0 overflow-x-auto">
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
                          ? <div className="flex items-center gap-2"><Avatar profile={owner} /><span className="text-sm">{owner.name} {owner.surname}</span></div>
                          : <span className="text-xs text-muted-foreground/50">No owner</span>}
                      </td>
                      <td className="px-4 py-3">
                        {(() => { const tid = tenantMap.get(u.id); const tenant = tid ? profileMap.get(tid) : null; return tenant ? <span className="text-sm">{tenant.name} {tenant.surname}</span> : <span className="text-xs text-muted-foreground/50">—</span>; })()}
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
          </CardContent>
        </Card>

        {/* Edit Panel */}
        {editingUnit && (
          <Card className="border-blue-200">
            <CardHeader className="pb-3 border-b">
              <CardTitle className="text-base">Edit Unit</CardTitle>
              <p className="text-xs text-muted-foreground">{editingUnit.unit_name} · {buildingMap.get(editingUnit.building_id)}</p>
            </CardHeader>
            <CardContent className="space-y-3 pt-4">
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
            </CardContent>
          </Card>
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Unit Types ({data.unitTypes.length})</CardTitle>
          <p className="text-xs text-muted-foreground">Unit types are used to categorize units and link services to billing.</p>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
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
        <Card className="border-green-200 bg-green-50/20">
          <CardHeader className="pb-3"><CardTitle className="text-base">Add Service</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
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
        </CardContent>
      </Card>
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
        <Card className="border-green-200 bg-green-50/20">
          <CardHeader className="pb-3"><CardTitle className="text-base">Add Expense</CardTitle></CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-0 overflow-x-auto">
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
        </CardContent>
      </Card>
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Vendors ({data.vendors.length})</CardTitle>
          <p className="text-xs text-muted-foreground">Companies or individuals providing services linked to expenses.</p>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
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
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Service Categories ({data.serviceCategories.length})</CardTitle>
          <p className="text-xs text-muted-foreground">Categories group expenses and services (e.g. Security, Cleaning, Utilities).</p>
        </CardHeader>
        <CardContent className="space-y-4">
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
        </CardContent>
      </Card>
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
        <Card className="border-green-200 bg-green-50/20">
          <CardHeader className="pb-3"><CardTitle className="text-base">Create New User</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={create} className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><Label>Name</Label><Input value={f.name} onChange={e=>setF({...f,name:e.target.value})} required /></div>
              <div><Label>Surname</Label><Input value={f.surname} onChange={e=>setF({...f,surname:e.target.value})} required /></div>
              <div><Label>Email</Label><Input type="email" value={f.email} onChange={e=>setF({...f,email:e.target.value})} required /></div>
              <div><Label>Password</Label><Input type="password" value={f.password} onChange={e=>setF({...f,password:e.target.value})} required minLength={6} /></div>
              <div><Label>Phone</Label><Input value={f.phone} onChange={e=>setF({...f,phone:e.target.value})} placeholder="+355..." /></div>
              <div><Label>Role</Label>
                <Select value={f.role} onValueChange={v=>setF({...f,role:v})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="tenant">Tenant</SelectItem><SelectItem value="manager">Manager</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="col-span-2 md:col-span-3 flex gap-2">
                <Button type="submit">Create user</Button>
                <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-4">
        {/* Users Table */}
        <Card className={editingUser ? "md:col-span-1" : "md:col-span-2"}>
          <CardContent className="p-0 overflow-x-auto">
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
          </CardContent>
        </Card>

        {/* Edit Panel — shows alongside table when a user is selected */}
        {editingUser && (
          <Card className="border-blue-200">
            <CardHeader className="pb-3 border-b">
              <div className="flex items-center gap-3">
                <label className="cursor-pointer relative group flex-shrink-0" title="Click to change photo">
                  <Avatar profile={editingUser} large />
                  <input type="file" accept="image/*" className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) uploadAvatar(editingUser.id, file); }} />
                  <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-white text-[10px] font-bold">📷</div>
                  {uploadingFor === editingUser.id && <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center text-white text-[10px]">...</div>}
                </label>
                <div>
                  <CardTitle className="text-base">{editingUser.name} {editingUser.surname}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">{editingUser.email}</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">

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
                      <SelectContent><SelectItem value="owner">Owner</SelectItem><SelectItem value="tenant">Tenant</SelectItem><SelectItem value="manager">Manager</SelectItem></SelectContent>
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
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

