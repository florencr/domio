import type { SupabaseClient } from "@supabase/supabase-js";
import {
  computeNetBillingSettlement,
  productionKwhFromReading,
  validateSharesTotal,
  type NetBillingSettlement,
  type SettlementReading,
  type SettlementShare,
} from "@/lib/energy/net-billing-settlement";

type MeterRow = {
  id: string;
  meter_role: "production" | "consumption" | "community";
  unit_id: string | null;
  label: string;
};

type ReadingRow = {
  meter_id: string;
  kwh_import: number;
  kwh_export: number;
};

type ShareRow = {
  unit_id: string;
  share_percent: number;
};

export type SettlementLoadResult =
  | {
      ok: true;
      readings: SettlementReading[];
      shares: SettlementShare[];
      meters: MeterRow[];
      missingMeterIds: string[];
      hasCommunityMeter: boolean;
      communityReadingMissing: boolean;
    }
  | { ok: false; error: string };

export async function loadSettlementInputs(
  admin: SupabaseClient,
  buildingId: string,
  periodMonth: number,
  periodYear: number,
  options?: { requireCommunityMeter?: boolean }
): Promise<SettlementLoadResult> {
  const { data: installation } = await admin
    .from("energy_installations")
    .select("id")
    .eq("building_id", buildingId)
    .maybeSingle();
  if (!installation) return { ok: false, error: "Create a solar installation first" };

  const { data: meters, error: mErr } = await admin
    .from("energy_meters")
    .select("id,meter_role,unit_id,label")
    .eq("building_id", buildingId);
  if (mErr) return { ok: false, error: mErr.message };
  if (!meters?.length) return { ok: false, error: "Add smart meters first" };

  const meterList = meters as MeterRow[];
  const production = meterList.filter(m => m.meter_role === "production");
  if (!production.length) return { ok: false, error: "Production meter is missing" };

  const communityMeters = meterList.filter(m => m.meter_role === "community");
  const hasCommunityMeter = communityMeters.length > 0;

  const meterIds = meterList.map(m => m.id);
  const { data: readingRows, error: rErr } = await admin
    .from("energy_readings")
    .select("meter_id,kwh_import,kwh_export")
    .in("meter_id", meterIds)
    .eq("period_month", periodMonth)
    .eq("period_year", periodYear);
  if (rErr) return { ok: false, error: rErr.message };

  const byMeter = new Map<string, ReadingRow>();
  for (const row of readingRows ?? []) {
    byMeter.set((row as ReadingRow).meter_id, row as ReadingRow);
  }

  const missingMeterIds: string[] = [];
  const readings: SettlementReading[] = [];

  for (const m of meterList) {
    const row = byMeter.get(m.id);
    if (!row) {
      missingMeterIds.push(m.id);
      continue;
    }
    readings.push({
      meterId: m.id,
      meterRole: m.meter_role,
      unitId: m.unit_id,
      kwhImport: Number(row.kwh_import),
      kwhExport: Number(row.kwh_export),
    });
  }

  const communityReadingMissing =
    hasCommunityMeter && communityMeters.some(m => missingMeterIds.includes(m.id));

  if (options?.requireCommunityMeter && !hasCommunityMeter) {
    return { ok: false, error: "Community meter (building ↔ grid) is missing" };
  }

  const { data: shareRows, error: sErr } = await admin
    .from("energy_unit_shares")
    .select("unit_id,share_percent")
    .eq("building_id", buildingId);
  if (sErr) return { ok: false, error: sErr.message };

  const shares: SettlementShare[] = (shareRows ?? []).map((s: ShareRow) => ({
    unitId: s.unit_id,
    sharePercent: Number(s.share_percent),
  }));

  try {
    validateSharesTotal(shares);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid shares" };
  }

  const requiredMissing = missingMeterIds.filter(id => {
    const m = meterList.find(x => x.id === id);
    return m?.meter_role !== "community";
  });

  if (requiredMissing.length) {
    const labels = meterList
      .filter(m => requiredMissing.includes(m.id))
      .map(m => m.label)
      .join(", ");
    return { ok: false, error: `Missing readings for meters: ${labels}` };
  }

  return {
    ok: true,
    readings,
    shares,
    meters: meterList,
    missingMeterIds,
    hasCommunityMeter,
    communityReadingMissing,
  };
}

export function previewSettlement(
  readings: SettlementReading[],
  shares: SettlementShare[],
  gridTariffEurPerKwh: number
): NetBillingSettlement {
  validateSharesTotal(shares);
  return computeNetBillingSettlement(readings, shares, gridTariffEurPerKwh);
}

export type PersistSettlementResult = {
  periodId: string;
  settlement: NetBillingSettlement;
};

async function loadWalletBalance(
  admin: SupabaseClient,
  buildingId: string,
  unitId: string
): Promise<number> {
  const { data } = await admin
    .from("energy_wallet_ledger")
    .select("wallet_balance_eur")
    .eq("building_id", buildingId)
    .eq("unit_id", unitId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? Number((data as { wallet_balance_eur: number }).wallet_balance_eur) : 0;
}

export async function persistSettlement(
  admin: SupabaseClient,
  buildingId: string,
  periodMonth: number,
  periodYear: number,
  gridTariffEurPerKwh: number,
  settlement: NetBillingSettlement
): Promise<PersistSettlementResult> {
  const { data: existing } = await admin
    .from("energy_periods")
    .select("id,status")
    .eq("building_id", buildingId)
    .eq("period_month", periodMonth)
    .eq("period_year", periodYear)
    .maybeSingle();

  if (existing && (existing as { status: string }).status === "settled") {
    const { data: applied } = await admin
      .from("energy_allocations")
      .select("id")
      .eq("period_id", (existing as { id: string }).id)
      .not("applied_bill_id", "is", null)
      .limit(1);
    if (applied?.length) {
      throw new Error("This period is already settled and credits were applied to bills");
    }
    throw new Error("This period is already settled");
  }

  const now = new Date().toISOString();
  const periodPayload = {
    building_id: buildingId,
    period_month: periodMonth,
    period_year: periodYear,
    status: "settled" as const,
    grid_tariff_eur_per_kwh: settlement.gridTariffEurPerKwh,
    total_production_kwh: settlement.totalProductionKwh,
    total_consumption_kwh: settlement.totalConsumptionKwh,
    surplus_kwh: settlement.surplusKwh,
    grid_import_kwh: settlement.gridImportKwh,
    grid_export_kwh: settlement.gridExportKwh,
    expected_grid_import_kwh: settlement.expectedGridImportKwh,
    expected_grid_export_kwh: settlement.expectedGridExportKwh,
    reconciliation_delta_kwh: settlement.reconciliationDeltaKwh,
    reconciliation_ok: settlement.reconciliationOk,
    closed_at: now,
    settled_at: now,
    updated_at: now,
  };

  let periodId: string;

  if (existing) {
    periodId = (existing as { id: string }).id;
    const { error: upErr } = await admin.from("energy_periods").update(periodPayload).eq("id", periodId);
    if (upErr) throw new Error(upErr.message);
    const { error: delErr } = await admin.from("energy_allocations").delete().eq("period_id", periodId);
    if (delErr) throw new Error(delErr.message);
    const { error: delWalletErr } = await admin
      .from("energy_wallet_ledger")
      .delete()
      .eq("period_id", periodId);
    if (delWalletErr) throw new Error(delWalletErr.message);
  } else {
    const { data: inserted, error: insErr } = await admin
      .from("energy_periods")
      .insert(periodPayload)
      .select("id")
      .single();
    if (insErr || !inserted) throw new Error(insErr?.message ?? "Failed to create energy period");
    periodId = (inserted as { id: string }).id;
  }

  const allocationRows = settlement.allocations.map(a => ({
    period_id: periodId,
    unit_id: a.unitId,
    share_percent: a.sharePercent,
    kwh_meter_consumption: a.kwhMeterConsumption,
    kwh_from_solar: a.kwhFromSolar,
    kwh_from_grid: a.kwhFromGrid,
    kwh_supplier_net: a.kwhSupplierNet,
    kwh_allocated: a.kwhAllocated,
    credit_amount_eur: a.creditAmountEur,
    applied_bill_id: null,
  }));

  const { error: allocErr } = await admin.from("energy_allocations").insert(allocationRows);
  if (allocErr) throw new Error(allocErr.message);

  const walletRows = [];
  for (const a of settlement.allocations) {
    const prevBalance = await loadWalletBalance(admin, buildingId, a.unitId);
    const earned = a.creditAmountEur;
    const balanceAfter = Math.round((prevBalance + earned) * 100) / 100;
    walletRows.push({
      building_id: buildingId,
      unit_id: a.unitId,
      period_id: periodId,
      period_month: periodMonth,
      period_year: periodYear,
      kwh_meter_total: a.kwhMeterConsumption,
      kwh_from_solar: a.kwhFromSolar,
      kwh_from_grid: a.kwhFromGrid,
      credit_earned_eur: earned,
      credit_applied_eur: 0,
      wallet_balance_eur: balanceAfter,
      applied_bill_id: null,
    });
  }

  if (walletRows.length) {
    const { error: walletErr } = await admin.from("energy_wallet_ledger").insert(walletRows);
    if (walletErr) throw new Error(walletErr.message);
  }

  return { periodId, settlement };
}

export { productionKwhFromReading };
