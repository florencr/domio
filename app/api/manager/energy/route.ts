import { NextResponse } from "next/server";
import { requireManagerBuilding } from "@/lib/energy/require-manager-building";
import { loadSettlementInputs, previewSettlement } from "@/lib/energy/run-settlement";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("building_id") ?? "";
    const r = await requireManagerBuilding(buildingId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, buildingId: bid } = r;

    const { data: installation } = await admin
      .from("energy_installations")
      .select("*")
      .eq("building_id", bid)
      .maybeSingle();

    const installationId = (installation as { id?: string } | null)?.id;
    let meters: unknown[] = [];
    if (installationId) {
      const { data: meterRows, error: mErr } = await admin
        .from("energy_meters")
        .select("id,building_id,installation_id,unit_id,meter_role,label,external_device_id,api_provider,last_sync_at,created_at")
        .eq("building_id", bid)
        .order("meter_role", { ascending: true })
        .order("label", { ascending: true });
      if (mErr) return NextResponse.json({ error: mErr.message }, { status: 500 });
      meters = meterRows ?? [];
    }

    const { data: shares, error: sErr } = await admin
      .from("energy_unit_shares")
      .select("id,building_id,unit_id,share_percent")
      .eq("building_id", bid);
    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 500 });

    const { data: units } = await admin
      .from("units")
      .select("id, unit_name, type, building_id")
      .eq("building_id", bid)
      .order("unit_name");

    const month = searchParams.get("month");
    const year = searchParams.get("year");
    let readings: unknown[] = [];
    let period: unknown = null;
    let allocations: unknown[] = [];
    let settlementPreview: unknown = null;

    if (installationId && month && year) {
      const m = parseInt(month, 10);
      const y = parseInt(year, 10);
      if (m >= 1 && m <= 12 && y >= 2000) {
        const meterIds = (meters as { id: string }[]).map(x => x.id);
        if (meterIds.length) {
          const { data: readingRows, error: rErr } = await admin
            .from("energy_readings")
            .select("id,meter_id,period_month,period_year,kwh_import,kwh_export,source,notes,created_at")
            .in("meter_id", meterIds)
            .eq("period_month", m)
            .eq("period_year", y);
          if (rErr) return NextResponse.json({ error: rErr.message }, { status: 500 });
          readings = readingRows ?? [];
        }

        const { data: periodRow } = await admin
          .from("energy_periods")
          .select("*")
          .eq("building_id", bid)
          .eq("period_month", m)
          .eq("period_year", y)
          .maybeSingle();
        period = periodRow ?? null;

        if (periodRow) {
          const { data: allocRows, error: aErr } = await admin
            .from("energy_allocations")
            .select("id,period_id,unit_id,share_percent,kwh_allocated,credit_amount_eur,applied_bill_id,created_at")
            .eq("period_id", (periodRow as { id: string }).id)
            .order("unit_id");
          if (aErr) return NextResponse.json({ error: aErr.message }, { status: 500 });
          allocations = allocRows ?? [];
        }

        const tariffParam = searchParams.get("grid_tariff");
        const tariff = tariffParam != null ? Number(tariffParam) : NaN;
        if (Number.isFinite(tariff) && tariff > 0 && (periodRow as { status?: string } | null)?.status !== "settled") {
          const loaded = await loadSettlementInputs(admin, bid, m, y);
          if (loaded.ok) {
            try {
              settlementPreview = previewSettlement(loaded.readings, loaded.shares, tariff);
            } catch {
              settlementPreview = null;
            }
          }
        }
      }
    }

    const shareTotal = (shares ?? []).reduce(
      (sum: number, row: { share_percent: number }) => sum + Number(row.share_percent),
      0
    );

    return NextResponse.json({
      installation: installation ?? null,
      meters,
      shares: shares ?? [],
      shareTotalPercent: Math.round(shareTotal * 100) / 100,
      units: units ?? [],
      readings,
      period,
      allocations,
      settlementPreview,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
