"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useManagerData } from "../../context";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type { EnergyMeter, EnergyPeriod, EnergyReading, EnergyUnitShare, Unit } from "@/types/database";

type ReconciliationAllocation = {
  unitId: string;
  sharePercent: number;
  kwhMeterConsumption: number;
  kwhFromSolar: number;
  kwhFromGrid: number;
  kwhSupplierNet: number;
  kwhAllocated: number;
  creditAmountEur: number;
};

type ReconciliationSettlement = {
  totalProductionKwh: number;
  totalConsumptionKwh: number;
  gridImportKwh: number;
  gridExportKwh: number;
  expectedGridImportKwh: number;
  expectedGridExportKwh: number;
  totalSupplierNetKwh: number;
  reconciliationDeltaKwh: number;
  reconciliationOk: boolean;
  surplusKwh: number;
  gridTariffEurPerKwh: number;
  allocations: ReconciliationAllocation[];
  totalCreditEur: number;
};

type ReconciliationPayload = {
  meters: EnergyMeter[];
  shares: EnergyUnitShare[];
  shareTotalPercent: number;
  units: Unit[];
  readings: EnergyReading[];
  period: EnergyPeriod | null;
  communityMeter: EnergyMeter | null;
  hasCommunityMeter: boolean;
  communityReadingMissing: boolean;
  reconciliation: ReconciliationSettlement | null;
  reconciliationError: string | null;
  missingMeters: { id: string; label: string; meter_role: string }[];
};

const MONTH_KEYS = [
  "common.month1",
  "common.month2",
  "common.month3",
  "common.month4",
  "common.month5",
  "common.month6",
  "common.month7",
  "common.month8",
  "common.month9",
  "common.month10",
  "common.month11",
  "common.month12",
] as const;

export default function ManagerEnergyReconciliationPage() {
  const { data } = useManagerData();
  const { locale } = useLocale();
  const now = new Date();

  const [buildingId, setBuildingId] = useState("");
  const [payload, setPayload] = useState<ReconciliationPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [gridTariff, setGridTariff] = useState("0.15");
  const [communityDeviceId, setCommunityDeviceId] = useState("");
  const [readingDraft, setReadingDraft] = useState<{ import: string; export: string }>({ import: "", export: "" });
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (!buildingId && data.buildings.length) setBuildingId(data.buildings[0].id);
  }, [data.buildings, buildingId]);

  const load = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    try {
      const tariff = encodeURIComponent(gridTariff || "0.15");
      const res = await fetch(
        `/api/manager/energy/reconciliation?building_id=${encodeURIComponent(buildingId)}&month=${periodMonth}&year=${periodYear}&grid_tariff=${tariff}`
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
        return;
      }
      const data = json as ReconciliationPayload;
      setPayload(data);
      if (data.communityMeter) {
        setCommunityDeviceId(data.communityMeter.external_device_id ?? "");
        const found = (data.readings ?? []).find(r => r.meter_id === data.communityMeter!.id);
        setReadingDraft({
          import: found ? String(found.kwh_import) : "",
          export: found ? String(found.kwh_export) : "",
        });
      }
      if (data.period?.grid_tariff_eur_per_kwh != null && !gridTariff.trim()) {
        setGridTariff(String(data.period.grid_tariff_eur_per_kwh));
      }
    } finally {
      setLoading(false);
    }
  }, [buildingId, periodMonth, periodYear, gridTariff, locale]);

  useEffect(() => {
    load();
  }, [load]);

  const buildingUnits = useMemo(
    () => (payload?.units ?? []).filter(u => u.building_id === buildingId),
    [payload?.units, buildingId]
  );

  const isSettled = payload?.period?.status === "settled";
  const reconciliation = payload?.reconciliation ?? null;

  function unitLabel(unitId: string) {
    const u = buildingUnits.find(x => x.id === unitId);
    return u ? `${u.unit_name} (${u.type})` : unitId.slice(0, 8);
  }

  async function addCommunityMeter() {
    const res = await fetch("/api/manager/energy/meters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        building_id: buildingId,
        meter_role: "community",
        external_device_id: communityDeviceId,
      }),
    });
    const json = await res.json();
    if (!res.ok) setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
    else {
      setMsg({ text: t(locale, "energyReconciliation.communityMeterAdded"), ok: true });
      load();
    }
  }

  async function saveCommunityReading() {
    if (!payload?.communityMeter) return;
    const res = await fetch("/api/manager/energy/readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        building_id: buildingId,
        meter_id: payload.communityMeter.id,
        period_month: periodMonth,
        period_year: periodYear,
        kwh_import: readingDraft.import || 0,
        kwh_export: readingDraft.export || 0,
      }),
    });
    const json = await res.json();
    if (!res.ok) setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
    else {
      setMsg({ text: t(locale, "energy.readingSaved"), ok: true });
      load();
    }
  }

  async function runSettlement() {
    const tariff = Number(gridTariff);
    if (!Number.isFinite(tariff) || tariff <= 0) {
      setMsg({ text: t(locale, "energy.tariffRequired"), ok: false });
      return;
    }
    setSettling(true);
    try {
      const res = await fetch("/api/manager/energy/settle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          building_id: buildingId,
          period_month: periodMonth,
          period_year: periodYear,
          grid_tariff_eur_per_kwh: tariff,
          dry_run: false,
        }),
      });
      const json = await res.json();
      if (!res.ok) setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
      else {
        setMsg({ text: t(locale, "energy.settlementDone"), ok: true });
        load();
      }
    } finally {
      setSettling(false);
    }
  }

  return (
    <div className="space-y-6">
      {!data.site?.energy_addon_enabled ? (
        <p className="text-sm text-muted-foreground">{t(locale, "energy.addonDisabled")}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-4 items-center border-b pb-3">
            <Link
              href="/dashboard/manager/energy"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              {t(locale, "energy.title")}
            </Link>
            <span className="text-sm font-semibold">{t(locale, "energyReconciliation.title")}</span>
          </div>

          <div>
            <h2 className="text-lg font-semibold">{t(locale, "energyReconciliation.title")}</h2>
            <p className="text-sm text-muted-foreground">{t(locale, "energyReconciliation.subtitle")}</p>
          </div>

          {msg.text && (
            <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
          )}

          <div className="flex flex-wrap gap-3 items-end">
            <div>
              <Label>{t(locale, "energy.selectBuilding")}</Label>
              <select
                className="border rounded-md h-9 px-2 text-sm bg-background"
                value={buildingId}
                onChange={e => setBuildingId(e.target.value)}
              >
                {data.buildings.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t(locale, "energy.periodMonth")}</Label>
              <select
                className="border rounded-md h-9 px-2 text-sm bg-background"
                value={periodMonth}
                onChange={e => setPeriodMonth(parseInt(e.target.value, 10))}
              >
                {MONTH_KEYS.map((key, i) => (
                  <option key={key} value={i + 1}>{t(locale, key)}</option>
                ))}
              </select>
            </div>
            <div>
              <Label>{t(locale, "energy.periodYear")}</Label>
              <Input
                type="number"
                className="w-24"
                value={periodYear}
                onChange={e => setPeriodYear(parseInt(e.target.value, 10) || periodYear)}
              />
            </div>
            <div>
              <Label>{t(locale, "energy.gridTariff")}</Label>
              <Input
                type="number"
                min={0}
                step={0.0001}
                className="w-28"
                value={gridTariff}
                onChange={e => setGridTariff(e.target.value)}
              />
            </div>
            <Button type="button" variant="outline" size="sm" onClick={load}>
              {t(locale, "energyReconciliation.refresh")}
            </Button>
          </div>

          {loading && <p className="text-sm text-muted-foreground">{t(locale, "common.loading")}</p>}

          {payload && !loading && (
            <>
              <Card className="p-4 space-y-4">
                <h3 className="font-semibold">{t(locale, "energyReconciliation.communityMeter")}</h3>
                <p className="text-sm text-muted-foreground">{t(locale, "energyReconciliation.communityMeterHelp")}</p>

                {!payload.hasCommunityMeter ? (
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <Label>{t(locale, "energy.deviceId")}</Label>
                      <Input value={communityDeviceId} onChange={e => setCommunityDeviceId(e.target.value)} />
                    </div>
                    <Button type="button" size="sm" onClick={addCommunityMeter}>
                      {t(locale, "energyReconciliation.addCommunityMeter")}
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm">
                      {payload.communityMeter?.label}
                      {payload.communityMeter?.external_device_id
                        ? ` (${payload.communityMeter.external_device_id})`
                        : ""}
                    </p>
                    <div className="flex flex-wrap gap-3 items-end">
                      <div>
                        <Label>{t(locale, "energyReconciliation.gridImport")}</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.001}
                          className="w-32"
                          value={readingDraft.import}
                          onChange={e => setReadingDraft(d => ({ ...d, import: e.target.value }))}
                        />
                      </div>
                      <div>
                        <Label>{t(locale, "energyReconciliation.gridExport")}</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.001}
                          className="w-32"
                          value={readingDraft.export}
                          onChange={e => setReadingDraft(d => ({ ...d, export: e.target.value }))}
                        />
                      </div>
                      <Button type="button" size="sm" onClick={saveCommunityReading}>
                        {t(locale, "energy.saveReading")}
                      </Button>
                    </div>
                    {payload.communityReadingMissing && (
                      <p className="text-sm text-amber-600">{t(locale, "energyReconciliation.communityReadingMissing")}</p>
                    )}
                  </div>
                )}
              </Card>

              {payload.reconciliationError && (
                <p className="text-sm text-amber-600">{payload.reconciliationError}</p>
              )}

              {payload.missingMeters.length > 0 && (
                <p className="text-sm text-amber-600">
                  {t(locale, "energyReconciliation.missingReadings")}:{" "}
                  {payload.missingMeters.map(m => m.label).join(", ")}
                </p>
              )}

              {reconciliation && (
                <>
                  <Card className="p-4 space-y-3">
                    <h3 className="font-semibold">{t(locale, "energyReconciliation.summary")}</h3>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">{t(locale, "energy.totalProduction")}</p>
                        <p className="text-lg font-semibold">{reconciliation.totalProductionKwh.toFixed(3)} kWh</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">{t(locale, "energy.totalConsumption")}</p>
                        <p className="text-lg font-semibold">{reconciliation.totalConsumptionKwh.toFixed(3)} kWh</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">{t(locale, "energyReconciliation.gridAtCommunity")}</p>
                        <p className="text-lg font-semibold">{reconciliation.gridImportKwh.toFixed(3)} kWh</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">{t(locale, "energyReconciliation.expectedGrid")}</p>
                        <p className="text-lg font-semibold">{reconciliation.expectedGridImportKwh.toFixed(3)} kWh</p>
                      </div>
                      <div className="rounded-md border p-3">
                        <p className="text-muted-foreground">{t(locale, "energyReconciliation.supplierNetTotal")}</p>
                        <p className="text-lg font-semibold">{reconciliation.totalSupplierNetKwh.toFixed(3)} kWh</p>
                      </div>
                      <div className={`rounded-md border p-3 ${reconciliation.reconciliationOk ? "border-green-500" : "border-amber-500"}`}>
                        <p className="text-muted-foreground">{t(locale, "energyReconciliation.delta")}</p>
                        <p className="text-lg font-semibold">
                          {reconciliation.reconciliationDeltaKwh.toFixed(3)} kWh
                          {" · "}
                          {reconciliation.reconciliationOk
                            ? t(locale, "energyReconciliation.matchOk")
                            : t(locale, "energyReconciliation.matchWarn")}
                        </p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{t(locale, "energyReconciliation.summaryHelp")}</p>
                  </Card>

                  <Card className="p-4 space-y-3 overflow-x-auto">
                    <h3 className="font-semibold">{t(locale, "energyReconciliation.perUnit")}</h3>
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2">{t(locale, "common.unit")}</th>
                          <th className="text-right py-2">{t(locale, "energyReconciliation.meterKwh")}</th>
                          <th className="text-right py-2">{t(locale, "energyReconciliation.fromPanels")}</th>
                          <th className="text-right py-2">{t(locale, "energyReconciliation.fromGrid")}</th>
                          <th className="text-right py-2">{t(locale, "energyReconciliation.supplierBill")}</th>
                          <th className="text-right py-2">{t(locale, "energy.creditEur")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reconciliation.allocations.map(a => (
                          <tr key={a.unitId} className="border-b">
                            <td className="py-2">{unitLabel(a.unitId)}</td>
                            <td className="py-2 text-right">{a.kwhMeterConsumption.toFixed(3)}</td>
                            <td className="py-2 text-right text-green-700">{a.kwhFromSolar.toFixed(3)}</td>
                            <td className="py-2 text-right">{a.kwhFromGrid.toFixed(3)}</td>
                            <td className="py-2 text-right font-medium">{a.kwhSupplierNet.toFixed(3)}</td>
                            <td className="py-2 text-right">€{a.creditAmountEur.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="font-semibold">
                          <td className="py-2">{t(locale, "energyReconciliation.totals")}</td>
                          <td className="py-2 text-right">{reconciliation.totalConsumptionKwh.toFixed(3)}</td>
                          <td className="py-2 text-right">{reconciliation.totalProductionKwh.toFixed(3)}</td>
                          <td className="py-2 text-right">—</td>
                          <td className="py-2 text-right">{reconciliation.totalSupplierNetKwh.toFixed(3)}</td>
                          <td className="py-2 text-right">€{reconciliation.totalCreditEur.toFixed(2)}</td>
                        </tr>
                      </tfoot>
                    </table>
                    <p className="text-xs text-muted-foreground">{t(locale, "energyReconciliation.perUnitHelp")}</p>
                  </Card>

                  <div className="flex flex-wrap gap-3 items-center">
                    <p className="text-sm text-muted-foreground">
                      {t(locale, "energy.unitShares")}: {payload.shareTotalPercent.toFixed(2)}%
                      {" · "}
                      <Link href="/dashboard/manager/energy" className="underline">
                        {t(locale, "energyReconciliation.editShares")}
                      </Link>
                    </p>
                    {!isSettled && (
                      <Button type="button" onClick={runSettlement} disabled={settling}>
                        {settling ? t(locale, "common.loading") : t(locale, "energy.runSettlement")}
                      </Button>
                    )}
                    {isSettled && (
                      <p className="text-sm text-green-600">{t(locale, "energy.periodSettled")}</p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
