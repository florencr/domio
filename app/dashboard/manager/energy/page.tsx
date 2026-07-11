"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useManagerData } from "../context";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import type {
  EnergyAllocation,
  EnergyInstallation,
  EnergyMeter,
  EnergyPeriod,
  EnergyReading,
  EnergyUnitShare,
  Unit,
} from "@/types/database";

type NetBillingSettlement = {
  totalProductionKwh: number;
  totalConsumptionKwh: number;
  surplusKwh: number;
  gridTariffEurPerKwh: number;
  allocations: {
    unitId: string;
    sharePercent: number;
    kwhAllocated: number;
    creditAmountEur: number;
  }[];
  totalCreditEur: number;
};

type EnergyPayload = {
  installation: EnergyInstallation | null;
  meters: EnergyMeter[];
  shares: EnergyUnitShare[];
  shareTotalPercent: number;
  units: Unit[];
  readings: EnergyReading[];
  period: EnergyPeriod | null;
  allocations: EnergyAllocation[];
  settlementPreview: NetBillingSettlement | null;
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

export default function ManagerEnergyPage() {
  const { data } = useManagerData();
  const { locale } = useLocale();
  const now = new Date();

  const [buildingId, setBuildingId] = useState("");
  const [energy, setEnergy] = useState<EnergyPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });

  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());

  const [installForm, setInstallForm] = useState({
    name: "Shared solar",
    capacity_kw: "",
    status: "pending" as "pending" | "active" | "inactive",
    inverter_api_provider: "",
    inverter_external_id: "",
    production_meter_id: "",
    notes: "",
  });

  const [shareDraft, setShareDraft] = useState<Record<string, string>>({});
  const [readingDraft, setReadingDraft] = useState<Record<string, { import: string; export: string }>>({});
  const [csvText, setCsvText] = useState("");
  const [newMeterUnitId, setNewMeterUnitId] = useState("");
  const [newMeterLabel, setNewMeterLabel] = useState("");
  const [newMeterDeviceId, setNewMeterDeviceId] = useState("");
  const [gridTariff, setGridTariff] = useState("");
  const [settling, setSettling] = useState(false);
  const [preview, setPreview] = useState<NetBillingSettlement | null>(null);

  useEffect(() => {
    if (!buildingId && data.buildings.length) setBuildingId(data.buildings[0].id);
  }, [data.buildings, buildingId]);

  const loadEnergy = useCallback(async () => {
    if (!buildingId) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/manager/energy?building_id=${encodeURIComponent(buildingId)}&month=${periodMonth}&year=${periodYear}`
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
        return;
      }
      setEnergy(json as EnergyPayload);
      const draft: Record<string, string> = {};
      for (const s of json.shares ?? []) {
        draft[s.unit_id] = String(s.share_percent);
      }
      for (const u of json.units ?? []) {
        if (draft[u.id] == null) draft[u.id] = "";
      }
      setShareDraft(draft);

      const rDraft: Record<string, { import: string; export: string }> = {};
      for (const m of json.meters ?? []) {
        const found = (json.readings ?? []).find((r: EnergyReading) => r.meter_id === m.id);
        rDraft[m.id] = {
          import: found ? String(found.kwh_import) : "",
          export: found ? String(found.kwh_export) : "",
        };
      }
      setReadingDraft(rDraft);

      if (json.installation) {
        const inst = json.installation as EnergyInstallation;
        const prod = (json.meters ?? []).find((m: EnergyMeter) => m.meter_role === "production");
        setInstallForm({
          name: inst.name,
          capacity_kw: inst.capacity_kw != null ? String(inst.capacity_kw) : "",
          status: inst.status,
          inverter_api_provider: inst.inverter_api_provider ?? "",
          inverter_external_id: inst.inverter_external_id ?? "",
          production_meter_id: prod?.external_device_id ?? "",
          notes: inst.notes ?? "",
        });
      }

      if (json.period?.grid_tariff_eur_per_kwh != null && !gridTariff.trim()) {
        setGridTariff(String(json.period.grid_tariff_eur_per_kwh));
      }
      setPreview(null);
    } finally {
      setLoading(false);
    }
  }, [buildingId, periodMonth, periodYear, locale]);

  useEffect(() => {
    loadEnergy();
  }, [loadEnergy]);

  const buildingUnits = useMemo(
    () => (energy?.units ?? []).filter(u => u.building_id === buildingId),
    [energy?.units, buildingId]
  );

  const productionMeter = useMemo(
    () => (energy?.meters ?? []).find(m => m.meter_role === "production"),
    [energy?.meters]
  );

  const consumptionMeters = useMemo(
    () => (energy?.meters ?? []).filter(m => m.meter_role === "consumption"),
    [energy?.meters]
  );

  const unitsWithoutMeter = useMemo(() => {
    const withMeter = new Set(consumptionMeters.map(m => m.unit_id).filter(Boolean));
    return buildingUnits.filter(u => !withMeter.has(u.id));
  }, [buildingUnits, consumptionMeters]);

  const shareTotal = useMemo(() => {
    return Object.values(shareDraft).reduce((sum, v) => sum + (parseFloat(v) || 0), 0);
  }, [shareDraft]);

  async function createInstallation(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/manager/energy/installation", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ building_id: buildingId, ...installForm }),
    });
    const json = await res.json();
    if (!res.ok) setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
    else {
      setMsg({ text: t(locale, "energy.installationCreated"), ok: true });
      loadEnergy();
    }
  }

  async function saveInstallation(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/manager/energy/installation", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        building_id: buildingId,
        name: installForm.name,
        capacity_kw: installForm.capacity_kw,
        status: installForm.status,
        inverter_api_provider: installForm.inverter_api_provider,
        inverter_external_id: installForm.inverter_external_id,
        notes: installForm.notes,
      }),
    });
    const json = await res.json();
    if (!res.ok) setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
    else {
      if (productionMeter && installForm.production_meter_id !== (productionMeter.external_device_id ?? "")) {
        await fetch("/api/manager/energy/meters", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            building_id: buildingId,
            meter_id: productionMeter.id,
            external_device_id: installForm.production_meter_id,
          }),
        });
      }
      setMsg({ text: t(locale, "energy.installationSaved"), ok: true });
      loadEnergy();
    }
  }

  async function addConsumptionMeter(e: React.FormEvent) {
    e.preventDefault();
    if (!newMeterUnitId) return;
    const res = await fetch("/api/manager/energy/meters", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        building_id: buildingId,
        unit_id: newMeterUnitId,
        label: newMeterLabel,
        external_device_id: newMeterDeviceId,
      }),
    });
    const json = await res.json();
    if (!res.ok) setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
    else {
      setMsg({ text: t(locale, "energy.meterAdded"), ok: true });
      setNewMeterUnitId("");
      setNewMeterLabel("");
      setNewMeterDeviceId("");
      loadEnergy();
    }
  }

  async function saveShares(e: React.FormEvent) {
    e.preventDefault();
    if (Math.round(shareTotal * 100) / 100 !== 100) {
      setMsg({ text: t(locale, "energy.sharesMustTotal100"), ok: false });
      return;
    }
    const shares = buildingUnits.map(u => ({
      unit_id: u.id,
      share_percent: parseFloat(shareDraft[u.id] || "0"),
    }));
    const res = await fetch("/api/manager/energy/shares", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ building_id: buildingId, shares }),
    });
    const json = await res.json();
    if (!res.ok) setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
    else {
      setMsg({ text: t(locale, "energy.sharesSaved"), ok: true });
      loadEnergy();
    }
  }

  async function saveReading(meterId: string) {
    const draft = readingDraft[meterId];
    if (!draft) return;
    const res = await fetch("/api/manager/energy/readings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        building_id: buildingId,
        meter_id: meterId,
        period_month: periodMonth,
        period_year: periodYear,
        kwh_import: draft.import || 0,
        kwh_export: draft.export || 0,
      }),
    });
    const json = await res.json();
    if (!res.ok) setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
    else {
      setMsg({ text: t(locale, "energy.readingSaved"), ok: true });
      loadEnergy();
    }
  }

  async function importCsv(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/manager/energy/readings/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ building_id: buildingId, csv: csvText }),
    });
    const json = await res.json();
    if (!res.ok) setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
    else {
      let text = t(locale, "energy.importDone", { count: String(json.imported ?? 0) });
      if (json.skipped?.length) {
        text += " " + t(locale, "energy.importSkipped", { ids: json.skipped.join(", ") });
      }
      setMsg({ text, ok: true });
      setCsvText("");
      loadEnergy();
    }
  }

  const isSettled = energy?.period?.status === "settled";

  const displayAllocations = useMemo(() => {
    if (isSettled && energy?.allocations?.length) {
      return energy.allocations.map(a => ({
        unitId: a.unit_id,
        sharePercent: Number(a.share_percent),
        kwhAllocated: Number(a.kwh_allocated),
        creditAmountEur: Number(a.credit_amount_eur),
        appliedBillId: a.applied_bill_id,
      }));
    }
    if (preview) return preview.allocations.map(a => ({ ...a, appliedBillId: null }));
    return [];
  }, [isSettled, energy?.allocations, preview]);

  async function callSettle(dryRun: boolean) {
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
          dry_run: dryRun,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ text: json.error ?? t(locale, "common.failed"), ok: false });
        return;
      }
      if (dryRun) {
        setPreview(json.settlement as NetBillingSettlement);
        setMsg({ text: t(locale, "energy.previewReady"), ok: true });
      } else {
        setPreview(null);
        setMsg({ text: t(locale, "energy.settlementDone"), ok: true });
        loadEnergy();
      }
    } finally {
      setSettling(false);
    }
  }

  function unitLabel(unitId: string) {
    const u = buildingUnits.find(x => x.id === unitId);
    return u ? `${u.unit_name} (${u.type})` : unitId.slice(0, 8);
  }

  return (
    <div className="space-y-6">
      {!data.site?.energy_addon_enabled ? (
        <p className="text-sm text-muted-foreground">{t(locale, "energy.addonDisabled")}</p>
      ) : (
        <>
      <div>
        <h2 className="text-lg font-semibold">{t(locale, "energy.title")}</h2>
        <p className="text-sm text-muted-foreground">{t(locale, "energy.subtitle")}</p>
      </div>

      {msg.text && (
        <p className={`text-sm ${msg.ok ? "text-green-600" : "text-red-500"}`}>{msg.text}</p>
      )}

      {!data.buildings.length ? (
        <p className="text-sm text-muted-foreground">{t(locale, "energy.noBuildings")}</p>
      ) : (
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
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">{t(locale, "common.loading")}</p>}

      {buildingId && !loading && (
        <>
          <Card className="p-4 space-y-4">
            <h3 className="font-semibold">{t(locale, "energy.installation")}</h3>
            {!energy?.installation ? (
              <form onSubmit={createInstallation} className="grid md:grid-cols-2 gap-3">
                <p className="md:col-span-2 text-sm text-muted-foreground">{t(locale, "energy.noInstallation")}</p>
                <div>
                  <Label>{t(locale, "energy.installationName")}</Label>
                  <Input value={installForm.name} onChange={e => setInstallForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>{t(locale, "energy.capacityKw")}</Label>
                  <Input value={installForm.capacity_kw} onChange={e => setInstallForm(f => ({ ...f, capacity_kw: e.target.value }))} />
                </div>
                <div>
                  <Label>{t(locale, "energy.productionMeterId")}</Label>
                  <Input value={installForm.production_meter_id} onChange={e => setInstallForm(f => ({ ...f, production_meter_id: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit">{t(locale, "energy.createInstallation")}</Button>
                </div>
              </form>
            ) : (
              <form onSubmit={saveInstallation} className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>{t(locale, "energy.installationName")}</Label>
                  <Input value={installForm.name} onChange={e => setInstallForm(f => ({ ...f, name: e.target.value }))} />
                </div>
                <div>
                  <Label>{t(locale, "energy.capacityKw")}</Label>
                  <Input value={installForm.capacity_kw} onChange={e => setInstallForm(f => ({ ...f, capacity_kw: e.target.value }))} />
                </div>
                <div>
                  <Label>{t(locale, "energy.status")}</Label>
                  <select
                    className="border rounded-md h-9 px-2 text-sm w-full bg-background"
                    value={installForm.status}
                    onChange={e => setInstallForm(f => ({ ...f, status: e.target.value as typeof f.status }))}
                  >
                    <option value="pending">{t(locale, "energy.statusPending")}</option>
                    <option value="active">{t(locale, "energy.statusActive")}</option>
                    <option value="inactive">{t(locale, "energy.statusInactive")}</option>
                  </select>
                </div>
                <div>
                  <Label>{t(locale, "energy.inverterProvider")}</Label>
                  <Input value={installForm.inverter_api_provider} onChange={e => setInstallForm(f => ({ ...f, inverter_api_provider: e.target.value }))} />
                </div>
                <div>
                  <Label>{t(locale, "energy.inverterId")}</Label>
                  <Input value={installForm.inverter_external_id} onChange={e => setInstallForm(f => ({ ...f, inverter_external_id: e.target.value }))} />
                </div>
                <div>
                  <Label>{t(locale, "energy.productionMeterId")}</Label>
                  <Input value={installForm.production_meter_id} onChange={e => setInstallForm(f => ({ ...f, production_meter_id: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Label>{t(locale, "energy.notes")}</Label>
                  <Input value={installForm.notes} onChange={e => setInstallForm(f => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <Button type="submit">{t(locale, "energy.saveInstallation")}</Button>
                </div>
              </form>
            )}
          </Card>

          {energy?.installation && (
            <>
              <Card className="p-4 space-y-4">
                <h3 className="font-semibold">{t(locale, "energy.meters")}</h3>
                {productionMeter && (
                  <p className="text-sm">
                    <span className="font-medium">{t(locale, "energy.productionMeter")}:</span>{" "}
                    {productionMeter.label}
                    {productionMeter.external_device_id ? ` (${productionMeter.external_device_id})` : ""}
                  </p>
                )}

                <p className="text-sm font-medium">{t(locale, "energy.consumptionMeters")}</p>
                {consumptionMeters.length === 0 && (
                  <p className="text-sm text-muted-foreground">—</p>
                )}
                <ul className="text-sm space-y-1">
                  {consumptionMeters.map(m => (
                    <li key={m.id}>
                      {unitLabel(m.unit_id!)} — {m.label}
                      {m.external_device_id ? ` (${m.external_device_id})` : ""}
                    </li>
                  ))}
                </ul>

                {unitsWithoutMeter.length > 0 && (
                  <form onSubmit={addConsumptionMeter} className="flex flex-wrap gap-3 items-end border-t pt-4">
                    <div>
                      <Label>{t(locale, "common.unit")}</Label>
                      <select
                        className="border rounded-md h-9 px-2 text-sm bg-background"
                        value={newMeterUnitId}
                        onChange={e => setNewMeterUnitId(e.target.value)}
                        required
                      >
                        <option value="">{t(locale, "common.selectPlaceholder")}</option>
                        {unitsWithoutMeter.map(u => (
                          <option key={u.id} value={u.id}>{u.unit_name} ({u.type})</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>{t(locale, "energy.meterLabel")}</Label>
                      <Input value={newMeterLabel} onChange={e => setNewMeterLabel(e.target.value)} placeholder={t(locale, "energy.meterLabel")} />
                    </div>
                    <div>
                      <Label>{t(locale, "energy.deviceId")}</Label>
                      <Input value={newMeterDeviceId} onChange={e => setNewMeterDeviceId(e.target.value)} />
                    </div>
                    <Button type="submit" size="sm">{t(locale, "energy.addConsumptionMeter")}</Button>
                  </form>
                )}
              </Card>

              <Card className="p-4 space-y-4">
                <h3 className="font-semibold">{t(locale, "energy.unitShares")}</h3>
                <p className="text-sm text-muted-foreground">{t(locale, "energy.unitSharesHelp")}</p>
                <form onSubmit={saveShares} className="space-y-3">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">{t(locale, "common.unit")}</th>
                        <th className="text-left py-2 w-32">{t(locale, "energy.sharePercent")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {buildingUnits.map(u => (
                        <tr key={u.id} className="border-b">
                          <td className="py-2">{u.unit_name} ({u.type})</td>
                          <td className="py-2">
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              step={0.01}
                              className="w-24"
                              value={shareDraft[u.id] ?? ""}
                              onChange={e => setShareDraft(d => ({ ...d, [u.id]: e.target.value }))}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className={`text-sm ${Math.round(shareTotal * 100) / 100 === 100 ? "text-green-600" : "text-amber-600"}`}>
                    {t(locale, "energy.shareTotal")}: {shareTotal.toFixed(2)}%
                  </p>
                  <Button type="submit" size="sm">{t(locale, "energy.saveShares")}</Button>
                </form>
              </Card>

              <Card className="p-4 space-y-4">
                <h3 className="font-semibold">{t(locale, "energy.readings")}</h3>
                {!energy.meters.length ? (
                  <p className="text-sm text-muted-foreground">{t(locale, "energy.noMetersForReadings")}</p>
                ) : (
                  <div className="space-y-3">
                    {energy.meters.map(m => (
                      <div key={m.id} className="flex flex-wrap gap-3 items-end border-b pb-3">
                        <p className="w-full text-sm font-medium">
                          {m.meter_role === "production"
                            ? t(locale, "energy.productionMeter")
                            : unitLabel(m.unit_id!)}
                        </p>
                        <div>
                          <Label>{t(locale, "energy.kwhImport")}</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.001}
                            className="w-28"
                            value={readingDraft[m.id]?.import ?? ""}
                            onChange={e =>
                              setReadingDraft(d => ({
                                ...d,
                                [m.id]: { import: e.target.value, export: d[m.id]?.export ?? "" },
                              }))
                            }
                          />
                        </div>
                        <div>
                          <Label>{t(locale, "energy.kwhExport")}</Label>
                          <Input
                            type="number"
                            min={0}
                            step={0.001}
                            className="w-28"
                            value={readingDraft[m.id]?.export ?? ""}
                            onChange={e =>
                              setReadingDraft(d => ({
                                ...d,
                                [m.id]: { import: d[m.id]?.import ?? "", export: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <Button type="button" size="sm" onClick={() => saveReading(m.id)}>
                          {t(locale, "energy.saveReading")}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={importCsv} className="space-y-2 border-t pt-4">
                  <p className="text-sm font-medium">{t(locale, "energy.importCsv")}</p>
                  <p className="text-xs text-muted-foreground">{t(locale, "energy.csvHelp")}</p>
                  <textarea
                    className="w-full min-h-[100px] border rounded-md p-2 text-sm bg-background"
                    value={csvText}
                    onChange={e => setCsvText(e.target.value)}
                    placeholder={t(locale, "energy.csvPlaceholder")}
                  />
                  <Button type="submit" size="sm" variant="outline">{t(locale, "energy.importButton")}</Button>
                </form>
              </Card>

              <Card className="p-4 space-y-4">
                <h3 className="font-semibold">{t(locale, "energy.settlement")}</h3>
                <p className="text-sm text-muted-foreground">{t(locale, "energy.settlementHelp")}</p>

                {isSettled && energy.period && (
                  <div className="text-sm space-y-1 rounded-md bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 p-3">
                    <p className="font-medium text-green-800 dark:text-green-200">{t(locale, "energy.periodSettled")}</p>
                    <p>{t(locale, "energy.totalProduction")}: {Number(energy.period.total_production_kwh ?? 0).toFixed(3)} kWh</p>
                    <p>{t(locale, "energy.totalConsumption")}: {Number(energy.period.total_consumption_kwh ?? 0).toFixed(3)} kWh</p>
                    <p>{t(locale, "energy.surplusKwh")}: {Number(energy.period.surplus_kwh ?? 0).toFixed(3)} kWh</p>
                    <p>{t(locale, "energy.gridTariff")}: €{Number(energy.period.grid_tariff_eur_per_kwh ?? 0).toFixed(6)} / kWh</p>
                  </div>
                )}

                {!isSettled && (
                  <div className="flex flex-wrap gap-3 items-end">
                    <div>
                      <Label>{t(locale, "energy.gridTariff")}</Label>
                      <Input
                        type="number"
                        min={0}
                        step={0.000001}
                        className="w-36"
                        value={gridTariff}
                        onChange={e => setGridTariff(e.target.value)}
                        placeholder="0.18"
                      />
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={settling}
                      onClick={() => callSettle(true)}
                    >
                      {t(locale, "energy.previewSettlement")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      disabled={settling}
                      onClick={() => callSettle(false)}
                    >
                      {t(locale, "energy.runSettlement")}
                    </Button>
                  </div>
                )}

                {preview && !isSettled && (
                  <div className="text-sm space-y-1 text-muted-foreground border-t pt-3">
                    <p>{t(locale, "energy.totalProduction")}: {preview.totalProductionKwh.toFixed(3)} kWh</p>
                    <p>{t(locale, "energy.totalConsumption")}: {preview.totalConsumptionKwh.toFixed(3)} kWh</p>
                    <p>{t(locale, "energy.surplusKwh")}: {preview.surplusKwh.toFixed(3)} kWh</p>
                  </div>
                )}

                {displayAllocations.length > 0 && (
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="text-left py-2">{t(locale, "common.unit")}</th>
                        <th className="text-left py-2">{t(locale, "energy.sharePercent")}</th>
                        <th className="text-left py-2">{t(locale, "energy.kwhAllocated")}</th>
                        <th className="text-left py-2">{t(locale, "energy.creditEur")}</th>
                        {isSettled && <th className="text-left py-2">{t(locale, "energy.billStatus")}</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {displayAllocations.map(a => (
                        <tr key={a.unitId} className="border-b">
                          <td className="py-2">{unitLabel(a.unitId)}</td>
                          <td className="py-2">{a.sharePercent.toFixed(2)}%</td>
                          <td className="py-2">{a.kwhAllocated.toFixed(3)}</td>
                          <td className="py-2 text-green-600">€{a.creditAmountEur.toFixed(2)}</td>
                          {isSettled && (
                            <td className="py-2 text-muted-foreground">
                              {a.appliedBillId
                                ? t(locale, "energy.creditApplied")
                                : t(locale, "energy.creditPending")}
                            </td>
                          )}
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="font-medium">
                        <td colSpan={3} className="py-2 text-right">{t(locale, "energy.totalCredit")}</td>
                        <td className="py-2 text-green-600">
                          €{(isSettled
                            ? displayAllocations.reduce((s, a) => s + a.creditAmountEur, 0)
                            : preview?.totalCreditEur ?? 0
                          ).toFixed(2)}
                        </td>
                        {isSettled && <td />}
                      </tr>
                    </tfoot>
                  </table>
                )}
              </Card>
            </>
          )}
        </>
      )}
        </>
      )}
    </div>
  );
}
