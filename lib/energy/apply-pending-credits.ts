import type { SupabaseClient } from "@supabase/supabase-js";

const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Bill month M/Y receives credits from energy settlement of the previous calendar month. */
export function previousCalendarPeriod(
  billMonth: number,
  billYear: number
): { month: number; year: number } {
  if (billMonth === 1) return { month: 12, year: billYear - 1 };
  return { month: billMonth - 1, year: billYear };
}

export type PendingEnergyCredit = {
  allocationId: string;
  unitId: string;
  creditAmountEur: number;
  kwhAllocated: number;
  settlementMonth: number;
  settlementYear: number;
};

export function energyCreditBillLineDescription(credit: PendingEnergyCredit): string {
  const monthLabel = MONTH_LABELS[credit.settlementMonth - 1] ?? String(credit.settlementMonth);
  return `Energy credit (Net Billing) – ${monthLabel} ${credit.settlementYear} (${credit.kwhAllocated.toFixed(3)} kWh)`;
}

/** Negative bill line amount for a stored € credit. */
export function energyCreditLineAmount(creditAmountEur: number): number {
  const n = Math.round(Number(creditAmountEur) * 100) / 100;
  if (n <= 0) return 0;
  return -n;
}

/**
 * Pending allocations from the prior month's settled energy period, keyed by unit_id.
 * Applied when generating bills for the following month (Net Billing).
 */
export async function loadPendingEnergyCreditsForBillMonth(
  admin: SupabaseClient,
  unitIds: string[],
  billMonth: number,
  billYear: number
): Promise<Map<string, PendingEnergyCredit>> {
  const result = new Map<string, PendingEnergyCredit>();
  if (!unitIds.length) return result;

  const { month: settlementMonth, year: settlementYear } = previousCalendarPeriod(billMonth, billYear);

  const { data: periods, error: pErr } = await admin
    .from("energy_periods")
    .select("id")
    .eq("period_month", settlementMonth)
    .eq("period_year", settlementYear)
    .eq("status", "settled");
  if (pErr || !periods?.length) return result;

  const periodIds = (periods as { id: string }[]).map(p => p.id);

  const { data: rows, error } = await admin
    .from("energy_allocations")
    .select("id, unit_id, credit_amount_eur, kwh_allocated")
    .in("period_id", periodIds)
    .in("unit_id", unitIds)
    .is("applied_bill_id", null);
  if (error || !rows?.length) return result;

  for (const row of rows) {
    const r = row as {
      id: string;
      unit_id: string;
      credit_amount_eur: number;
      kwh_allocated: number;
    };
    const creditAmountEur = Number(r.credit_amount_eur);
    if (creditAmountEur <= 0) continue;
    result.set(r.unit_id, {
      allocationId: r.id,
      unitId: r.unit_id,
      creditAmountEur,
      kwhAllocated: Number(r.kwh_allocated),
      settlementMonth,
      settlementYear,
    });
  }

  return result;
}

export async function markEnergyCreditApplied(
  admin: SupabaseClient,
  allocationId: string,
  billId: string
): Promise<void> {
  const { error } = await admin
    .from("energy_allocations")
    .update({ applied_bill_id: billId })
    .eq("id", allocationId)
    .is("applied_bill_id", null);
  if (error) throw new Error(error.message);
}
