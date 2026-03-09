"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SortableTh, sortBy } from "@/components/ui/sortable-th";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SlidersHorizontal, ChevronDown, ChevronUp, Plus, Pencil, Trash2 } from "lucide-react";
import { useManagerData } from "../context";
import { MONTHS, expenseRef, isPeriodCurrent } from "../types";
import type { Expense } from "../types";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function ManagerExpensesPage() {
  const { data, load, loading, addExpense } = useManagerData();
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [filterPeriod, setFilterPeriod] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterVendor, setFilterVendor] = useState<string>("all");
  const [filterFrequency, setFilterFrequency] = useState<string>("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showRecurrentForm, setShowRecurrentForm] = useState(false);
  const [showAdhocForm, setShowAdhocForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [genMonth, setGenMonth] = useState(String(new Date().getMonth() + 1));
  const [genYear, setGenYear] = useState(String(new Date().getFullYear()));
  const [generating, setGenerating] = useState(false);
  const [adhocForm, setAdhocForm] = useState({ title: "", category: "Misc", vendor: "", amount: "", periodM: String(new Date().getMonth() + 1), periodY: String(new Date().getFullYear()) });
  const [editForm, setEditForm] = useState({ title: "", category: "", vendor: "", amount: "", frequency: "recurrent" });
  const [saving, setSaving] = useState(false);
  const { locale } = useLocale();

  if (loading) return <p className="text-muted-foreground">{t(locale, "common.loading")}</p>;

  const getExpenseValue = (e: Expense, col: string): string | number => {
    switch (col) {
      case "ref": return (e.reference_code ?? expenseRef(e)) as string;
      case "period": return e.period_year != null && e.period_month != null ? e.period_year * 100 + e.period_month : 0;
      case "category": return e.category ?? "";
      case "title": return e.title ?? "";
      case "vendor": return e.vendor ?? "";
      case "amount": return Number(e.amount);
      case "frequency": return e.frequency ?? "";
      case "status": return e.paid_at ? "Paid" : "Unpaid";
      default: return "";
    }
  };

  let filteredExpenses = data.expenses;
  if (filterPeriod !== "all") {
    const [y, m] = filterPeriod.split("-").map(Number);
    filteredExpenses = filteredExpenses.filter(e => e.period_year === y && e.period_month === m);
  }
  if (filterCategory !== "all") filteredExpenses = filteredExpenses.filter(e => e.category === filterCategory);
  if (filterVendor !== "all") filteredExpenses = filteredExpenses.filter(e => e.vendor === filterVendor);
  if (filterFrequency !== "all") filteredExpenses = filteredExpenses.filter(e => e.frequency === filterFrequency);

  const sortedExpenses = sortCol ? sortBy(filteredExpenses, sortCol, sortDir, getExpenseValue) : [...filteredExpenses].sort((a, b) => {
    const aPeriod = a.period_year != null && a.period_month != null ? a.period_year * 100 + a.period_month : 0;
    const bPeriod = b.period_year != null && b.period_month != null ? b.period_year * 100 + b.period_month : 0;
    return bPeriod - aPeriod || (b.title ?? "").localeCompare(a.title ?? "");
  });

  const handleSort = (col: string) => { setSortDir(prev => sortCol === col && prev === "asc" ? "desc" : "asc"); setSortCol(col); };

  const baseRefToIndices = new Map<string, number[]>();
  sortedExpenses.forEach((e, i) => {
    const raw = e.reference_code ?? expenseRef(e);
    const base = raw.replace(/-[0-9]+$/, "");
    const arr = baseRefToIndices.get(base) ?? [];
    arr.push(i);
    baseRefToIndices.set(base, arr);
  });
  const getDisplayRef = (e: Expense) => {
    const raw = e.reference_code ?? expenseRef(e);
    const base = raw.replace(/-[0-9]+$/, "");
    const indices = baseRefToIndices.get(base) ?? [];
    const idx = sortedExpenses.indexOf(e);
    const pos = indices.indexOf(idx) + 1;
    return indices.length > 1 ? `${base}-${pos}` : raw;
  };

  async function generateRecurrentExpenses() {
    setGenerating(true); setMsg({ text: "", ok: true });
    try {
      const m = parseInt(genMonth, 10), y = parseInt(genYear, 10);
      const res = await fetch("/api/manager/generate-recurrent-expenses", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ month: m, year: y }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok && j.success) {
        setMsg({ text: t(locale, "manager.generatedExpensesCount", { count: String(j.count ?? 0), month: MONTHS[m - 1], year: String(y) }), ok: true });
        load();
      } else setMsg({ text: j.error || t(locale, "common.failed"), ok: false });
    } catch (err) {
      setMsg({ text: (err as Error).message || t(locale, "common.errorOccurred"), ok: false });
    }
    setGenerating(false);
  }

  async function deleteExpensesPeriod() {
    const m = parseInt(genMonth, 10), y = parseInt(genYear, 10);
    const res = await fetch(`/api/manager/delete-expenses-period?month=${m}&year=${y}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    if (res.ok && j.success) {
      setMsg({ text: t(locale, "manager.deletedExpensesCount", { count: String(j.expensesDeleted ?? 0), month: MONTHS[m - 1], year: String(y) }), ok: true });
      load();
    } else setMsg({ text: j.error || t(locale, "common.failed"), ok: false });
  }

  async function recordAdhoc() {
    if (!adhocForm.title.trim()) { setMsg({ text: t(locale, "configExpenses.titleRequired"), ok: false }); return; }
    const amt = parseFloat(adhocForm.amount);
    if (isNaN(amt) || amt <= 0) { setMsg({ text: t(locale, "configExpenses.amountMustBePositive"), ok: false }); return; }
    setSaving(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/manager/record-ad-hoc-expense", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: adhocForm.title.trim(),
        category: adhocForm.category,
        vendor: adhocForm.vendor || "—",
        amount: amt,
        periodMonth: parseInt(adhocForm.periodM, 10),
        periodYear: parseInt(adhocForm.periodY, 10),
      }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && j.success) {
      const m = parseInt(adhocForm.periodM, 10), y = parseInt(adhocForm.periodY, 10);
      const newExpense: Expense = {
        id: j.expenseId ?? "",
        title: adhocForm.title.trim(),
        category: adhocForm.category || "Misc",
        vendor: adhocForm.vendor || "—",
        amount: amt,
        frequency: "ad_hoc",
        period_month: m,
        period_year: y,
      };
      if (newExpense.id) addExpense(newExpense);
      setMsg({ text: j.message ?? t(locale, "manager.adhocExpenseRecorded"), ok: true });
      setAdhocForm({ title: "", category: "Misc", vendor: "", amount: "", periodM: String(new Date().getMonth() + 1), periodY: String(new Date().getFullYear()) });
      setShowAdhocForm(false);
      load();
    } else setMsg({ text: j.error || t(locale, "common.failed"), ok: false });
  }

  async function updateExpense(id: string) {
    if (!editForm.title.trim()) { setMsg({ text: t(locale, "configExpenses.titleRequired"), ok: false }); return; }
    const amt = parseFloat(editForm.amount);
    if (isNaN(amt) || amt <= 0) { setMsg({ text: t(locale, "configExpenses.amountMustBePositive"), ok: false }); return; }
    setSaving(true); setMsg({ text: "", ok: true });
    const res = await fetch("/api/manager/expenses", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, title: editForm.title.trim(), category: editForm.category || "Misc", vendor: editForm.vendor || "—", amount: amt, frequency: editForm.frequency }),
    });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && j.success) {
      setMsg({ text: t(locale, "manager.expenseUpdated"), ok: true });
      setEditingId(null);
      load();
    } else setMsg({ text: j.error || t(locale, "common.failed"), ok: false });
  }

  async function deleteExpense(id: string) {
    if (!confirm(t(locale, "manager.deleteExpenseConfirm"))) return;
    setSaving(true); setMsg({ text: "", ok: true });
    const res = await fetch(`/api/manager/expenses?id=${id}`, { method: "DELETE" });
    const j = await res.json().catch(() => ({}));
    setSaving(false);
    if (res.ok && j.success) {
      setMsg({ text: t(locale, "manager.expenseDeleted"), ok: true });
      setEditingId(null);
      load();
    } else setMsg({ text: j.error || t(locale, "common.failed"), ok: false });
  }

  async function markPaid(id: string) {
    const res = await fetch("/api/expenses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expenseId: id, paid: true }) });
    const j = await res.json().catch(() => ({}));
    if (j.success) load();
    else setMsg({ text: j.error || t(locale, "common.failed"), ok: false });
  }

  async function markUnpaid(id: string) {
    const res = await fetch("/api/expenses", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ expenseId: id, paid: false }) });
    const j = await res.json().catch(() => ({}));
    if (j.success) load();
    else setMsg({ text: j.error || t(locale, "common.failed"), ok: false });
  }

  const periodOptions = [...new Set(data.expenses.filter(e => e.period_month != null).map(e => `${e.period_year}-${e.period_month}`))].sort((a, b) => b.localeCompare(a)).slice(0, 24);
  const categories = [...new Set(data.expenses.map(e => e.category).filter(Boolean))].sort();
  const vendors = [...new Set(data.expenses.map(e => e.vendor).filter(Boolean))].sort();
  const adhocCategoryOptions = ["Misc", ...data.serviceCategories.map(c => c.name).filter(n => n && n !== "Misc")];
  const adhocVendorOptions = ["—", ...data.vendors.map(v => v.name).filter(n => n && n !== "—")];

  const curM = new Date().getMonth() + 1;
  const curY = new Date().getFullYear();
  const currentPeriodExpenses = data.expenses.filter(e => e.period_month === curM && e.period_year === curY);
  const recurrentInPeriod = currentPeriodExpenses.filter(e => e.frequency === "recurrent");
  const adhocInPeriod = currentPeriodExpenses.filter(e => e.frequency === "ad_hoc");
  const recurrentSum = recurrentInPeriod.reduce((s, e) => s + Number(e.amount), 0);
  const adhocSum = adhocInPeriod.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <div className="space-y-4 mt-2">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-l-4 border-l-blue-500 py-3 gap-1 px-4">
          <p className="text-xl font-extrabold text-blue-600 shrink-0">{recurrentSum.toFixed(2)}</p>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "manager.monthlyRecurrentTemplates")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{recurrentInPeriod.length} items · {MONTHS[curM - 1]} {curY}</p>
          </div>
        </Card>
        <Card className="border-l-4 border-l-amber-500 py-3 gap-1 px-4">
          <p className="text-xl font-extrabold text-amber-600 shrink-0">{adhocSum.toFixed(2)}</p>
          <div>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">{t(locale, "manager.adHoc")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{adhocInPeriod.length} items · {MONTHS[curM - 1]} {curY}</p>
          </div>
        </Card>
      </div>
      <Card>
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-2">
          <CardTitle className="text-base sm:text-lg">{t(locale, "manager.allExpenses")} ({sortedExpenses.length}{filteredExpenses.length !== data.expenses.length ? ` of ${data.expenses.length}` : ""})</CardTitle>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="h-8 gap-1 text-white border-0 bg-[#0ac5b2] hover:bg-[#09b3a3]" onClick={() => { setShowRecurrentForm(v => !v); setShowAdhocForm(false); }}>
              {showRecurrentForm ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
              {t(locale, "manager.recurrent")}
            </Button>
            <Button size="sm" className="h-8 gap-1 text-white border-0 bg-[#0ac5b2] hover:bg-[#09b3a3]" onClick={() => { setShowAdhocForm(v => !v); setShowRecurrentForm(false); }}>
              <Plus className="size-3.5" />
              {t(locale, "manager.addExpense")}
            </Button>
            <Button variant="outline" size="icon" className="h-9 w-9 shrink-0 md:hidden" onClick={() => setShowFilters(v => !v)} aria-label={t(locale, "common.toggleFilters")}>
              <SlidersHorizontal className="size-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 pt-0">
          {showRecurrentForm && (
            <div className="rounded-md border-l-4 border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 space-y-2">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">{t(locale, "manager.generateExpensesDescription")}</p>
              <div className="flex flex-wrap gap-2 items-center">
                <Select value={genMonth} onValueChange={setGenMonth}>
                  <SelectTrigger className="w-28 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent>
                </Select>
                <Select value={genYear} onValueChange={setGenYear}>
                  <SelectTrigger className="w-20 h-8"><SelectValue /></SelectTrigger>
                  <SelectContent>{[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
                </Select>
                <Button size="sm" className="h-8" onClick={generateRecurrentExpenses} disabled={generating}>{generating ? "..." : t(locale, "manager.generate")}</Button>
                <Button variant="outline" size="sm" className="h-8" disabled={!isPeriodCurrent(parseInt(genMonth), parseInt(genYear))} onClick={deleteExpensesPeriod}>{t(locale, "manager.deleteBillsPeriod")}</Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowRecurrentForm(false)}>{t(locale, "common.cancel")}</Button>
              </div>
              <div className="text-xs text-muted-foreground">
                <strong>{t(locale, "manager.recurrentTemplates")}</strong> {data.expenses.filter(e => e.period_month == null && e.period_year == null && e.frequency === "recurrent").length}
              </div>
            </div>
          )}
          {showAdhocForm && (
            <div className="rounded-md border-l-4 border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 p-3 space-y-2">
              <p className="text-xs font-medium text-emerald-800 dark:text-emerald-200">{t(locale, "manager.recordAdhocExpenseTitle")}</p>
              <div className="flex flex-wrap gap-2 items-end">
                <div className="min-w-0 flex-1"><Label className="text-xs">{t(locale, "common.title")}</Label><Input value={adhocForm.title} onChange={e => setAdhocForm({ ...adhocForm, title: e.target.value })} placeholder={t(locale, "manager.expensePlaceholder")} className="h-8" /></div>
                <div><Label className="text-xs">{t(locale, "table.category")}</Label><Select value={adhocForm.category || "Misc"} onValueChange={v => setAdhocForm({ ...adhocForm, category: v })}><SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger><SelectContent>{adhocCategoryOptions.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">{t(locale, "table.vendor")}</Label><Select value={adhocForm.vendor || "__none__"} onValueChange={v => setAdhocForm({ ...adhocForm, vendor: v === "__none__" ? "" : v })}><SelectTrigger className="h-8 w-28"><SelectValue placeholder="—" /></SelectTrigger><SelectContent><SelectItem value="__none__">—</SelectItem>{adhocVendorOptions.filter(v => v !== "—").map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">{t(locale, "configExpenses.amountEur")}</Label><Input type="number" step="0.01" value={adhocForm.amount} onChange={e => setAdhocForm({ ...adhocForm, amount: e.target.value })} placeholder="0.00" className="h-8 w-24" /></div>
                <div><Label className="text-xs">{t(locale, "table.period")}</Label><Select value={adhocForm.periodM} onValueChange={v => setAdhocForm({ ...adhocForm, periodM: v })}><SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger><SelectContent>{MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">{t(locale, "manager.year")}</Label><Select value={adhocForm.periodY} onValueChange={v => setAdhocForm({ ...adhocForm, periodY: v })}><SelectTrigger className="h-8 w-20"><SelectValue /></SelectTrigger><SelectContent>{[new Date().getFullYear(), new Date().getFullYear() - 1].map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent></Select></div>
                <Button size="sm" className="h-8" onClick={recordAdhoc} disabled={saving}>{saving ? "..." : t(locale, "common.save")}</Button>
                <Button variant="ghost" size="sm" className="h-8" onClick={() => setShowAdhocForm(false)}>{t(locale, "common.cancel")}</Button>
              </div>
            </div>
          )}
          <div className={`grid transition-[grid-template-rows] duration-200 ${showFilters ? "grid-rows-[1fr]" : "grid-rows-[0fr]"} md:grid-rows-[1fr]`}>
            <div className="min-h-0 overflow-hidden">
              <div className="flex flex-wrap gap-2 items-end pb-3">
                <div><Label className="text-xs">{t(locale, "table.period")}</Label><Select value={filterPeriod} onValueChange={setFilterPeriod}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t(locale, "filters.allPeriods")}</SelectItem>{periodOptions.map(k => { const [y, m] = k.split("-"); return <SelectItem key={k} value={k}>{MONTHS[parseInt(m || "1") - 1]} {y}</SelectItem> })}</SelectContent></Select></div>
                <div><Label className="text-xs">{t(locale, "table.category")}</Label><Select value={filterCategory} onValueChange={setFilterCategory}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t(locale, "common.all")}</SelectItem>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">{t(locale, "table.vendor")}</Label><Select value={filterVendor} onValueChange={setFilterVendor}><SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t(locale, "common.all")}</SelectItem>{vendors.map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent></Select></div>
                <div><Label className="text-xs">{t(locale, "table.frequency")}</Label><Select value={filterFrequency} onValueChange={setFilterFrequency}><SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{t(locale, "common.all")}</SelectItem><SelectItem value="recurrent">{t(locale, "manager.recurrent")}</SelectItem><SelectItem value="ad_hoc">{t(locale, "manager.adHoc")}</SelectItem></SelectContent></Select></div>
              </div>
            </div>
          </div>
          {msg.text && <p className={`text-xs ${msg.ok ? "text-green-600" : "text-amber-600"}`}>{msg.text}</p>}
          <div className="overflow-x-auto">
            <table className="w-full min-w-full text-sm table-fixed">
              <thead>
                <tr className="border-b text-left">
                  <SortableTh column="ref" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.reference")}</SortableTh>
                  <SortableTh column="period" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.period")}</SortableTh>
                  <SortableTh column="category" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.category")}</SortableTh>
                  <SortableTh column="title" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "common.title")}</SortableTh>
                  <SortableTh column="vendor" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.vendor")}</SortableTh>
                  <SortableTh column="amount" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground" align="right">{t(locale, "table.amount")}</SortableTh>
                  <SortableTh column="frequency" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.frequency")}</SortableTh>
                  <SortableTh column="status" sortCol={sortCol} sortDir={sortDir} onSort={handleSort} className="pb-3 pr-4 font-medium text-muted-foreground">{t(locale, "table.status")}</SortableTh>
                  <th className="pb-3 font-medium text-muted-foreground">{t(locale, "table.action")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sortedExpenses.map(e => (
                  <tr key={e.id} className="hover:bg-muted/30">
                    {editingId === e.id ? (
                      <>
                        <td colSpan={9} className="py-2">
                          <div className="flex flex-wrap gap-2 items-end">
                            <Input value={editForm.title} onChange={ev => setEditForm({ ...editForm, title: ev.target.value })} placeholder={t(locale, "common.title")} className="h-8 w-36" />
                            <Input value={editForm.category} onChange={ev => setEditForm({ ...editForm, category: ev.target.value })} placeholder={t(locale, "table.category")} className="h-8 w-24" />
                            <Input value={editForm.vendor} onChange={ev => setEditForm({ ...editForm, vendor: ev.target.value })} placeholder={t(locale, "table.vendor")} className="h-8 w-24" />
                            <Input type="number" step="0.01" value={editForm.amount} onChange={ev => setEditForm({ ...editForm, amount: ev.target.value })} className="h-8 w-20" />
                            <Select value={editForm.frequency} onValueChange={v => setEditForm({ ...editForm, frequency: v })}><SelectTrigger className="h-8 w-24"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recurrent">{t(locale, "manager.recurrent")}</SelectItem><SelectItem value="ad_hoc">{t(locale, "manager.adHoc")}</SelectItem></SelectContent></Select>
                            <Button size="sm" className="h-8" onClick={() => updateExpense(e.id)} disabled={saving}>{saving ? "..." : t(locale, "common.save")}</Button>
                            <Button variant="ghost" size="sm" className="h-8" onClick={() => setEditingId(null)}>{t(locale, "common.cancel")}</Button>
                          </div>
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="py-3 pr-4 font-mono text-xs select-text">{getDisplayRef(e)}</td>
                        <td className="py-3 pr-4 font-medium">{e.period_month != null && e.period_year != null ? `${MONTHS[e.period_month - 1]} ${e.period_year}` : "—"}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{e.category ?? "—"}</td>
                        <td className="py-3 pr-4">{e.title ?? "—"}</td>
                        <td className="py-3 pr-4 text-muted-foreground">{e.vendor ?? "—"}</td>
                        <td className="py-3 pr-4 text-right font-semibold tabular-nums">{Number(e.amount).toFixed(2)}</td>
                        <td className="py-3 pr-4"><span className={`inline-block text-[10px] font-medium px-1.5 py-0.5 rounded ${e.frequency === "ad_hoc" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" : "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400"}`}>{e.frequency === "ad_hoc" ? t(locale, "manager.adHoc") : t(locale, "manager.recurrent")}</span></td>
                        <td className="py-3 pr-4">{e.paid_at ? <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">✓ {t(locale, "filters.paid")}</span> : <span className="inline-flex items-center gap-1 text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-medium">{t(locale, "filters.unpaid")}</span>}</td>
                        <td className="py-3">
                          <div className="flex flex-wrap gap-1">
                            {!e.paid_at && (
                              <>
                                <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setEditingId(e.id); setEditForm({ title: e.title ?? "", category: e.category ?? "", vendor: e.vendor ?? "", amount: String(e.amount), frequency: e.frequency ?? "recurrent" }); }}><Pencil className="size-3" /></Button>
                                <Button size="sm" variant="ghost" className="h-7 text-xs text-red-600 hover:text-red-700" onClick={() => deleteExpense(e.id)} disabled={saving}><Trash2 className="size-3" /></Button>
                              </>
                            )}
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => e.paid_at ? markUnpaid(e.id) : markPaid(e.id)}>{e.paid_at ? t(locale, "manager.markUnpaid") : t(locale, "manager.markPaid")}</Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
                {!sortedExpenses.length && <tr><td colSpan={9} className="py-8 text-center text-muted-foreground">{data.expenses.length === 0 ? t(locale, "manager.noExpensesYet") : t(locale, "manager.noExpensesMatchFilters")}</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
