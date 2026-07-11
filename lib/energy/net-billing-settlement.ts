/**
 * Net Billing / virtual sharing settlement: solar split by custom unit %, reconciled with community meter.
 */

import {
  computeVirtualSharingSettlement,
  type VirtualSharingReading,
} from "@/lib/energy/virtual-sharing-settlement";

export type SettlementReading = {
  meterId: string;
  meterRole: "production" | "consumption" | "community";
  unitId: string | null;
  kwhImport: number;
  kwhExport: number;
};

export type SettlementShare = {
  unitId: string;
  sharePercent: number;
};

export type SettlementAllocation = {
  unitId: string;
  sharePercent: number;
  kwhMeterConsumption: number;
  kwhFromSolar: number;
  kwhFromGrid: number;
  kwhSupplierNet: number;
  kwhAllocated: number;
  creditAmountEur: number;
};

export type NetBillingSettlement = {
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
  allocations: SettlementAllocation[];
  totalCreditEur: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Solar production for the period: prefer kWh export on the production meter. */
export function productionKwhFromReading(reading: SettlementReading | VirtualSharingReading): number {
  if (reading.meterRole !== "production") return 0;
  if (reading.kwhExport > 0) return reading.kwhExport;
  return reading.kwhImport;
}

/**
 * Virtual sharing: total solar × custom % per unit; grid per unit = meter − solar share.
 * Reconciles community meter import/export with expected building net.
 */
export function computeNetBillingSettlement(
  readings: SettlementReading[],
  shares: SettlementShare[],
  gridTariffEurPerKwh: number
): NetBillingSettlement {
  return computeVirtualSharingSettlement(readings, shares, gridTariffEurPerKwh);
}

export function validateSharesTotal(shares: SettlementShare[]): void {
  if (!shares.length) throw new Error("Unit shares are not configured");
  const total = round2(shares.reduce((sum, s) => sum + Number(s.sharePercent), 0));
  if (total !== 100) {
    throw new Error(`Unit shares must total 100% (currently ${total}%)`);
  }
}
