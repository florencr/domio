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

    const m = parseInt(searchParams.get("month") ?? "", 10);
    const y = parseInt(searchParams.get("year") ?? "", 10);
    const tariffParam = searchParams.get("grid_tariff");
    const tariff = tariffParam != null ? Number(tariffParam) : NaN;

    if (!m || m < 1 || m > 12 || !y || y < 2000) {
      return NextResponse.json({ error: "Valid month and year required" }, { status: 400 });
    }

    const { data: installation } = await admin
      .from("energy_installations")
      .select("*")
      .eq("building_id", bid)
      .maybeSingle();
    if (!installation) {
      return NextResponse.json({ error: "Create a solar installation first" }, { status: 400 });
    }

    const { data: meters } = await admin
      .from("energy_meters")
      .select("id,building_id,installation_id,unit_id,meter_role,label,external_device_id")
      .eq("building_id", bid)
      .order("meter_role", { ascending: true })
      .order("label", { ascending: true });

    const { data: shares } = await admin
      .from("energy_unit_shares")
      .select("id,building_id,unit_id,share_percent")
      .eq("building_id", bid);

    const { data: units } = await admin
      .from("units")
      .select("id, unit_name, type, building_id")
      .eq("building_id", bid)
      .order("unit_name");

    const meterIds = (meters ?? []).map((x: { id: string }) => x.id);
    let readings: unknown[] = [];
    if (meterIds.length) {
      const { data: readingRows } = await admin
        .from("energy_readings")
        .select("id,meter_id,period_month,period_year,kwh_import,kwh_export,source")
        .in("meter_id", meterIds)
        .eq("period_month", m)
        .eq("period_year", y);
      readings = readingRows ?? [];
    }

    const { data: period } = await admin
      .from("energy_periods")
      .select("*")
      .eq("building_id", bid)
      .eq("period_month", m)
      .eq("period_year", y)
      .maybeSingle();

    const shareTotal = (shares ?? []).reduce(
      (sum: number, row: { share_percent: number }) => sum + Number(row.share_percent),
      0
    );

    const communityMeter = (meters ?? []).find((x: { meter_role: string }) => x.meter_role === "community") ?? null;

    let reconciliation: unknown = null;
    let reconciliationError: string | null = null;

    const loaded = await loadSettlementInputs(admin, bid, m, y);
    if (loaded.ok) {
      if (Number.isFinite(tariff) && tariff > 0) {
        try {
          reconciliation = previewSettlement(loaded.readings, loaded.shares, tariff);
        } catch (e) {
          reconciliationError = e instanceof Error ? e.message : "Reconciliation failed";
        }
      } else {
        try {
          reconciliation = previewSettlement(loaded.readings, loaded.shares, 0.15);
        } catch {
          reconciliation = null;
        }
      }
    } else {
      reconciliationError = loaded.error;
    }

    return NextResponse.json({
      installation,
      meters: meters ?? [],
      shares: shares ?? [],
      shareTotalPercent: Math.round(shareTotal * 100) / 100,
      units: units ?? [],
      readings,
      period: period ?? null,
      communityMeter,
      hasCommunityMeter: Boolean(communityMeter),
      communityReadingMissing: loaded.ok ? loaded.communityReadingMissing : false,
      reconciliation,
      reconciliationError,
      missingMeters: loaded.ok
        ? loaded.meters
            .filter(m => loaded.missingMeterIds.includes(m.id))
            .map(m => ({ id: m.id, label: m.label, meter_role: m.meter_role }))
        : [],
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
