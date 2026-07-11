import { NextResponse } from "next/server";
import { requireManagerBuilding } from "@/lib/energy/require-manager-building";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const buildingId = typeof body.building_id === "string" ? body.building_id : "";
    const r = await requireManagerBuilding(buildingId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, buildingId: bid } = r;

    const meterId = typeof body.meter_id === "string" ? body.meter_id : "";
    const m = parseInt(String(body.period_month), 10);
    const y = parseInt(String(body.period_year), 10);
    if (!meterId) return NextResponse.json({ error: "meter_id required" }, { status: 400 });
    if (!m || m < 1 || m > 12 || !y || y < 2000) {
      return NextResponse.json({ error: "Valid period_month and period_year required" }, { status: 400 });
    }

    const { data: meter } = await admin
      .from("energy_meters")
      .select("id, building_id")
      .eq("id", meterId)
      .eq("building_id", bid)
      .maybeSingle();
    if (!meter) return NextResponse.json({ error: "Meter not found" }, { status: 404 });

    const kwhImport = Math.max(0, Number(body.kwh_import ?? 0));
    const kwhExport = Math.max(0, Number(body.kwh_export ?? 0));
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;
    const source = body.source === "import" ? "import" : "manual";

    const row = {
      meter_id: meterId,
      period_month: m,
      period_year: y,
      kwh_import: Math.round(kwhImport * 1000) / 1000,
      kwh_export: Math.round(kwhExport * 1000) / 1000,
      source,
      notes,
      created_by: user.id,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await admin
      .from("energy_readings")
      .upsert(row, { onConflict: "meter_id,period_month,period_year" })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ reading: saved });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
