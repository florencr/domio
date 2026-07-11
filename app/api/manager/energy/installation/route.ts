import { NextResponse } from "next/server";
import { requireManagerBuilding } from "@/lib/energy/require-manager-building";
import { logAudit } from "@/lib/audit";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const buildingId = typeof body.building_id === "string" ? body.building_id : "";
    const r = await requireManagerBuilding(buildingId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, siteId, buildingId: bid } = r;

    const { data: existing } = await admin
      .from("energy_installations")
      .select("id")
      .eq("building_id", bid)
      .maybeSingle();
    if (existing) {
      return NextResponse.json({ error: "Installation already exists for this building" }, { status: 400 });
    }

    const name = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Shared solar";
    const capacityKw =
      body.capacity_kw != null && body.capacity_kw !== "" ? Number(body.capacity_kw) : null;
    const status =
      body.status === "active" || body.status === "inactive" || body.status === "pending"
        ? body.status
        : "pending";
    const inverterApiProvider =
      typeof body.inverter_api_provider === "string" ? body.inverter_api_provider.trim() || null : null;
    const inverterExternalId =
      typeof body.inverter_external_id === "string" ? body.inverter_external_id.trim() || null : null;
    const notes = typeof body.notes === "string" ? body.notes.trim() || null : null;

    const { data: row, error } = await admin
      .from("energy_installations")
      .insert({
        building_id: bid,
        name,
        capacity_kw: capacityKw,
        status,
        inverter_api_provider: inverterApiProvider,
        inverter_external_id: inverterExternalId,
        notes,
      })
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const installationId = (row as { id: string }).id;

    const { error: prodErr } = await admin.from("energy_meters").insert({
      building_id: bid,
      installation_id: installationId,
      unit_id: null,
      meter_role: "production",
      label: "Production meter",
      external_device_id:
        typeof body.production_meter_id === "string" ? body.production_meter_id.trim() || null : null,
    });
    if (prodErr) return NextResponse.json({ error: prodErr.message }, { status: 400 });

    const { error: commErr } = await admin.from("energy_meters").insert({
      building_id: bid,
      installation_id: installationId,
      unit_id: null,
      meter_role: "community",
      label: "Community meter (building ↔ grid)",
      external_device_id:
        typeof body.community_meter_id === "string" ? body.community_meter_id.trim() || null : null,
    });
    if (commErr) return NextResponse.json({ error: commErr.message }, { status: 400 });

    await logAudit({
      user_id: user.id,
      user_email: user.email ?? undefined,
      action: "create",
      entity_type: "energy_installation",
      entity_id: installationId,
      entity_label: name,
      site_id: siteId,
      new_values: { building_id: bid, name, capacity_kw: capacityKw, status },
    });

    return NextResponse.json({ installation: row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const buildingId = typeof body.building_id === "string" ? body.building_id : "";
    const r = await requireManagerBuilding(buildingId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, siteId } = r;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (typeof body.name === "string" && body.name.trim()) updates.name = body.name.trim();
    if (body.capacity_kw != null) updates.capacity_kw = body.capacity_kw === "" ? null : Number(body.capacity_kw);
    if (body.status === "active" || body.status === "inactive" || body.status === "pending") {
      updates.status = body.status;
    }
    if (typeof body.inverter_api_provider === "string") {
      updates.inverter_api_provider = body.inverter_api_provider.trim() || null;
    }
    if (typeof body.inverter_external_id === "string") {
      updates.inverter_external_id = body.inverter_external_id.trim() || null;
    }
    if (typeof body.notes === "string") updates.notes = body.notes.trim() || null;
    if (body.api_config && typeof body.api_config === "object") updates.api_config = body.api_config;

    const { data: row, error } = await admin
      .from("energy_installations")
      .update(updates)
      .eq("building_id", buildingId)
      .select("*")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    await logAudit({
      user_id: user.id,
      user_email: user.email ?? undefined,
      action: "update",
      entity_type: "energy_installation",
      entity_id: (row as { id: string }).id,
      site_id: siteId,
      new_values: updates,
    });

    return NextResponse.json({ installation: row });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
