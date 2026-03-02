"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LogOut, User, Camera, FileText, AlertTriangle } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type OwnerData = {
  profile: { id: string; name: string; surname: string; email: string; role: string } | null;
  units: { id: string; unit_name: string; type: string; size_m2: number | null; building_id: string }[];
  allUnits: { id: string; unit_name: string }[];
  buildings: { id: string; name: string }[];
  bills: { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; status: string; paid_at: string | null; receipt_url?: string | null; receipt_filename?: string | null; receipt_path?: string | null }[];
  expenses: { id: string; title: string; vendor: string; amount: number; period_month: number | null; period_year: number | null }[];
  unitTenantAssignments: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }[];
  tenants: { id: string; name: string; surname: string; email: string }[];
};

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default function OwnerPage() {
  const router = useRouter();
  const [data, setData] = useState<OwnerData>({ profile: null, units: [], allUnits: [], buildings: [], bills: [], expenses: [], unitTenantAssignments: [], tenants: [] });
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("billing");
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [profileRes, unitOwnersRes] = await Promise.all([
      sb.from("profiles").select("id, name, surname, email, role").eq("id", user.id).single(),
      sb.from("unit_owners").select("unit_id").eq("owner_id", user.id),
    ]);
    const profile = profileRes.data;
    const unitIds = (unitOwnersRes.data ?? []).map(u => u.unit_id);
    if (!unitIds.length) {
      const [expensesRes, tenantsRes] = await Promise.all([sb.from("expenses").select("id, title, vendor, amount, period_month, period_year"), sb.from("profiles").select("id, name, surname, email").eq("role", "tenant")]);
      const allUnits = (await sb.from("units").select("id, unit_name")).data ?? [];
      setData({ profile, units: [], allUnits, buildings: [], bills: [], expenses: expensesRes.data ?? [], unitTenantAssignments: [], tenants: tenantsRes.data ?? [] });
      setLoading(false);
      return;
    }

    const unitIdSet = new Set(unitIds);
    const [unitsRes, allUnitsRes, buildingsRes, billsRes, expensesRes, assignmentsRes, tenantsRes] = await Promise.all([
      sb.from("units").select("id, unit_name, type, size_m2, building_id").in("id", unitIds),
      sb.from("units").select("id, unit_name"),
      sb.from("buildings").select("id, name"),
      sb.rpc("get_my_bills", { lim: 200 }),
      sb.from("expenses").select("id, title, vendor, amount, period_month, period_year"),
      sb.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", unitIds),
      sb.from("profiles").select("id, name, surname, email").eq("role", "tenant"),
    ]);
    const rawBills = (billsRes.data ?? []) as { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; status: string; paid_at: string | null; receipt_url?: string | null; receipt_filename?: string | null; receipt_path?: string | null }[];
    const allBills = rawBills.filter(b => unitIdSet.has(b.unit_id));
    setData({
      profile,
      units: unitsRes.data ?? [],
      allUnits: allUnitsRes.data ?? [],
      buildings: buildingsRes.data ?? [],
      bills: allBills,
      expenses: expensesRes.data ?? [],
      unitTenantAssignments: assignmentsRes.data ?? [],
      tenants: tenantsRes.data ?? [],
    });
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  async function handleSignOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  async function uploadSlip(billId: string, file: File) {
    setUploadingFor(billId);
    setUploadError(null);
    const sb = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${billId}.${ext}`;
    const { error: upErr } = await sb.storage.from("payment-slips").upload(path, file, { upsert: true });
    if (!upErr) {
      const res = await fetch("/api/receipt-record", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billId, receipt_path: path, receipt_filename: file.name }),
      });
      if (res.ok) {
        load();
      } else {
        const err = await res.json().catch(() => ({}));
        setUploadError(err.error || "Could not record slip.");
      }
    } else {
      setUploadError(upErr.message || "Upload failed. Create 'payment-slips' bucket in Supabase Storage.");
    }
    setUploadingFor(null);
  }

  const triggerFileInput = (billId: string) => {
    if (fileInputRef.current) {
      (fileInputRef.current as HTMLInputElement & { _billId?: string })._billId = billId;
      fileInputRef.current.click();
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>
  );

  const { profile, units, buildings, allUnits, bills, expenses, unitTenantAssignments, tenants } = data;
  const buildingMap = new Map(buildings.map(b => [b.id, b.name]));
  const unitMap = new Map(allUnits.map(u => [u.id, u]));
  const unitIdSet = new Set(units.map(u => u.id));
  const myBills = bills.filter(b => unitIdSet.has(b.unit_id));

  const collected = myBills.filter(b => b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const outstanding = myBills.filter(b => !b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const unpaidBills = myBills.filter(b => !b.paid_at);
  const expenseRecords = expenses.filter(e => e.period_month != null);
  const monthlyExpenses = expenseRecords.reduce((s, e) => s + Number(e.amount), 0);
  const netFund = collected - monthlyExpenses;

  type LedgerRow = { key: string; date: string; type: "income"|"expense"; label: string; amount: number; status: string };
  const periodLabel = (d: string) => { const [y, m] = d.split("-"); return `${MONTHS[parseInt(m||"1")-1]} ${y}`; };
  const ledgerRows: LedgerRow[] = [
    ...myBills.map(b => ({ key:`b-${b.id}`, date:`${b.period_year}-${String(b.period_month).padStart(2,"0")}`, type:"income" as const, label:`${unitMap.get(b.unit_id)??"—"} — ${MONTHS[b.period_month-1]} ${b.period_year}`, amount: Math.abs(Number(b.total_amount)), status: b.paid_at ? "Paid" : b.status === "in_process" ? "In process" : b.status })),
    ...expenses.filter(e => e.period_month != null).map(e => ({ key:`e-${e.id}`, date: `${e.period_year!}-${String(e.period_month!).padStart(2,"0")}`, type:"expense" as const, label:`${e.title} · ${e.vendor}`, amount: Number(e.amount), status: "Recurrent" })),
  ].sort((a,b) => b.date.localeCompare(a.date));
  let running = 0;
  const rowsWithBalance = [...ledgerRows].reverse().map(r => { running += r.type === "income" ? r.amount : -r.amount; return {...r, balance: running}; }).reverse();

  const tenantMap = new Map(tenants.map(t => [t.id, t]));
  const unitTenantsMap = new Map<string, { unit_id: string; tenant_id: string }[]>();
  const unitResponsibleTenantMap = new Map<string, string>(); // unit_id -> tenant_id (payment responsible)
  unitTenantAssignments.forEach(a => {
    const list = unitTenantsMap.get(a.unit_id) ?? [];
    list.push(a);
    unitTenantsMap.set(a.unit_id, list);
    if (!unitResponsibleTenantMap.has(a.unit_id) && a.is_payment_responsible !== false) unitResponsibleTenantMap.set(a.unit_id, a.tenant_id);
    else if (a.is_payment_responsible === true) unitResponsibleTenantMap.set(a.unit_id, a.tenant_id);
  });

  async function assignTenant(unitId: string, tenantId: string) {
    const sb = createClient();
    await sb.from("unit_tenant_assignments").upsert({ unit_id: unitId, tenant_id: tenantId });
    load();
  }
  async function removeTenant(unitId: string, tenantId: string) {
    const sb = createClient();
    await sb.from("unit_tenant_assignments").delete().eq("unit_id", unitId).eq("tenant_id", tenantId);
    load();
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <input type="file" ref={fileInputRef} accept="image/*,.pdf" capture="environment" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; const bid = (fileInputRef.current as HTMLInputElement & { _billId?: string })?._billId; if (f && bid) uploadSlip(bid, f); e.target.value = ""; }} />
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Domio · Owner</h1>
        <div className="flex items-center gap-2">
          <NotificationBell />
          <span className="flex items-center gap-1 text-sm text-muted-foreground px-2 py-1 rounded-md bg-background border">
            <User className="size-3.5" /> {profile?.name} {profile?.surname}
          </span>
          <Button variant="outline" size="sm" onClick={handleSignOut}><LogOut className="size-4 mr-1" /> Logout</Button>
        </div>
      </header>

      {unpaidBills.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/30 dark:border-amber-800">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
          <p className="text-sm">
            You have <strong>{unpaidBills.length} unpaid bill{unpaidBills.length > 1 ? "s" : ""}</strong> ({outstanding.toFixed(2)} total). Please pay or upload your payment slip in the Billing tab.
          </p>
        </div>
      )}

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
        <TabsList className="grid w-full grid-cols-3 max-w-xl mb-2">
          <TabsTrigger value="units">My Units</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="ledger">Ledger</TabsTrigger>
        </TabsList>

        <TabsContent value="units">
          <div className="space-y-4 mt-2">
            <Card>
              <CardHeader><CardTitle>My Units ({units.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead><tr className="border-b text-left"><th className="pb-3 pr-4 font-medium text-muted-foreground">Unit</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Building</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Type</th><th className="pb-3 pr-4 font-medium text-muted-foreground text-center">m²</th><th className="pb-3 font-medium text-muted-foreground">Tenant</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {units.map(u => {
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
        </TabsContent>

        <TabsContent value="billing">
          <div className="space-y-4 mt-2">
            {!units.length && <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/30 dark:border-amber-800"><AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" /><p className="text-sm">No units assigned to you. Ask the manager to assign you in <strong>Config → Units</strong> (Owner) or <strong>Config → Users</strong> (Unit assignments).</p></div>}
            {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
            <Card>
              <CardHeader><CardTitle>My Bills ({myBills.length})</CardTitle></CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full text-sm min-w-[500px]">
                  <thead><tr className="border-b text-left"><th className="pb-3 pr-4 font-medium text-muted-foreground">Period</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Unit</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Bill to</th><th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Amount</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Paid on</th><th className="pb-3 font-medium text-muted-foreground">Action</th></tr></thead>
                  <tbody className="divide-y divide-border">
                    {myBills.map(b => {
                      const respId = unitResponsibleTenantMap.get(b.unit_id);
                      const respTenant = respId ? tenantMap.get(respId) : null;
                      return (
                      <tr key={b.id} className="hover:bg-muted/30">
                        <td className="py-3 pr-4 font-medium">{MONTHS[b.period_month-1]} {b.period_year}</td>
                        <td className="py-3 pr-4">{unitMap.get(b.unit_id)?.unit_name ?? "—"}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{respTenant ? `${respTenant.name} ${respTenant.surname}` : "—"}</td>
                        <td className="py-3 pr-4 text-right font-semibold">{Number(b.total_amount).toFixed(2)}</td>
                        <td className="py-3 pr-4">
                          {b.paid_at ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ Paid</span> : b.status === "in_process" ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">In process</span> : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">Unpaid</span>}
                        </td>
                        <td className="py-3 pr-4 text-muted-foreground text-xs">{b.paid_at ? new Date(b.paid_at).toLocaleDateString() : "—"}</td>
                        <td className="py-3">
                          {(b.receipt_url || b.receipt_path) ? (
                            <div className="flex flex-col gap-0.5">
                              <span className="text-xs text-muted-foreground truncate max-w-[140px]" title={b.receipt_filename ?? "Receipt"}>{b.receipt_filename ?? "Receipt"}</span>
                              <a href={`/api/receipt?billId=${b.id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><FileText className="size-3" /> View</a>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" className="h-7 text-xs" disabled={!!uploadingFor} onClick={() => triggerFileInput(b.id)}>
                              {uploadingFor === b.id ? "Uploading..." : <><Camera className="size-3 mr-1" /> Upload slip</>}
                            </Button>
                          )}
                        </td>
                      </tr>
                    ); })}
                    {!myBills.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No bills yet.</td></tr>}
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
                <thead><tr className="border-b text-left"><th className="pb-3 pr-4 font-medium text-muted-foreground">Period</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Type</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Description</th><th className="pb-3 pr-4 font-medium text-muted-foreground">Status</th><th className="pb-3 pr-4 font-medium text-muted-foreground text-right">Amount</th><th className="pb-3 font-medium text-muted-foreground text-right">Running Balance</th></tr></thead>
                <tbody className="divide-y divide-border">
                  {rowsWithBalance.map(r => (
                    <tr key={r.key} className="hover:bg-muted/30">
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
                  {!ledgerRows.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No transactions yet.</td></tr>}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
