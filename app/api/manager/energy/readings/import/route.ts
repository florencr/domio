import { NextResponse } from "next/server";
import { requireManagerBuilding } from "@/lib/energy/require-manager-building";

type CsvRow = {
  external_device_id: string;
  period_month: number;
  period_year: number;
  kwh_import: number;
  kwh_export: number;
};

function parseCsv(text: string): CsvRow[] {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);
  if (lines.length < 2) return [];

  const header = lines[0].split(",").map(h => h.trim().toLowerCase());
  const idx = (name: string) => header.indexOf(name);
  const required = ["external_device_id", "period_month", "period_year", "kwh_import", "kwh_export"];
  for (const col of required) {
    if (idx(col) < 0) throw new Error(`CSV missing column: ${col}`);
  }

  const rows: CsvRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(",").map(p => p.trim());
    const external_device_id = parts[idx("external_device_id")];
    const period_month = parseInt(parts[idx("period_month")], 10);
    const period_year = parseInt(parts[idx("period_year")], 10);
    const kwh_import = parseFloat(parts[idx("kwh_import")]) || 0;
    const kwh_export = parseFloat(parts[idx("kwh_export")]) || 0;
    if (!external_device_id || !period_month || !period_year) continue;
    rows.push({ external_device_id, period_month, period_year, kwh_import, kwh_export });
  }
  return rows;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const buildingId = typeof body.building_id === "string" ? body.building_id : "";
    const r = await requireManagerBuilding(buildingId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, buildingId: bid } = r;

    const csv = typeof body.csv === "string" ? body.csv : "";
    if (!csv.trim()) return NextResponse.json({ error: "csv text required" }, { status: 400 });

    let parsed: CsvRow[];
    try {
      parsed = parseCsv(csv);
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Invalid CSV" },
        { status: 400 }
      );
    }
    if (!parsed.length) return NextResponse.json({ error: "No data rows in CSV" }, { status: 400 });

    const { data: meters } = await admin
      .from("energy_meters")
      .select("id, external_device_id")
      .eq("building_id", bid);
    const byExternal = new Map<string, string>();
    for (const m of meters ?? []) {
      const ext = (m as { external_device_id: string | null }).external_device_id;
      if (ext) byExternal.set(ext, (m as { id: string }).id);
    }

    const upserts: Record<string, unknown>[] = [];
    const skipped: string[] = [];

    for (const row of parsed) {
      const meterId = byExternal.get(row.external_device_id);
      if (!meterId) {
        skipped.push(row.external_device_id);
        continue;
      }
      upserts.push({
        meter_id: meterId,
        period_month: row.period_month,
        period_year: row.period_year,
        kwh_import: Math.round(Math.max(0, row.kwh_import) * 1000) / 1000,
        kwh_export: Math.round(Math.max(0, row.kwh_export) * 1000) / 1000,
        source: "import",
        created_by: user.id,
        updated_at: new Date().toISOString(),
      });
    }

    if (!upserts.length) {
      return NextResponse.json(
        { error: "No rows matched meter external_device_id values", skipped },
        { status: 400 }
      );
    }

    const { data: saved, error } = await admin
      .from("energy_readings")
      .upsert(upserts, { onConflict: "meter_id,period_month,period_year" })
      .select("id,meter_id,period_month,period_year,kwh_import,kwh_export");

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({
      imported: (saved ?? []).length,
      skipped: [...new Set(skipped)],
      readings: saved ?? [],
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
