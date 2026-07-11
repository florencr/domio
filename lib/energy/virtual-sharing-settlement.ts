/**
 * Virtual energy sharing: split total solar by custom % per unit.
 * Reconcile community meter (grid) vs sum of per-unit net grid consumption.
 */

import { productionKwhFromReading, validateSharesTotal, type SettlementShare } from "@/lib/energy/net-billing-settlement";

export type VirtualSharingReading = {
  meterId: string;
  meterRole: "production" | "consumption" | "community";
  unitId: string | null;
  kwhImport: number;
  kwhExport: number;
};

export type VirtualSharingAllocation = {
  unitId: string;
  sharePercent: number;
  kwhMeterConsumption: number;
  kwhFromSolar: number;
  kwhFromGrid: number;
  kwhSupplierNet: number;
  kwhAllocated: number;
  creditAmountEur: number;
};

export type VirtualSharingSettlement = {
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
  allocations: VirtualSharingAllocation[];
  totalCreditEur: number;
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

const RECONCILIATION_TOLERANCE_KWH = 0.5;

export function computeVirtualSharingSettlement(
  readings: VirtualSharingReading[],
  shares: SettlementShare[],
  gridTariffEurPerKwh: number
): VirtualSharingSettlement {
  const tariff = Number(gridTariffEurPerKwh);
  if (!Number.isFinite(tariff) || tariff <= 0) {
    throw new Error("grid_tariff_eur_per_kwh must be a positive number");
  }

  validateSharesTotal(shares);

  const totalProductionKwh = round3(
    readings
      .filter(r => r.meterRole === "production")
      .reduce((sum, r) => sum + productionKwhFromReading(r), 0)
  );

  const consumptionByUnit = new Map<string, number>();
  for (const r of readings.filter(x => x.meterRole === "consumption" && x.unitId)) {
    consumptionByUnit.set(r.unitId!, round3(Math.max(0, r.kwhImport)));
  }

  const totalConsumptionKwh = round3(
    [...consumptionByUnit.values()].reduce((sum, v) => sum + v, 0)
  );

  const communityReadings = readings.filter(r => r.meterRole === "community");
  const gridImportKwh = round3(
    communityReadings.reduce((sum, r) => sum + Math.max(0, r.kwhImport), 0)
  );
  const gridExportKwh = round3(
    communityReadings.reduce((sum, r) => sum + Math.max(0, r.kwhExport), 0)
  );

  const netBuildingDemand = round3(totalConsumptionKwh - totalProductionKwh);
  const expectedGridImportKwh = round3(Math.max(0, netBuildingDemand));
  const expectedGridExportKwh = round3(Math.max(0, -netBuildingDemand));
  const surplusKwh = expectedGridExportKwh;

  const allocations: VirtualSharingAllocation[] = shares.map(s => {
    const pct = Number(s.sharePercent);
    const kwhMeterConsumption = consumptionByUnit.get(s.unitId) ?? 0;
    const kwhFromSolar = round3(totalProductionKwh * (pct / 100));
    const kwhFromGrid = round3(kwhMeterConsumption - kwhFromSolar);
    const kwhSupplierNet = round3(Math.max(0, kwhFromGrid));
    const kwhAllocated = kwhFromSolar;
    const creditAmountEur = round2(kwhFromSolar * tariff);

    return {
      unitId: s.unitId,
      sharePercent: pct,
      kwhMeterConsumption,
      kwhFromSolar,
      kwhFromGrid,
      kwhSupplierNet,
      kwhAllocated,
      creditAmountEur,
    };
  });

  const totalSupplierNetKwh = round3(
    allocations.reduce((sum, a) => sum + a.kwhSupplierNet, 0)
  );

  let reconciliationDeltaKwh = 0;
  let reconciliationOk = true;

  if (communityReadings.length > 0) {
    if (expectedGridImportKwh >= expectedGridExportKwh) {
      reconciliationDeltaKwh = round3(gridImportKwh - expectedGridImportKwh);
      reconciliationOk = Math.abs(reconciliationDeltaKwh) <= RECONCILIATION_TOLERANCE_KWH;
    } else {
      reconciliationDeltaKwh = round3(gridExportKwh - expectedGridExportKwh);
      reconciliationOk = Math.abs(reconciliationDeltaKwh) <= RECONCILIATION_TOLERANCE_KWH;
    }
  }

  const totalCreditEur = round2(allocations.reduce((sum, a) => sum + a.creditAmountEur, 0));

  return {
    totalProductionKwh,
    totalConsumptionKwh,
    gridImportKwh,
    gridExportKwh,
    expectedGridImportKwh,
    expectedGridExportKwh,
    totalSupplierNetKwh,
    reconciliationDeltaKwh,
    reconciliationOk,
    surplusKwh,
    gridTariffEurPerKwh: tariff,
    allocations,
    totalCreditEur,
  };
}
