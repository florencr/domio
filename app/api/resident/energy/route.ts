import { NextResponse } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSessionUserInRoute } from "@/lib/supabase/get-session-user-in-route";
import { activeResidentUnitIds } from "@/lib/energy/resident-units";
import { anySiteEnergyAddonEnabled } from "@/lib/energy/site-addon";
import { loadSettlementInputs, previewSettlement } from "@/lib/energy/run-settlement";

export type ResidentEnergyWalletEntry = {
  period_month: number;
  period_year: number;
  kwh_meter_total: number;
  kwh_from_solar: number;
  kwh_from_grid: number;
  credit_earned_eur: number;
  credit_applied_eur: number;
  wallet_balance_eur: number;
};

export type ResidentEnergyUnitRow = {
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
  kwh_from_solar: number | null;
  kwh_from_grid: number | null;
  kwh_supplier_net: number | null;
  kwh_allocated: number | null;
  credit_amount_eur: number | null;
  credit_status: "none" | "pending" | "applied";
  wallet_balance_eur: number;
  wallet_history: ResidentEnergyWalletEntry[];
  building_total_production_kwh: number | null;
  building_total_consumption_kwh: number | null;
  building_surplus_kwh: number | null;
  building_grid_import_kwh: number | null;
};

export async function GET(request: Request) {
  try {
    const user = await getSessionUserInRoute();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const m = parseInt(searchParams.get("month") ?? "", 10);
    const y = parseInt(searchParams.get("year") ?? "", 10);
    const filterUnitId = searchParams.get("unit_id") ?? searchParams.get("unit") ?? "";

    const now = new Date();
    const periodMonth = m >= 1 && m <= 12 ? m : now.getMonth() + 1;
    const periodYear = y >= 2000 ? y : now.getFullYear();

    const admin = createServiceRoleClient();
    let unitIds = await activeResidentUnitIds(admin, user.id);
    if (!unitIds.length) return NextResponse.json({ units: [], period_month: periodMonth, period_year: periodYear });

    const { data: unitRowsForSites } = await admin.from("units").select("building_id").in("id", unitIds);
    const buildingIdsForGate = [...new Set((unitRowsForSites ?? []).map((u: { building_id: string }) => u.building_id))];
    const { data: buildingsForGate } = buildingIdsForGate.length
      ? await admin.from("buildings").select("site_id").in("id", buildingIdsForGate)
      : { data: [] };
    const residentSiteIds = [...new Set(
      (buildingsForGate ?? []).map((b: { site_id: string | null }) => b.site_id).filter(Boolean)
    )] as string[];
    const addonOn = await anySiteEnergyAddonEnabled(admin, residentSiteIds);
    if (!addonOn) {
      return NextResponse.json({ error: "Energy module is not enabled for your site" }, { status: 403 });
    }

    if (filterUnitId) {
      if (!unitIds.includes(filterUnitId)) {
        return NextResponse.json({ error: "Unit not accessible" }, { status: 403 });
      }
      unitIds = [filterUnitId];
    }

    const { data: unitRows, error: uErr } = await admin
      .from("units")
      .select("id, unit_name, building_id")
      .in("id", unitIds)
      .order("unit_name");
    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 500 });

    const buildingIds = [...new Set((unitRows ?? []).map((u: { building_id: string }) => u.building_id))];
    const { data: buildingRows } = await admin.from("buildings").select("id, name").in("id", buildingIds);
    const buildingNameById = new Map(
      (buildingRows ?? []).map((b: { id: string; name: string }) => [b.id, b.name])
    );

    const { data: installations } = await admin
      .from("energy_installations")
      .select("building_id, status")
      .in("building_id", buildingIds);
    const energyBuildingIds = new Set(
      (installations ?? []).map((i: { building_id: string }) => i.building_id)
    );

    const { data: shareRows } = await admin
      .from("energy_unit_shares")
      .select("unit_id, share_percent, building_id")
      .in("unit_id", unitIds);
    const shareByUnit = new Map(
      (shareRows ?? []).map((s: { unit_id: string; share_percent: number }) => [
        s.unit_id,
        Number(s.share_percent),
      ])
    );

    const { data: meters } = await admin
      .from("energy_meters")
      .select("id, unit_id, building_id, meter_role")
      .in("building_id", buildingIds);
    const consumptionMeterByUnit = new Map<string, string>();
    for (const meter of meters ?? []) {
      const row = meter as { id: string; unit_id: string | null; meter_role: string };
      if (row.meter_role === "consumption" && row.unit_id) {
        consumptionMeterByUnit.set(row.unit_id, row.id);
      }
    }

    const meterIds = [...consumptionMeterByUnit.values()];
    const readingByMeter = new Map<string, { kwh_import: number; kwh_export: number }>();
    if (meterIds.length) {
      const { data: readings } = await admin
        .from("energy_readings")
        .select("meter_id, kwh_import, kwh_export")
        .in("meter_id", meterIds)
        .eq("period_month", periodMonth)
        .eq("period_year", periodYear);
      for (const r of readings ?? []) {
        const row = r as { meter_id: string; kwh_import: number; kwh_export: number };
        readingByMeter.set(row.meter_id, {
          kwh_import: Number(row.kwh_import),
          kwh_export: Number(row.kwh_export),
        });
      }
    }

    const { data: periods } = await admin
      .from("energy_periods")
      .select("id, building_id, total_production_kwh, total_consumption_kwh, surplus_kwh, grid_import_kwh, status, grid_tariff_eur_per_kwh")
      .in("building_id", buildingIds)
      .eq("period_month", periodMonth)
      .eq("period_year", periodYear)
      .eq("status", "settled");

    const periodByBuilding = new Map(
      (periods ?? []).map((p: {
        id: string;
        building_id: string;
        total_production_kwh: number | null;
        total_consumption_kwh: number | null;
        surplus_kwh: number | null;
        grid_import_kwh: number | null;
      }) => [p.building_id, p])
    );

    const periodIds = (periods ?? []).map((p: { id: string }) => p.id);
    const allocationByUnit = new Map<
      string,
      {
        kwh_from_solar: number | null;
        kwh_from_grid: number | null;
        kwh_supplier_net: number | null;
        kwh_allocated: number;
        credit_amount_eur: number;
        applied_bill_id: string | null;
      }
    >();
    if (periodIds.length) {
      const { data: allocations } = await admin
        .from("energy_allocations")
        .select("unit_id, kwh_from_solar, kwh_from_grid, kwh_supplier_net, kwh_allocated, credit_amount_eur, applied_bill_id")
        .in("period_id", periodIds)
        .in("unit_id", unitIds);
      for (const a of allocations ?? []) {
        const row = a as {
          unit_id: string;
          kwh_from_solar: number | null;
          kwh_from_grid: number | null;
          kwh_supplier_net: number | null;
          kwh_allocated: number;
          credit_amount_eur: number;
          applied_bill_id: string | null;
        };
        allocationByUnit.set(row.unit_id, {
          kwh_from_solar: row.kwh_from_solar != null ? Number(row.kwh_from_solar) : null,
          kwh_from_grid: row.kwh_from_grid != null ? Number(row.kwh_from_grid) : null,
          kwh_supplier_net: row.kwh_supplier_net != null ? Number(row.kwh_supplier_net) : null,
          kwh_allocated: Number(row.kwh_allocated),
          credit_amount_eur: Number(row.credit_amount_eur),
          applied_bill_id: row.applied_bill_id,
        });
      }
    }

    const previewByUnit = new Map<string, {
      kwh_from_solar: number;
      kwh_from_grid: number;
      kwh_supplier_net: number;
      kwh_allocated: number;
      credit_amount_eur: number;
    }>();
    for (const buildingId of buildingIds) {
      if (periodByBuilding.has(buildingId)) continue;
      const loaded = await loadSettlementInputs(admin, buildingId, periodMonth, periodYear);
      if (!loaded.ok) continue;
      const tariff = 0.15;
      try {
        const preview = previewSettlement(loaded.readings, loaded.shares, tariff);
        for (const a of preview.allocations) {
          if (unitIds.includes(a.unitId)) {
            previewByUnit.set(a.unitId, {
              kwh_from_solar: a.kwhFromSolar,
              kwh_from_grid: a.kwhFromGrid,
              kwh_supplier_net: a.kwhSupplierNet,
              kwh_allocated: a.kwhAllocated,
              credit_amount_eur: a.creditAmountEur,
            });
          }
        }
      } catch {
        /* preview optional */
      }
    }

    const { data: walletRows } = await admin
      .from("energy_wallet_ledger")
      .select("unit_id, period_month, period_year, kwh_meter_total, kwh_from_solar, kwh_from_grid, credit_earned_eur, credit_applied_eur, wallet_balance_eur")
      .in("unit_id", unitIds)
      .order("period_year", { ascending: false })
      .order("period_month", { ascending: false });

    const walletHistoryByUnit = new Map<string, ResidentEnergyWalletEntry[]>();
    const walletBalanceByUnit = new Map<string, number>();
    for (const w of walletRows ?? []) {
      const row = w as {
        unit_id: string;
        period_month: number;
        period_year: number;
        kwh_meter_total: number;
        kwh_from_solar: number;
        kwh_from_grid: number;
        credit_earned_eur: number;
        credit_applied_eur: number;
        wallet_balance_eur: number;
      };
      if (!walletHistoryByUnit.has(row.unit_id)) {
        walletHistoryByUnit.set(row.unit_id, []);
        walletBalanceByUnit.set(row.unit_id, Number(row.wallet_balance_eur));
      }
      const list = walletHistoryByUnit.get(row.unit_id)!;
      if (list.length < 12) {
        list.push({
          period_month: row.period_month,
          period_year: row.period_year,
          kwh_meter_total: Number(row.kwh_meter_total),
          kwh_from_solar: Number(row.kwh_from_solar),
          kwh_from_grid: Number(row.kwh_from_grid),
          credit_earned_eur: Number(row.credit_earned_eur),
          credit_applied_eur: Number(row.credit_applied_eur),
          wallet_balance_eur: Number(row.wallet_balance_eur),
        });
      }
    }

    const units: ResidentEnergyUnitRow[] = (unitRows ?? []).map((u: {
      id: string;
      unit_name: string;
      building_id: string;
    }) => {
      const hasEnergy = energyBuildingIds.has(u.building_id);
      const meterId = consumptionMeterByUnit.get(u.id);
      const reading = meterId ? readingByMeter.get(meterId) : undefined;
      const allocation = allocationByUnit.get(u.id);
      const preview = previewByUnit.get(u.id);
      const buildingPeriod = periodByBuilding.get(u.building_id) as {
        total_production_kwh: number | null;
        total_consumption_kwh: number | null;
        surplus_kwh: number | null;
        grid_import_kwh: number | null;
      } | undefined;

      const kwhFromSolar = allocation?.kwh_from_solar ?? preview?.kwh_from_solar ?? null;
      const kwhFromGrid = allocation?.kwh_from_grid ?? preview?.kwh_from_grid ?? null;
      const kwhSupplierNet = allocation?.kwh_supplier_net ?? preview?.kwh_supplier_net ?? null;
      const kwhAllocated = allocation?.kwh_allocated ?? preview?.kwh_allocated ?? null;
      const creditAmountEur = allocation?.credit_amount_eur ?? preview?.credit_amount_eur ?? null;

      let credit_status: ResidentEnergyUnitRow["credit_status"] = "none";
      if (allocation && allocation.credit_amount_eur > 0) {
        credit_status = allocation.applied_bill_id ? "applied" : "pending";
      } else if (preview && preview.credit_amount_eur > 0) {
        credit_status = "pending";
      }

      return {
        unit_id: u.id,
        unit_name: u.unit_name,
        building_id: u.building_id,
        building_name: buildingNameById.get(u.building_id) ?? "—",
        share_percent: shareByUnit.get(u.id) ?? null,
        has_energy: hasEnergy,
        period_month: periodMonth,
        period_year: periodYear,
        kwh_import: reading?.kwh_import ?? null,
        kwh_export: reading?.kwh_export ?? null,
        kwh_from_solar: kwhFromSolar,
        kwh_from_grid: kwhFromGrid,
        kwh_supplier_net: kwhSupplierNet,
        kwh_allocated: kwhAllocated,
        credit_amount_eur: creditAmountEur,
        credit_status,
        wallet_balance_eur: walletBalanceByUnit.get(u.id) ?? 0,
        wallet_history: walletHistoryByUnit.get(u.id) ?? [],
        building_total_production_kwh: buildingPeriod?.total_production_kwh != null
          ? Number(buildingPeriod.total_production_kwh)
          : null,
        building_total_consumption_kwh: buildingPeriod?.total_consumption_kwh != null
          ? Number(buildingPeriod.total_consumption_kwh)
          : null,
        building_surplus_kwh: buildingPeriod?.surplus_kwh != null
          ? Number(buildingPeriod.surplus_kwh)
          : null,
        building_grid_import_kwh: buildingPeriod?.grid_import_kwh != null
          ? Number(buildingPeriod.grid_import_kwh)
          : null,
      };
    });

    return NextResponse.json({
      units,
      period_month: periodMonth,
      period_year: periodYear,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
