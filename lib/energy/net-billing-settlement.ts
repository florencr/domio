/**
 * Net Billing settlement: building surplus kWh split by custom unit %, converted to € credit.
 */

export type SettlementReading = {
  meterId: string;
  meterRole: "production" | "consumption";
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
  kwhAllocated: number;
  creditAmountEur: number;
};

export type NetBillingSettlement = {
  totalProductionKwh: number;
  totalConsumptionKwh: number;
  surplusKwh: number;
  gridTariffEurPerKwh: number;
  allocations: SettlementAllocation[];
  totalCreditEur: number;
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Solar production for the period: prefer kWh export on the production meter. */
export function productionKwhFromReading(reading: SettlementReading): number {
  if (reading.meterRole !== "production") return 0;
  if (reading.kwhExport > 0) return reading.kwhExport;
  return reading.kwhImport;
}

/**
 * Net Billing surplus: solar produced minus building self-consumption (never negative).
 * Each unit receives surplus × (custom share % / 100) as kWh, then × grid tariff as € credit.
 */
export function computeNetBillingSettlement(
  readings: SettlementReading[],
  shares: SettlementShare[],
  gridTariffEurPerKwh: number
): NetBillingSettlement {
  const tariff = Number(gridTariffEurPerKwh);
  if (!Number.isFinite(tariff) || tariff <= 0) {
    throw new Error("grid_tariff_eur_per_kwh must be a positive number");
  }

  const totalProductionKwh = round3(
    readings
      .filter(r => r.meterRole === "production")
      .reduce((sum, r) => sum + productionKwhFromReading(r), 0)
  );

  const totalConsumptionKwh = round3(
    readings
      .filter(r => r.meterRole === "consumption")
      .reduce((sum, r) => sum + Math.max(0, r.kwhImport), 0)
  );

  const surplusKwh = round3(Math.max(0, totalProductionKwh - totalConsumptionKwh));

  const allocations: SettlementAllocation[] = shares.map(s => {
    const pct = Number(s.sharePercent);
    const kwhAllocated = round3(surplusKwh * (pct / 100));
    const creditAmountEur = round2(kwhAllocated * tariff);
    return {
      unitId: s.unitId,
      sharePercent: pct,
      kwhAllocated,
      creditAmountEur,
    };
  });

  const totalCreditEur = round2(allocations.reduce((sum, a) => sum + a.creditAmountEur, 0));

  return {
    totalProductionKwh,
    totalConsumptionKwh,
    surplusKwh,
    gridTariffEurPerKwh: tariff,
    allocations,
    totalCreditEur,
  };
}

export function validateSharesTotal(shares: SettlementShare[]): void {
  if (!shares.length) throw new Error("Unit shares are not configured");
  const total = round2(shares.reduce((sum, s) => sum + Number(s.sharePercent), 0));
  if (total !== 100) {
    throw new Error(`Unit shares must total 100% (currently ${total}%)`);
  }
}
