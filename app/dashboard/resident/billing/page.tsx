"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { FileText, Download, Camera, SlidersHorizontal } from "lucide-react";
import { useOwnerData } from "../context";
import { MONTHS } from "../types";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function OwnerBillingPage() {
  const { data, triggerFileInput, uploadingFor, uploadError, setUploadError } = useOwnerData();
  const { locale } = useLocale();
  const [billsSortCol, setBillsSortCol] = useState<string | null>(null);
  const [billsSortDir, setBillsSortDir] = useState<"asc" | "desc">("asc");
  const [filterPeriod, setFilterPeriod] = useState("all");
  const [filterUnitType, setFilterUnitType] = useState("all");
  const [filterUnitId, setFilterUnitId] = useState("all");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");
  const [showBillingFilters, setShowBillingFilters] = useState(false);

  const { profile, units, allUnits, buildings, bills, unitTenantAssignments, tenants } = data;
  const unitMap = new Map(allUnits.map(u => [u.id, u]));
  const unitIdSet = new Set(units.map(u => u.id));
  const myBills = bills.filter(b => unitIdSet.has(b.unit_id));
  const tenantMap = new Map(tenants.map(t => [t.id, t]));
  const unitResponsibleTenantMap = new Map<string, string>();
  unitTenantAssignments.forEach(a => {
    if (!unitResponsibleTenantMap.has(a.unit_id) && a.is_payment_responsible !== false) unitResponsibleTenantMap.set(a.unit_id, a.tenant_id);
    else if (a.is_payment_responsible === true) unitResponsibleTenantMap.set(a.unit_id, a.tenant_id);
  });

  const getOwnerBillValue = (b: typeof myBills[0], col: string): string | number => {
    const payerId = unitResponsibleTenantMap.get(b.unit_id) ?? profile?.id ?? "_owner";
    const billToName = payerId === profile?.id || payerId === "_owner" ? t(locale, "common.you") : (tenantMap.get(payerId) ? `${tenantMap.get(payerId)!.name} ${tenantMap.get(payerId)!.surname}` : "—");
    switch (col) {
      case "ref": return ((b as { reference_code?: string }).reference_code ?? "") as string;
      case "period": return b.period_year * 100 + b.period_month;
      case "billTo": return billToName as string;
      case "unit": return (unitMap.get(b.unit_id)?.unit_name ?? "") as string;
      case "amount": return Math.abs(Number(b.total_amount));
      case "status": return (b.paid_at ? t(locale, "filters.paid") : b.status === "in_process" ? t(locale, "filters.inProcess") : b.status) as string;
      case "paidOn": return b.paid_at ? new Date(b.paid_at).getTime() : 0;
      default: return "";
    }
  };
  let filteredBills = myBills;
  if (filterPeriod !== "all") {
    const [y, m] = filterPeriod.split("-").map(Number);
    filteredBills = filteredBills.filter(b => b.period_year === y && b.period_month === m);
  }
  if (filterUnitType !== "all") {
    const unitIdsByType = new Set(units.filter(u => u.type === filterUnitType).map(u => u.id));
    filteredBills = filteredBills.filter(b => unitIdsByType.has(b.unit_id));
  }
  if (filterUnitId !== "all") filteredBills = filteredBills.filter(b => b.unit_id === filterUnitId);
  if (filterPaymentStatus !== "all") {
    if (filterPaymentStatus === "paid") filteredBills = filteredBills.filter(b => b.paid_at);
    else if (filterPaymentStatus === "unpaid") filteredBills = filteredBills.filter(b => !b.paid_at && b.status !== "in_process");
    else if (filterPaymentStatus === "in_process") filteredBills = filteredBills.filter(b => b.status === "in_process");
  }
  const sortedBillsForDisplay = billsSortCol ? sortBy(filteredBills, billsSortCol, billsSortDir, getOwnerBillValue) : [...filteredBills].sort((a, b) => b.period_year - a.period_year || b.period_month - a.period_month);
  const handleBillsSort = (col: string) => { setBillsSortDir(prev => billsSortCol === col && prev === "asc" ? "desc" : "asc"); setBillsSortCol(col); };

  const ownerId = profile?.id;
  const byPeriodAndPayer = new Map<string, typeof myBills>();
  filteredBills.forEach(b => {
    const payerId = unitResponsibleTenantMap.get(b.unit_id) ?? ownerId ?? "_owner";
    const k = `${b.period_year}-${String(b.period_month).padStart(2, "0")}-${payerId}`;
    const list = byPeriodAndPayer.get(k) ?? [];
    list.push(b);
    byPeriodAndPayer.set(k, list);
  });

  return (
    <div className="space-y-4 mt-2">
      {!units.length && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/30 dark:border-amber-800">
          <p className="text-sm">No units assigned to you. Ask the manager to assign you in <strong>Config → Units</strong> (Owner) or <strong>Config → Users</strong> (Unit assignments).</p>
        </div>
      )}
      {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>{t(locale, "headers.myBills")} ({myBills.length}{sortedBillsForDisplay.length !== myBills.length ? ` — showing ${sortedBillsForDisplay.length}` : ""})</CardTitle>
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
                <div><Label className="text-xs">{t(locale, "table.unitType")}</Label>
                  <Select value={filterUnitType} onValueChange={setFilterUnitType}>
                    <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t(locale, "filters.allTypes")}</SelectItem>{[...new Set(units.map(u=>u.type))].map(t=><SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
          <div className="w-full min-w-0 overflow-x-auto md:overflow-visible">
          <table className="w-full min-w-[56rem] text-sm table-fixed">
            <colgroup>
              <col style={{ width: "10%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "12%" }} />
              <col style={{ width: "9%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "11%" }} />
              <col style={{ width: "8%" }} />
              <col style={{ width: "15%" }} />
            </colgroup>
            <thead><tr className="border-b text-left">
              <SortableTh column="ref" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "table.reference")}</SortableTh>
              <SortableTh column="period" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "table.period")}</SortableTh>
              <SortableTh column="billTo" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "table.billTo")}</SortableTh>
              <SortableTh column="unit" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "table.unit")}</SortableTh>
              <SortableTh column="amount" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-2 font-medium text-muted-foreground text-right" align="right">{t(locale, "table.amount")}</SortableTh>
              <SortableTh column="status" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-2 font-medium text-muted-foreground break-words">{t(locale, "table.status")}</SortableTh>
              <SortableTh column="paidOn" sortCol={billsSortCol} sortDir={billsSortDir} onSort={handleBillsSort} className="pb-3 pr-2 font-medium text-muted-foreground">{t(locale, "table.paidOn")}</SortableTh>
              <th className="pb-3 pr-2 font-medium text-muted-foreground">PDF</th>
              <th className="pb-3 pr-2 font-medium text-muted-foreground">{t(locale, "table.action")}</th>
            </tr></thead>
            <tbody className="divide-y divide-border">
              {(() => {
                const seenGroup = new Set<string>();
                return sortedBillsForDisplay.map(b => {
                  const payerId = unitResponsibleTenantMap.get(b.unit_id) ?? ownerId ?? "_owner";
                  const groupKey = `${b.period_year}-${String(b.period_month).padStart(2, "0")}-${payerId}`;
                  const billsInGroup = byPeriodAndPayer.get(groupKey) ?? [];
                  const isFirstInGroup = !seenGroup.has(groupKey);
                  if (isFirstInGroup) seenGroup.add(groupKey);
                  const billToName = payerId === ownerId || payerId === "_owner" ? t(locale, "common.you") : (tenantMap.get(payerId) ? `${tenantMap.get(payerId)!.name} ${tenantMap.get(payerId)!.surname}` : "—");
                  const anyReceipt = billsInGroup.some(x => x.receipt_url || x.receipt_path);
                  const uploadKey = `${b.period_month}-${b.period_year}-${payerId}`;
                  return (
                    <tr key={b.id} className="hover:bg-muted/30">
                      <td className="py-3 pr-2 font-mono text-xs select-text break-words">{(b as { reference_code?: string }).reference_code ?? "—"}</td>
                      <td className="py-3 pr-2 font-medium break-words">{t(locale, `common.month${b.period_month}`)} {b.period_year}</td>
                      <td className="py-3 pr-2 font-medium break-words">{billToName}</td>
                      <td className="py-3 pr-2 text-muted-foreground break-words">{unitMap.get(b.unit_id)?.unit_name ?? "—"}</td>
                      <td className="py-3 pr-2 text-right font-semibold">{Number(b.total_amount).toFixed(2)}</td>
                      <td className="py-3 pr-2">
                        {b.paid_at ? <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ {t(locale, "filters.paid")}</span> : b.status === "in_process" ? <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "filters.inProcess")}</span> : <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "filters.unpaid")}</span>}
                      </td>
                      <td className="py-3 pr-2 text-muted-foreground text-xs">{b.paid_at ? new Date(b.paid_at).toLocaleDateString() : "—"}</td>
                      <td className="py-3 pr-2">
                        {isFirstInGroup ? (
                          <a href={`/api/invoice?periodMonth=${b.period_month}&periodYear=${b.period_year}&paymentResponsibleId=${payerId}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><Download className="size-3" /> PDF</a>
                        ) : "—"}
                      </td>
                      <td className="py-3 pr-2">
                        {isFirstInGroup ? (
                          <div className="flex flex-col gap-1">
                            {anyReceipt && (
                              <a href={`/api/receipt?billId=${billsInGroup[0].id}`} target="_blank" rel="noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-1 w-fit"><FileText className="size-3" /> View</a>
                            )}
                            {!b.paid_at && (
                              <Button size="sm" variant="outline" className="h-7 text-xs w-fit" disabled={!!uploadingFor} onClick={() => triggerFileInput({ periodMonth: b.period_month, periodYear: b.period_year, paymentResponsibleId: payerId })}>
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
              {(myBills.length === 0 || sortedBillsForDisplay.length === 0) && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{myBills.length === 0 ? t(locale, "owner.noBillsYet") : t(locale, "owner.noBillsMatchFilters")}</td></tr>}
            </tbody>
          </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
