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
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function OwnerLedgerPage() {
  const { data } = useOwnerData();
  const { locale } = useLocale();
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
  const periodLabel = (d: string) => { const [y, m] = d.split("-"); return `${t(locale, `common.month${parseInt(m||"1")}`)} ${y}`; };
  const ledgerRows: LedgerRow[] = [
    ...myBills.map(b => ({ key:`b-${b.id}`, date:`${b.period_year}-${String(b.period_month).padStart(2,"0")}`, type:"income" as const, label:`${unitMap.get(b.unit_id)?.unit_name ?? "—"} — ${t(locale, `common.month${b.period_month}`)} ${b.period_year}`, ref: (b as {reference_code?: string}).reference_code ?? "—", amount: Math.abs(Number(b.total_amount)), status: b.paid_at ? "Paid" : b.status === "in_process" ? "In process" : b.status })),
    ...expenses.filter(e => e.period_month != null).map(e => ({ key:`e-${e.id}`, date: `${e.period_year!}-${String(e.period_month!).padStart(2,"0")}`, type:"expense" as const, label:`${e.title} · ${e.vendor}`, ref: (e as {reference_code?: string}).reference_code ?? expenseRef(e), amount: Number(e.amount), status: (e as {paid_at?: string | null}).paid_at ? "Paid" : "Unpaid" })),
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
        <div className="w-full min-w-0 overflow-x-auto md:overflow-visible">
        <table className="w-full min-w-[48rem] text-sm table-fixed">
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
                <td className="py-3 pr-4 font-mono text-xs select-text">{r.ref}</td>
                <td className="py-3 pr-4 text-muted-foreground font-medium">{periodLabel(r.date)}</td>
                <td className="py-3 pr-4">
                  {r.type === "income" ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "tenant.bill")}</span> : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "tenant.expense")}</span>}
                </td>
                <td className="py-3 pr-4">{r.label}</td>
                <td className="py-3 pr-4 text-muted-foreground text-xs capitalize">{r.status === "Paid" ? t(locale, "filters.paid") : r.status === "Unpaid" ? t(locale, "filters.unpaid") : r.status === "In process" ? t(locale, "filters.inProcess") : r.status === "Recurrent" ? t(locale, "manager.recurrent") : r.status}</td>
                <td className={`py-3 pr-4 text-right font-semibold ${r.type==="income"?"text-green-600":"text-red-600"}`}>{r.type==="income"?"+":"-"}{r.amount.toFixed(2)}</td>
                <td className={`py-3 text-right font-mono text-sm ${r.balance!>=0?"text-blue-600":"text-red-600"}`}>{r.balance!.toFixed(2)}</td>
              </tr>
            ))}
            {(ledgerRows.length === 0 || rowsWithBalance.length === 0) && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{ledgerRows.length === 0 ? t(locale, "tenant.noTransactionsYet") : t(locale, "tenant.noTransactionsMatchFilters")}</td></tr>}
          </tbody>
        </table>
        </div>
      </CardContent>
    </Card>
  );
}
