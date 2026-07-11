import { NextResponse } from "next/server";
import { requireManagerBuilding } from "@/lib/energy/require-manager-building";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const buildingId = typeof body.building_id === "string" ? body.building_id : "";
    const r = await requireManagerBuilding(buildingId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, buildingId: bid } = r;

    const unitId = typeof body.unit_id === "string" ? body.unit_id : "";
    if (!unitId) return NextResponse.json({ error: "unit_id required" }, { status: 400 });

    const { data: unit } = await admin.from("units").select("id, building_id").eq("id", unitId).maybeSingle();
    if (!unit || (unit as { building_id: string }).building_id !== bid) {
      return NextResponse.json({ error: "Unit not in this building" }, { status: 400 });
    }

    const { data: installation } = await admin
      .from("energy_installations")
      .select("id")
      .eq("building_id", bid)
      .maybeSingle();
    if (!installation) {
      return NextResponse.json({ error: "Create installation first" }, { status: 400 });
    }

    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim()
        : `Consumption – ${unitId.slice(0, 8)}`;
    const externalDeviceId =
      typeof body.external_device_id === "string" ? body.external_device_id.trim() || null : null;
    const apiProvider = typeof body.api_provider === "string" ? body.api_provider.trim() || null : null;

    const { data: row, error } = await admin
      .from("energy_meters")
      .insert({
        building_id: bid,
        installation_id: (installation as { id: string }).id,
        unit_id: unitId,
        meter_role: "consumption",
        label,
        external_device_id: externalDeviceId,
        api_provider: apiProvider,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ meter: row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const buildingId = typeof body.building_id === "string" ? body.building_id : "";
    const meterId = typeof body.meter_id === "string" ? body.meter_id : "";
    const r = await requireManagerBuilding(buildingId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;

    if (!meterId) return NextResponse.json({ error: "meter_id required" }, { status: 400 });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.label === "string" && body.label.trim()) updates.label = body.label.trim();
    if (typeof body.external_device_id === "string") {
      updates.external_device_id = body.external_device_id.trim() || null;
    }
    if (typeof body.api_provider === "string") updates.api_provider = body.api_provider.trim() || null;

    const { data: row, error } = await admin
      .from("energy_meters")
      .update(updates)
      .eq("id", meterId)
      .eq("building_id", buildingId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ meter: row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
