"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { useOwnerData } from "../context";
import { MONTHS } from "../types";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function OwnerPaymentsPage() {
  const { data, loading } = useOwnerData();
  const { locale } = useLocale();
  const [paymentInfo, setPaymentInfo] = useState<{ site_name: string | null; bank_name: string | null; iban: string | null; swift_code: string | null; vat_account: string | null; manager_name: string | null; manager_email: string | null; manager_phone: string | null; payment_methods: string[] } | null>(null);
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterUnitId, setFilterUnitId] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetch("/api/payment-info", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((json: Parameters<typeof setPaymentInfo>[0]) => setPaymentInfo(json));
  }, []);

  const { bills, units, allUnits } = data;
  const unitIdSet = new Set(units.map(u => u.id));
  const myBills = bills.filter(b => unitIdSet.has(b.unit_id));
  const unitMap = new Map(allUnits.map(u => [u.id, u]));
  let paidRaw = myBills.filter(b => b.paid_at);
  if (filterPeriod !== "all") {
    const [y, m] = filterPeriod.split("-").map(Number);
    paidRaw = paidRaw.filter(b => b.period_year === y && b.period_month === m);
  }
  if (filterUnitId !== "all") paidRaw = paidRaw.filter(b => b.unit_id === filterUnitId);

  const getPaidValue = (b: (typeof myBills)[0], col: string): string | number => {
    switch (col) {
      case "ref": return ((b as { reference_code?: string }).reference_code ?? "") as string;
      case "paidOn": return new Date(b.paid_at!).getTime();
      case "unit": return (unitMap.get(b.unit_id)?.unit_name ?? "") as string;
      case "period": return b.period_year * 100 + b.period_month;
      case "amount": return Math.abs(Number(b.total_amount));
      default: return "";
    }
  };

  const paid = sortCol ? sortBy(paidRaw, sortCol, sortDir, getPaidValue) : [...paidRaw].sort((a, b) => new Date(b.paid_at!).getTime() - new Date(a.paid_at!).getTime());
  const totalPaid = paid.reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const handlePaidSort = (col: string) => { setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc"); setSortCol(col); };

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const copyToClipboard = useCallback(async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {}
  }, []);

  if (loading) return <p className="text-muted-foreground">{t(locale, "common.loading")}</p>;

  const myPaidBills = myBills.filter(b => b.paid_at);
  const totalPaidByOwner = myPaidBills.reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-green-500 py-3 gap-1 px-4">
          <CardHeader className="pb-0 pt-2 px-0"><CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "owner.totalPaidByOwner")}</CardTitle></CardHeader>
          <CardContent className="pb-2 pt-0 px-0"><p className="text-lg font-extrabold text-green-600">{totalPaidByOwner.toFixed(2)}</p><p className="text-xs text-muted-foreground mt-0.5">{t(locale, "owner.paymentsReceived", { count: String(myPaidBills.length) })}</p></CardContent>
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
          <CardTitle>{t(locale, "owner.paymentHistory")} ({paid.length}{paidRaw.length !== myBills.filter(b => b.paid_at).length ? ` ${t(locale, "owner.of")} ${myBills.filter(b => b.paid_at).length}` : ""})</CardTitle>
          <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowFilters(v => !v)} aria-label={t(locale, "common.toggleFilters")}>
            <SlidersHorizontal className="size-4" />
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`grid transition-[grid-template-rows] duration-200 ${showFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-wrap gap-2 items-end pb-3">
                <div><Label className="text-xs">{t(locale, "table.period")}</Label>
                  <Select value={filterPeriod} onValueChange={setFilterPeriod}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t(locale, "filters.allPeriods")}</SelectItem>
                      {[...new Set(myBills.filter(b => b.paid_at).map(b => `${b.period_year}-${b.period_month}`))].sort((a, b) => b.localeCompare(a)).slice(0, 24).map(k => { const [y, m] = k.split("-"); return <SelectItem key={k} value={k}>{t(locale, `common.month${parseInt(m || "1")}`)} {y}</SelectItem> })}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-xs">{t(locale, "table.unit")}</Label>
                  <Select value={filterUnitId} onValueChange={setFilterUnitId}>
                    <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="all">{t(locale, "filters.allUnits")}</SelectItem>{units.map(u => <SelectItem key={u.id} value={u.id}>{u.unit_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm table-auto">
              <thead><tr className="border-b text-left">
                <SortableTh column="ref" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.reference")}</SortableTh>
                <SortableTh column="paidOn" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.paidOn")}</SortableTh>
                <SortableTh column="unit" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.unit")}</SortableTh>
                <SortableTh column="period" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.period")}</SortableTh>
                <SortableTh column="amount" sortCol={sortCol} sortDir={sortDir} onSort={handlePaidSort} className="pb-3 font-medium text-muted-foreground" align="right">{t(locale, "table.amount")}</SortableTh>
              </tr></thead>
              <tbody className="divide-y divide-border">
                {paid.map(b => (
                  <tr key={b.id} className="hover:bg-muted/30">
                    <td className="py-3 pr-4 font-mono text-xs select-text">{(b as { reference_code?: string }).reference_code ?? "—"}</td>
                    <td className="py-3 pr-4 font-medium">{new Date(b.paid_at!).toLocaleDateString()}</td>
                    <td className="py-3 pr-4">{unitMap.get(b.unit_id)?.unit_name ?? "—"}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{t(locale, `common.month${b.period_month}`)} {b.period_year}</td>
                    <td className="py-3 text-right font-semibold text-green-600">{Number(b.total_amount).toFixed(2)}</td>
                  </tr>
                ))}
                {!paid.length && <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{paidRaw.length === 0 && myBills.filter(b => b.paid_at).length > 0 ? t(locale, "owner.noPaymentsMatchFilters") : t(locale, "owner.noPaymentsYet")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
