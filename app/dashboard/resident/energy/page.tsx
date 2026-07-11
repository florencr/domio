"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useOwnerData } from "../context";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";

type ResidentEnergyUnitRow = {
  unit_id: string;
  unit_name: string;
  building_id: string;
  building_name: string;
  share_percent: number | null;
  has_energy: boolean;
  period_month: number;
  period_year: number;
  kwh_import: number | null;
  kwh_export: number | null;
  kwh_allocated: number | null;
  credit_amount_eur: number | null;
  credit_status: "none" | "pending" | "applied";
  building_total_production_kwh: number | null;
  building_total_consumption_kwh: number | null;
  building_surplus_kwh: number | null;
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

export default function ResidentEnergyPage() {
  const { data } = useOwnerData();
  const { locale } = useLocale();
  const searchParams = useSearchParams();
  const unitFromUrl = searchParams.get("unit") ?? "";

  const now = new Date();
  const [periodMonth, setPeriodMonth] = useState(now.getMonth() + 1);
  const [periodYear, setPeriodYear] = useState(now.getFullYear());
  const [rows, setRows] = useState<ResidentEnergyUnitRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setMsg("");
    try {
      const unitQ = unitFromUrl ? `&unit_id=${encodeURIComponent(unitFromUrl)}` : "";
      const res = await fetch(
        `/api/resident/energy?month=${periodMonth}&year=${periodYear}${unitQ}`
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg(json.error ?? t(locale, "common.failed"));
        setRows([]);
        return;
      }
      setRows(json.units ?? []);
    } finally {
      setLoading(false);
    }
  }, [periodMonth, periodYear, unitFromUrl, locale]);

  useEffect(() => {
    load();
  }, [load]);

  const energyUnits = rows.filter(r => r.has_energy);
  const noEnergy = !loading && energyUnits.length === 0;

  function creditStatusLabel(status: ResidentEnergyUnitRow["credit_status"]) {
    if (status === "applied") return t(locale, "energyResident.creditApplied");
    if (status === "pending") return t(locale, "energyResident.creditPending");
    return t(locale, "energyResident.creditNone");
  }

  return (
    <div className="space-y-6">
      {!data.energyAddonEnabled ? (
        <p className="text-sm text-muted-foreground">{t(locale, "energy.addonDisabled")}</p>
      ) : (
        <>
      <div>
        <h2 className="text-lg font-semibold">{t(locale, "energyResident.title")}</h2>
        <p className="text-sm text-muted-foreground">{t(locale, "energyResident.subtitle")}</p>
      </div>

      <div className="flex flex-wrap gap-3 items-end">
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

      {loading && <p className="text-sm text-muted-foreground">{t(locale, "common.loading")}</p>}
      {msg && <p className="text-sm text-red-500">{msg}</p>}

      {noEnergy && (
        <p className="text-sm text-muted-foreground">{t(locale, "energyResident.noEnergy")}</p>
      )}

      {energyUnits.map(row => (
        <Card key={row.unit_id} className="p-4 space-y-3">
          <div>
            <p className="font-semibold">{row.unit_name}</p>
            <p className="text-sm text-muted-foreground">
              {row.building_name}
              {row.share_percent != null ? ` · ${t(locale, "energyResident.yourShare", { pct: row.share_percent.toFixed(2) })}` : ""}
            </p>
          </div>

          {row.building_surplus_kwh != null && (
            <div className="text-sm rounded-md bg-muted/50 p-3 space-y-1">
              <p className="font-medium">{t(locale, "energyResident.buildingSummary")}</p>
              <p>{t(locale, "energy.totalProduction")}: {row.building_total_production_kwh?.toFixed(3) ?? "—"} kWh</p>
              <p>{t(locale, "energy.totalConsumption")}: {row.building_total_consumption_kwh?.toFixed(3) ?? "—"} kWh</p>
              <p>{t(locale, "energy.surplusKwh")}: {row.building_surplus_kwh.toFixed(3)} kWh</p>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-medium mb-1">{t(locale, "energyResident.myUsage")}</p>
              <p>{t(locale, "energy.kwhImport")}: {row.kwh_import != null ? row.kwh_import.toFixed(3) : "—"}</p>
              <p>{t(locale, "energy.kwhExport")}: {row.kwh_export != null ? row.kwh_export.toFixed(3) : "—"}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="font-medium mb-1">{t(locale, "energyResident.myCredit")}</p>
              <p>{t(locale, "energy.kwhAllocated")}: {row.kwh_allocated != null ? row.kwh_allocated.toFixed(3) : "—"}</p>
              <p className="text-green-600 font-semibold">
                {t(locale, "energy.creditEur")}: {row.credit_amount_eur != null ? `€${row.credit_amount_eur.toFixed(2)}` : "—"}
              </p>
              <p className="text-muted-foreground">{creditStatusLabel(row.credit_status)}</p>
            </div>
          </div>
        </Card>
      ))}

      {!loading && energyUnits.length > 1 && (
        <p className="text-xs text-muted-foreground">
          {t(locale, "energyResident.multiUnitNote", { count: String(data.units.length) })}
        </p>
      )}
        </>
      )}
    </div>
  );
}
