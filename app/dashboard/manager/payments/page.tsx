"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { useManagerData } from "../context";
import { MONTHS } from "../types";
import type { Bill } from "../types";

export default function ManagerPaymentsPage() {
  const { data, loading } = useManagerData();
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterUnitId, setFilterUnitId] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  if (loading) return <p className="text-muted-foreground">Loading...</p>;

  const { bills, units, profiles, unitOwners } = data;
  const unitMap = new Map(units.map(u => [u.id, u]));
  const ownerMap = new Map(unitOwners.map(uo => [uo.unit_id, uo.owner_id]));
  const profileMap = new Map(profiles.map(p => [p.id, p]));

  let paidRaw = bills.filter(b => b.paid_at);
  if (filterPeriod !== "all") {
    const [y, m] = filterPeriod.split("-").map(Number);
    paidRaw = paidRaw.filter(b => b.period_year === y && b.period_month === m);
  }
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

  const paid = sortCol ? sortBy(paidRaw, sortCol, sortDir, getPaidValue) : [...paidRaw].sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime());
  const totalPaid = paid.reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const handlePaidSort = (col: string) => { setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc"); setSortCol(col); };

  return (
    <div className="space-y-4 mt-2">
      <Card className="border-l-4 border-l-green-500 py-2 px-4 gap-1">
        <CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Total Collected</CardTitle></CardHeader>
        <CardContent className="pb-2 pt-0 px-0"><p className="text-lg font-extrabold text-green-600">{totalPaid.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-0.5">{paid.length} payments received</p></CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <CardTitle>Payment History ({paid.length}{paidRaw.length !== bills.filter(b => b.paid_at).length ? ` of ${bills.filter(b => b.paid_at).length}` : ""})</CardTitle>
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
                      {[...new Set(bills.filter(b => b.paid_at).map(b => `${b.period_year}-${b.period_month}`))].sort((a, b) => b.localeCompare(a)).slice(0, 24).map(k => { const [y, m] = k.split("-"); return <SelectItem key={k} value={k}>{MONTHS[parseInt(m || "1") - 1]} {y}</SelectItem> })}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">Unit</Label>
                  <Select value={filterUnitId} onValueChange={setFilterUnitId}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">All units</SelectItem>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
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
                      <td className="py-3 pr-4 text-muted-foreground">{MONTHS[b.period_month - 1]} {b.period_year}</td>
                      <td className="py-3 text-right font-semibold text-green-600">{Number(b.total_amount).toFixed(2)}</td>
                    </tr>
                  );
                })}
                {!paid.length && <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{paidRaw.length === 0 && bills.filter(b => b.paid_at).length > 0 ? "No payments match filters." : "No payments yet."}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
