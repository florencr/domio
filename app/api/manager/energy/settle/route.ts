import { NextResponse } from "next/server";
import { requireManagerBuilding } from "@/lib/energy/require-manager-building";
import { loadSettlementInputs, persistSettlement, previewSettlement } from "@/lib/energy/run-settlement";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const buildingId = typeof body.building_id === "string" ? body.building_id : "";
    const r = await requireManagerBuilding(buildingId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, siteId, buildingId: bid } = r;

    const m = parseInt(String(body.period_month), 10);
    const y = parseInt(String(body.period_year), 10);
    const tariff = Number(body.grid_tariff_eur_per_kwh);
    const dryRun = body.dry_run === true;

    if (!m || m < 1 || m > 12 || !y || y < 2000) {
      return NextResponse.json({ error: "Valid period_month and period_year required" }, { status: 400 });
    }
    if (!Number.isFinite(tariff) || tariff <= 0) {
      return NextResponse.json({ error: "grid_tariff_eur_per_kwh must be a positive number" }, { status: 400 });
    }

    const loaded = await loadSettlementInputs(admin, bid, m, y);
    if (!loaded.ok) return NextResponse.json({ error: loaded.error }, { status: 400 });

    const settlement = previewSettlement(loaded.readings, loaded.shares, tariff);

    if (dryRun) {
      return NextResponse.json({ preview: true, settlement });
    }

    const { periodId } = await persistSettlement(admin, bid, m, y, tariff, settlement);

    await logAudit({
      user_id: user.id,
      user_email: user.email ?? undefined,
      action: "create",
      entity_type: "energy_settlement",
      entity_id: periodId,
      entity_label: `${m}/${y} – ${bid}`,
      site_id: siteId,
      new_values: {
        period_month: m,
        period_year: y,
        surplus_kwh: settlement.surplusKwh,
        total_credit_eur: settlement.totalCreditEur,
        allocations: settlement.allocations.length,
      },
    });

    return NextResponse.json({
      success: true,
      periodId,
      settlement,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Unknown error" },
      { status: 500 }
    );
  }
}
