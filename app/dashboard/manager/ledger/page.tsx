"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { useManagerData } from "../context";
import { MONTHS, expenseRef } from "../types";
import type { BillLine } from "../types";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

type LedgerRow = { key: string; date: string; type: "income" | "expense"; label: string; ref: string; amount: number; status: string };

export default function ManagerLedgerPage() {
  const { data, loading } = useManagerData();
  const { locale } = useLocale();
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterUnitType, setFilterUnitType] = useState<string>("all");
  const [filterUnitId, setFilterUnitId] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterVendor, setFilterVendor] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  if (loading) return <p className="text-muted-foreground">{t(locale, "common.loading")}</p>;

  const { bills, billLines, expenses, units, unitTypes } = data;
  const unitMap = new Map(units.map(u => [u.id, u]));
  const unitNameMap = new Map(units.map(u => [u.id, u.unit_name]));

  let filteredBills = bills;
  let filteredExpenses = expenses.filter(e => e.period_month != null);
  if (filterPeriod !== "all") {
    const [y, m] = filterPeriod.split("-").map(Number);
    filteredBills = filteredBills.filter(b => b.period_year === y && b.period_month === m);
    filteredExpenses = filteredExpenses.filter(e => e.period_year === y && e.period_month === m);
  }
  if (filterUnitType !== "all") filteredBills = filteredBills.filter(b => unitMap.get(b.unit_id)?.type === filterUnitType);
  if (filterUnitId !== "all") filteredBills = filteredBills.filter(b => b.unit_id === filterUnitId);
  if (filterCategory !== "all") filteredExpenses = filteredExpenses.filter(e => e.category === filterCategory);
  if (filterVendor !== "all") filteredExpenses = filteredExpenses.filter(e => e.vendor === filterVendor);
  if (filterPaymentStatus === "paid") {
    filteredBills = filteredBills.filter(b => b.paid_at);
    filteredExpenses = filteredExpenses.filter(e => e.paid_at);
  } else if (filterPaymentStatus === "unpaid") {
    filteredBills = filteredBills.filter(b => !b.paid_at);
    filteredExpenses = filteredExpenses.filter(e => !e.paid_at);
  }
  if (filterType === "bill") filteredExpenses = [];
  else if (filterType === "expense") filteredBills = [];

  const ledgerLinesByBill = new Map<string, BillLine[]>();
  (billLines ?? []).forEach(l => {
    const list = ledgerLinesByBill.get(l.bill_id) ?? [];
    list.push(l);
    ledgerLinesByBill.set(l.bill_id, list);
  });

  const billRows: LedgerRow[] = [];
  for (const b of filteredBills) {
    const lines = ledgerLinesByBill.get(b.id) ?? [];
    const baseLabel = `${unitNameMap.get(b.unit_id) ?? "—"} — ${t(locale, `common.month${b.period_month}`)} ${b.period_year}`;
    const baseDate = `${b.period_year}-${String(b.period_month).padStart(2, "0")}`;
    const baseStatus = b.paid_at ? "Paid" : b.status === "in_process" ? "In process" : b.status;
    const ref = b.reference_code ?? "—";
    if (lines.length > 0) {
      lines.forEach((l, i) => {
        const lineTypeLabel = l.line_type === "manual" ? t(locale, "manager.onceOff") : t(locale, "manager.recurrent");
        billRows.push({ key: `b-${b.id}-${i}`, date: baseDate, type: "income", label: `${baseLabel} · ${lineTypeLabel}: ${l.description || "—"}`, ref, amount: Math.abs(Number(l.amount)), status: baseStatus });
      });
    } else {
      billRows.push({ key: `b-${b.id}`, date: baseDate, type: "income", label: baseLabel, ref, amount: Math.abs(Number(b.total_amount)), status: baseStatus });
    }
  }

  const expenseBaseRefToIndices = new Map<string, number[]>();
  filteredExpenses.forEach((e, i) => {
    const raw = e.reference_code ?? expenseRef(e);
    const base = raw.replace(/-[0-9]+$/, "");
    const arr = expenseBaseRefToIndices.get(base) ?? [];
    arr.push(i);
    expenseBaseRefToIndices.set(base, arr);
  });
  const getExpenseDisplayRef = (e: (typeof filteredExpenses)[number]) => {
    const raw = e.reference_code ?? expenseRef(e);
    const base = raw.replace(/-[0-9]+$/, "");
    const indices = expenseBaseRefToIndices.get(base) ?? [];
    const idx = filteredExpenses.indexOf(e);
    const pos = indices.indexOf(idx) + 1;
    return indices.length > 1 ? `${base}-${pos}` : raw;
  };

  const rows: LedgerRow[] = [
    ...billRows,
    ...filteredExpenses.map(e => ({
      key: `e-${e.id}`,
      date: `${e.period_year}-${String(e.period_month!).padStart(2, "0")}`,
      type: "expense" as const,
      label: `${e.title} · ${e.vendor}`,
      ref: getExpenseDisplayRef(e),
      amount: Number(e.amount),
      status: e.paid_at ? "Paid" : "Unpaid",
    })),
  ];

  const periodLabel = (d: string) => {
    const [y, m] = d.split("-");
    return `${t(locale, `common.month${parseInt(m || "1")}`)} ${y}`;
  };

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

  const sortedRows = sortCol ? sortBy(rows, sortCol, sortDir, getLedgerValue) : [...rows].sort((a, b) => b.date.localeCompare(a.date));
  let running = 0;
  const rowsWithBalance = [...sortedRows].reverse().map(r => {
    running += r.type === "income" ? r.amount : -r.amount;
    return { ...r, balance: running };
  }).reverse();

  const totalIn = rows.filter(r => r.type === "income").reduce((s, r) => s + r.amount, 0);
  const totalOut = rows.filter(r => r.type === "expense").reduce((s, r) => s + r.amount, 0);
  const handleLedgerSort = (col: string) => { setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc"); setSortCol(col); };
  const unfilteredEntryCount = bills.reduce((s, b) => s + Math.max(1, (ledgerLinesByBill.get(b.id) ?? []).length), 0) + expenses.filter(e => e.period_month != null).length;

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="py-2 px-4 gap-1">
          <CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "manager.totalBilled")}</CardTitle></CardHeader>
          <CardContent className="pb-2 pt-0 px-0"><p className="text-lg font-extrabold text-green-600">+{totalIn.toFixed(2)}</p></CardContent>
        </Card>
        <Card className="py-2 px-4 gap-1">
          <CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "manager.totalExpenses")}</CardTitle></CardHeader>
          <CardContent className="pb-2 pt-0 px-0"><p className="text-lg font-extrabold text-red-600">-{totalOut.toFixed(2)}</p></CardContent>
        </Card>
        <Card className="py-2 px-4 gap-1">
          <CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "manager.balance")}</CardTitle></CardHeader>
          <CardContent className="pb-2 pt-0 px-0"><p className={`text-lg font-extrabold ${totalIn - totalOut >= 0 ? "text-blue-600" : "text-red-600"}`}>{(totalIn - totalOut).toFixed(2)}</p></CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle>{t(locale, "headers.fullLedger")} ({rows.length}{rows.length !== unfilteredEntryCount ? ` ${t(locale, "owner.of")} ${unfilteredEntryCount}` : ""} {t(locale, "headers.entries")})</CardTitle>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowFilters(v => !v)} aria-label={t(locale, "common.toggleFilters")}>
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
                      {[...new Set([...bills.map(b => `${b.period_year}-${b.period_month}`), ...expenses.filter(e => e.period_month != null).map(e => `${e.period_year}-${e.period_month}`)])].sort((a, b) => b.localeCompare(a)).slice(0, 24).map(k => { const [y, m] = k.split("-"); return <SelectItem key={k} value={k}>{MONTHS[parseInt(m || "1") - 1]} {y}</SelectItem> })}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{t(locale, "table.unitType")}</Label>
                  <Select value={filterUnitType} onValueChange={setFilterUnitType}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t(locale, "filters.allTypes")}</SelectItem>{unitTypes.map(t => <SelectItem key={t.id} value={t.name}>{t.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{t(locale, "table.unit")}</Label>
                  <Select value={filterUnitId} onValueChange={setFilterUnitId}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t(locale, "filters.allUnits")}</SelectItem>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{t(locale, "configServices.category")}</Label>
                  <Select value={filterCategory} onValueChange={setFilterCategory}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t(locale, "manager.allCategories")}</SelectItem>{[...new Set(expenses.map(e => e.category).filter((c): c is string => !!c))].sort().map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{t(locale, "configExpenses.vendor")}</Label>
                  <Select value={filterVendor} onValueChange={setFilterVendor}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t(locale, "manager.allVendors")}</SelectItem>{[...new Set(expenses.map(e => e.vendor).filter((v): v is string => !!v))].sort().map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{t(locale, "table.type")}</Label>
                  <Select value={filterType} onValueChange={setFilterType}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t(locale, "manager.billAndExpense")}</SelectItem><SelectItem value="bill">{t(locale, "manager.billOnly")}</SelectItem><SelectItem value="expense">{t(locale, "manager.expenseOnly")}</SelectItem></SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{t(locale, "manager.payment")}</Label>
                  <Select value={filterPaymentStatus} onValueChange={setFilterPaymentStatus}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t(locale, "common.all")}</SelectItem><SelectItem value="paid">{t(locale, "filters.paid")}</SelectItem><SelectItem value="unpaid">{t(locale, "filters.unpaid")}</SelectItem></SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full min-w-0 overflow-x-auto md:overflow-visible">
            <table className="w-full min-w-[48rem] text-sm table-fixed">
              <thead><tr className="border-b text-left">
                <SortableTh column="ref" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.reference")}</SortableTh>
                <SortableTh column="date" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.period")}</SortableTh>
                <SortableTh column="type" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.type")}</SortableTh>
                <SortableTh column="label" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.description")}</SortableTh>
                <SortableTh column="status" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.status")}</SortableTh>
                <SortableTh column="amount" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 pr-4 font-medium text-muted-foreground" align="right">{t(locale, "table.amount")}</SortableTh>
                <SortableTh column="balance" sortCol={sortCol} sortDir={sortDir} onSort={handleLedgerSort} className="pb-3 font-medium text-muted-foreground" align="right">{t(locale, "table.runningBalance")}</SortableTh>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {rowsWithBalance.map(r => (
                  <tr key={r.key} className="hover:bg-muted/30">
                    <td className="py-3 pr-4 font-mono text-xs select-text">{r.ref}</td>
                    <td className="py-3 pr-4 text-muted-foreground font-medium">{periodLabel(r.date)}</td>
                    <td className="py-3 pr-4">
                      {r.type === "income"
                        ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "tenant.bill")}</span>
                        : <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "tenant.expense")}</span>}
                    </td>
                    <td className="py-3 pr-4">{r.label}</td>
                    <td className="py-3 pr-4 text-muted-foreground text-xs capitalize">{r.status}</td>
                    <td className={`py-3 pr-4 text-right font-semibold ${r.type === "income" ? "text-green-600" : "text-red-600"}`}>
                      {r.type === "income" ? "+" : "-"}{r.amount.toFixed(2)}
                    </td>
                    <td className={`py-3 text-right font-mono text-sm ${r.balance! >= 0 ? "text-blue-600" : "text-red-600"}`}>{r.balance!.toFixed(2)}</td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">{unfilteredEntryCount > 0 ? t(locale, "manager.noEntriesMatchFilters") : t(locale, "tenant.noTransactionsYet")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
