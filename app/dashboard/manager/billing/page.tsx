"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, ChevronDown, ChevronUp, SlidersHorizontal } from "lucide-react";
import { useManagerData } from "../context";
import { MONTHS, isPeriodCurrent } from "../types";
import type { Bill, BillLine } from "../types";

export default function ManagerBillingPage() {
  const { data, load, addBills } = useManagerData();
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
  const [showAddAdhocBill, setShowAddAdhocBill] = useState(false);
  const [addingAdhoc, setAddingAdhoc] = useState(false);
  const [sendingOverdue, setSendingOverdue] = useState(false);
  const now = new Date();
  const [addAdhocForm, setAddAdhocForm] = useState({
    description: "",
    unitType: "all",
    pricingModel: "fixed",
    amount: "",
    periodM: String(now.getMonth() + 1),
    periodY: String(now.getFullYear()),
  });

  const unitMap = new Map(data.units.map(u => [u.id, u]));
  const ownerMap = new Map(data.unitOwners.map(uo => [uo.unit_id, uo.owner_id]));
  const profileMap = new Map(data.profiles.map(p => [p.id, p]));
  const buildingMap = new Map(data.buildings.map(b => [b.id, b.name]));
  const linesByBill = new Map<string, BillLine[]>();
  (data.billLines ?? []).forEach(l => {
    const list = linesByBill.get(l.bill_id) ?? [];
    list.push(l);
    linesByBill.set(l.bill_id, list);
  });
  const unitBillToMap = new Map<string, string>();
  data.unitTenantAssignments.forEach(a => {
    if (!unitBillToMap.has(a.unit_id) && a.is_payment_responsible !== false) unitBillToMap.set(a.unit_id, a.tenant_id);
    if (a.is_payment_responsible === true) unitBillToMap.set(a.unit_id, a.tenant_id);
  });

  async function generate() {
    setGenerating(true);
    setMsg({text:"",ok:true});
    try {
      const m = parseInt(month), y = parseInt(year);
      const res = await fetch("/api/manager/generate-bills", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: m, year: y }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) {
        setMsg({ text: `✓ Generated ${j.count ?? 0} bill${(j.count ?? 0) > 1 ? "s" : ""}.`, ok: true });
        await load();
      } else {
        setMsg({ text: j.error || "Failed to generate", ok: false });
      }
    } catch (err) {
      setMsg({ text: (err as Error).message || "An error occurred", ok: false });
    }
    setGenerating(false);
  }

  async function markPaid(id: string) {
    const res = await fetch("/api/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billId: id, paid: true }) });
    const r = await res.json();
    if (r.success) load();
    else setMsg({ text: r.error || "Failed", ok: false });
  }
  async function markUnpaid(id: string) {
    const res = await fetch("/api/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ billId: id, paid: false }) });
    const r = await res.json();
    if (r.success) load();
    else setMsg({ text: r.error || "Failed", ok: false });
  }
  async function markAllPaid(ownerId: string, periodMonth: number, periodYear: number) {
    const res = await fetch("/api/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId, periodMonth, periodYear, paid: true }) });
    const r = await res.json();
    if (r.success) load();
    else setMsg({ text: r.error || "Failed", ok: false });
  }
  async function markAllUnpaid(ownerId: string, periodMonth: number, periodYear: number) {
    const res = await fetch("/api/bills", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ownerId, periodMonth, periodYear, paid: false }) });
    const r = await res.json();
    if (r.success) load();
    else setMsg({ text: r.error || "Failed", ok: false });
  }

  async function addAdhocBill() {
    if (!addAdhocForm.description.trim()) { setMsg({ text: "Description is required", ok: false }); return; }
    const amt = parseFloat(addAdhocForm.amount);
    if (isNaN(amt) || amt <= 0) { setMsg({ text: "Amount must be positive", ok: false }); return; }
    setAddingAdhoc(true);
    setMsg({ text: "", ok: true });
    try {
      const res = await fetch("/api/manager/ad-hoc-bill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: addAdhocForm.description.trim(),
          unitType: addAdhocForm.unitType,
          pricingModel: addAdhocForm.pricingModel,
          amount: amt,
          periodMonth: parseInt(addAdhocForm.periodM, 10),
          periodYear: parseInt(addAdhocForm.periodY, 10),
        }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) {
        setMsg({ text: j.message ?? `✓ Added ${j.linesAdded ?? 0} ad hoc charge(s).`, ok: true });
        setAddAdhocForm({ description: "", unitType: "all", pricingModel: "fixed", amount: "", periodM: String(now.getMonth() + 1), periodY: String(now.getFullYear()) });
        setShowAddAdhocBill(false);
        await load();
      } else {
        setMsg({ text: j.error ?? "Failed", ok: false });
      }
    } catch (err) {
      setMsg({ text: (err as Error).message ?? "An error occurred", ok: false });
    }
    setAddingAdhoc(false);
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

  const billRows: { bill: Bill; line: BillLine | null; lineIndex: number }[] = [];
  for (const b of sortedBills) {
    const lines = linesByBill.get(b.id) ?? [];
    if (lines.length > 0) {
      lines.forEach((l, i) => billRows.push({ bill: b, line: l, lineIndex: i }));
    } else {
      billRows.push({ bill: b, line: null, lineIndex: 0 });
    }
  }
  const billRowCount = billRows.length;
  const totalBillRowCount = data.bills.reduce((s, b) => s + Math.max(1, (linesByBill.get(b.id) ?? []).length), 0);

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
          <CardTitle className="text-base sm:text-lg">All Bills ({billRowCount}{billRowCount !== totalBillRowCount ? ` of ${totalBillRowCount}` : ""})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-8 gap-1 text-white border-0 bg-[#0ac5b2] hover:bg-[#09b3a3]" onClick={() => { setShowGenerateBills(v => !v); setShowAddAdhocBill(false); }}>
              {showGenerateBills ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              Generate
            </Button>
            <Button size="sm" className="h-8 gap-1 text-white border-0 bg-[#0ac5b2] hover:bg-[#09b3a3]" onClick={() => { setShowAddAdhocBill(v => !v); setShowGenerateBills(false); }}>
              + Extra Bill
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
                  const m = parseInt(month), y = parseInt(year);
                  const res = await fetch(`/api/manager/delete-bills-period?month=${m}&year=${y}`, { method: "DELETE" });
                  const json = await res.json();
                  if (!res.ok) { setMsg({ text: json.error ?? "Failed", ok: false }); return; }
                  const b = json.billsDeleted ?? 0;
                  const e = json.expensesDeleted ?? 0;
                  setMsg({ text: `✓ Deleted ${b} bill(s) and ${e} expense(s).`, ok: true });
                  load();
                }}>Delete period</Button>
                <Button variant="outline" size="sm" className="h-8" disabled={sendingOverdue} onClick={async () => {
                  setSendingOverdue(true); setMsg({ text: "", ok: true });
                  const res = await fetch("/api/manager/send-overdue-reminders", { method: "POST" });
                  const json = await res.json();
                  setSendingOverdue(false);
                  if (res.ok) setMsg({ text: `✓ Sent overdue reminder to ${json.recipients ?? 0} recipient(s).`, ok: true });
                  else setMsg({ text: json.error ?? "Failed", ok: false });
                }}>{sendingOverdue ? "..." : "Send overdue reminders"}</Button>
              </div>
              <div className="text-xs text-muted-foreground">
                <strong>Recurrent services:</strong> {data.services.filter(s=>s.frequency==="recurrent").length} &nbsp;|&nbsp;
                <strong>Units to bill:</strong> {data.units.length}
              </div>
              {msg.text && <p className={`text-xs ${msg.ok?"text-green-600":"text-amber-600"}`}>{msg.text}</p>}
            </div>
          )}
          {showAddAdhocBill && (
            <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 space-y-2">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">Add ad hoc charge (one-off extra billing per unit)</p>
              <div className="flex flex-wrap gap-2 items-end">
                <Input value={addAdhocForm.description} onChange={e=>setAddAdhocForm({...addAdhocForm,description:e.target.value})} placeholder="Description (e.g. Extra maintenance)" className="h-8 min-w-0 flex-1 sm:flex-initial sm:w-40" />
                <div><Label className="text-xs">Unit type</Label>
                  <Select value={addAdhocForm.unitType} onValueChange={v=>setAddAdhocForm({...addAdhocForm,unitType:v})}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All types</SelectItem>{[...new Set(data.units.map(u=>u.type))].map(t=> <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Pricing</Label>
                  <Select value={addAdhocForm.pricingModel} onValueChange={v=>setAddAdhocForm({...addAdhocForm,pricingModel:v})}>
                    <SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="fixed">Fixed</SelectItem><SelectItem value="per_m2">Per m²</SelectItem></SelectContent>
                  </Select>
                </div>
                <Input type="number" step="0.01" value={addAdhocForm.amount} onChange={e=>setAddAdhocForm({...addAdhocForm,amount:e.target.value})} placeholder={addAdhocForm.pricingModel==="per_m2"?"Rate €/m²":"Amount €"} className="h-8 min-w-0 w-20 sm:w-24" />
                <Select value={addAdhocForm.periodM} onValueChange={v=>setAddAdhocForm({...addAdhocForm,periodM:v})}><SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m,i)=><SelectItem key={i} value={String(i+1)}>{m}</SelectItem>)}</SelectContent></Select>
                <Select value={addAdhocForm.periodY} onValueChange={v=>setAddAdhocForm({...addAdhocForm,periodY:v})}><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger><SelectContent>{yrs.map(y=> <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select>
                <Button size="sm" className="h-8" onClick={addAdhocBill} disabled={addingAdhoc}>{addingAdhoc ? "..." : "Save"}</Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowAddAdhocBill(false)}>Cancel</Button>
              </div>
              {msg.text && showAddAdhocBill && <p className={`text-xs ${msg.ok?"text-green-600":"text-amber-600"}`}>{msg.text}</p>}
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
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Type</th>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Description</th>
                <SortableTh column="amount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground" align="right">Amount</SortableTh>
                <SortableTh column="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">Status</SortableTh>
                <th className="pb-3 pr-4 font-medium text-muted-foreground">Slip</th>
                <th className="pb-3 font-medium text-muted-foreground">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {billRows.map(({ bill: b, line, lineIndex }) => {
                const lines = linesByBill.get(b.id) ?? [];
                const unit = unitMap.get(b.unit_id);
                const ownerId = ownerMap.get(b.unit_id);
                const owner = ownerId ? profileMap.get(ownerId) : null;
                const billToId = unitBillToMap.get(b.unit_id);
                const billTo = billToId ? profileMap.get(billToId) : null;
                const baseRef = (b.reference_code ?? "—").replace(/-[0-9]+$/, "");
                const displayRef = lines.length > 1 ? `${baseRef}-${lineIndex + 1}` : (b.reference_code ?? "—");
                const lineTypeLabel = line ? (line.line_type === "manual" ? "Once off" : "Recurrent") : null;
                const lineDesc = line ? (line.description || "—") : "—";
                const lineAmount = line != null ? Number(line.amount) : Number(b.total_amount);
                return (
                  <tr key={line ? `${b.id}-${lineIndex}` : b.id} className="hover:bg-muted/30 transition-colors">
                    <td className="py-3 pr-4 font-mono text-xs">{displayRef}</td>
                    <td className="py-3 pr-4 font-medium">{MONTHS[b.period_month-1]} {b.period_year}</td>
                    <td className="py-3 pr-4">{unit?.unit_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{unit ? buildingMap.get(unit.building_id)??"—" : "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{owner ? `${owner.name} ${owner.surname}` : <span className="text-xs text-amber-600">No owner</span>}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{billTo ? `${billTo.name} ${billTo.surname}` : <span className="text-xs text-muted-foreground">Owner</span>}</td>
                    <td className="py-3 pr-4">
                      {lineTypeLabel ? (
                        <span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${lineTypeLabel === "Once off" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"}`}>
                          {lineTypeLabel}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="py-3 pr-4 text-muted-foreground">{lineDesc}</td>
                    <td className="py-3 pr-4 text-right font-semibold tabular-nums">{lineAmount.toFixed(2)}</td>
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
              {!billRowCount && <tr><td colSpan={12} className="py-8 text-center text-muted-foreground">{filteredBills.length === 0 && data.bills.length > 0 ? "No bills match filters." : "No bills yet. Use Generate bills to create."}</td></tr>}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
