"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { SlidersHorizontal } from "lucide-react";
import { useOwnerData } from "../context";
import { MONTHS, expenseRef } from "../types";

export default function OwnerLedgerPage() {
  const { data } = useOwnerData();
  const [ledgerSortCol, setLedgerSortCol] = useState<string | null>(null);
  const [ledgerSortDir, setLedgerSortDir] = useState<"asc" | "desc">("asc");
  const [filterLedgerPeriod, setFilterLedgerPeriod] = useState("all");
  const [filterLedgerType, setFilterLedgerType] = useState("all");
  const [filterLedgerStatus, setFilterLedgerStatus] = useState("all");
  const [showLedgerFilters, setShowLedgerFilters] = useState(false);

  const { profile, allUnits, bills, expenses } = data;
  const unitMap = new Map(allUnits.map(u => [u.id, u]));
  const unitIdSet = new Set(data.units.map(u => u.id));
  const myBills = bills.filter(b => unitIdSet.has(b.unit_id));

  type LedgerRow = { key: string; date: string; type: "income"|"expense"; label: string; ref: string; amount: number; status: string };
  const periodLabel = (d: string) => { const [y, m] = d.split("-"); return `${MONTHS[parseInt(m||"1")-1]} ${y}`; };
  const ledgerRows: LedgerRow[] = [
    ...myBills.map(b => ({ key:`b-${b.id}`, date:`${b.period_year}-${String(b.period_month).padStart(2,"0")}`, type:"income" as const, label:`${unitMap.get(b.unit_id)?.unit_name ?? "—"} — ${MONTHS[b.period_month-1]} ${b.period_year}`, ref: (b as {reference_code?: string}).reference_code ?? "—", amount: Math.abs(Number(b.total_amount)), status: b.paid_at ? "Paid" : b.status === "in_process" ? "In process" : b.status })),
    ...expenses.filter(e => e.period_month != null).map(e => ({ key:`e-${e.id}`, date: `${e.period_year!}-${String(e.period_month!).padStart(2,"0")}`, type:"expense" as const, label:`${e.title} · ${e.vendor}`, ref: (e as {reference_code?: string}).reference_code ?? expenseRef(e), amount: Number(e.amount), status: "Recurrent" })),
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
  let filteredLedgerRows = ledgerRows;
  if (filterLedgerPeriod !== "all") {
    const [y, m] = filterLedgerPeriod.split("-").map(Number);
    const prefix = `${y}-${String(m).padStart(2, "0")}`;
    filteredLedgerRows = filteredLedgerRows.filter(r => r.date.startsWith(prefix));
  }
  if (filterLedgerType !== "all") filteredLedgerRows = filteredLedgerRows.filter(r => r.type === filterLedgerType);
  if (filterLedgerStatus !== "all") filteredLedgerRows = filteredLedgerRows.filter(r => r.status === filterLedgerStatus);
  const sortedLedgerRows = ledgerSortCol ? sortBy(filteredLedgerRows, ledgerSortCol, ledgerSortDir, getLedgerValue) : [...filteredLedgerRows].sort((a,b) => b.date.localeCompare(a.date));
  let running = 0;
  const rowsWithBalance = [...sortedLedgerRows].reverse().map(r => { running += r.type === "income" ? r.amount : -r.amount; return {...r, balance: running}; }).reverse();
  const handleLedgerSort = (col: string) => { setLedgerSortDir(prev => ledgerSortCol === col && prev === "asc" ? "desc" : "asc"); setLedgerSortCol(col); };

  return (
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
                <td className={`py-3 text-right font-mono text-sm ${r.balance!>=0?"text-blue-600":"text-red-600"}`}>{r.balance!.toFixed(2)}</td>
              </tr>
            ))}
            {(ledgerRows.length === 0 || rowsWithBalance.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{ledgerRows.length === 0 ? "No transactions yet." : "No transactions match filters."}</td></tr>}
          </tbody>
        </table>
        </div>
      </CardContent>
    </Card>
  );
}
