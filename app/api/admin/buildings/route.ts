import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };
  return { ok: true as const, admin, user };
}

type BuildingRow = { id: string; name: string; site_id: string | null };
type SiteRow = { id: string; name: string; manager_id: string | null };
type ProfileRow = { id: string; name: string; surname: string };
type UnitRow = { id: string; building_id: string };
type UnitOwnerRow = { unit_id: string; owner_id: string };

export async function GET() {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;

    const { data: buildingsData, error: buildErr } = await admin.from("buildings").select("id,name,site_id");
    if (buildErr) return NextResponse.json({ error: buildErr.message }, { status: 500 });
    const buildings = (buildingsData ?? []) as BuildingRow[];

    const { data: sitesData } = await admin.from("sites").select("id,name,manager_id");
    const sites = (sitesData ?? []) as SiteRow[];
    const siteMap = new Map(sites.map(s => [s.id, s]));

    const { data: profilesData } = await admin.from("profiles").select("id,name,surname");
    const profiles = (profilesData ?? []) as ProfileRow[];
    const profileMap = new Map(profiles.map(p => [p.id, p]));

    const { data: unitsData } = await admin.from("units").select("id,building_id");
    const units = (unitsData ?? []) as UnitRow[];
    const unitIdsByBuilding = new Map<string, string[]>();
    units.forEach((u: UnitRow) => {
      const list = unitIdsByBuilding.get(u.building_id) ?? [];
      list.push(u.id);
      unitIdsByBuilding.set(u.building_id, list);
    });

    const { data: ownersData } = await admin.from("unit_owners").select("unit_id,owner_id");
    const unitOwners = (ownersData ?? []) as UnitOwnerRow[];
    const ownerIdsByUnit = new Map<string, string>();
    unitOwners.forEach((o: UnitOwnerRow) => ownerIdsByUnit.set(o.unit_id, o.owner_id));

    const enriched = buildings.map(b => {
      const site = b.site_id ? siteMap.get(b.site_id) : null;
      const manager = site?.manager_id ? profileMap.get(site.manager_id) : null;
      const unitIds = unitIdsByBuilding.get(b.id) ?? [];
      const ownerIds = [...new Set(unitIds.map(uid => ownerIdsByUnit.get(uid)).filter(Boolean))] as string[];
      const ownerNames = ownerIds.map(oid => {
        const p = profileMap.get(oid);
        return p ? `${p.name} ${p.surname}`.trim() : "";
      }).filter(Boolean);

      return {
        id: b.id,
        name: b.name,
        site_id: b.site_id,
        site_name: site?.name ?? null,
        manager_id: site?.manager_id ?? null,
        manager_name: manager ? `${manager.name} ${manager.surname}`.trim() : null,
        owner_names: ownerNames.length ? ownerNames.join(", ") : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user } = r;
    const { site_id, name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const { data, error } = await admin.from("buildings").insert({
      site_id: site_id || null,
      name: name.trim(),
    }).select("id").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    let auditSiteId: string | null = site_id || null;
    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "create",
      entity_type: "building",
      entity_id: data.id,
      entity_label: name.trim(),
      site_id: auditSiteId ?? undefined,
      new_values: { name: name.trim(), site_id: site_id || null },
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
