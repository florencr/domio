import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
  return { ok: true as const, admin };
}

type ProfileRow = { id: string; name: string; surname: string; email: string; role: string; phone?: string | null };
type UserWithUnits = ProfileRow & { units: string[] };

export async function GET() {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;

    const { data: sites, error: sitesErr } = await admin.from("sites").select("id, name, manager_id").order("name");
    if (sitesErr) return NextResponse.json({ error: sitesErr.message }, { status: 500 });

    const { data: buildings } = await admin.from("buildings").select("id, site_id");
    const buildingsBySite = new Map<string, string[]>();
    (buildings ?? []).forEach((b: { id: string; site_id: string | null }) => {
      if (b.site_id) {
        const list = buildingsBySite.get(b.site_id) ?? [];
        list.push(b.id);
        buildingsBySite.set(b.site_id, list);
      }
    });

    const { data: units } = await admin.from("units").select("id, unit_name, building_id");
    const unitsByBuilding = new Map<string, { id: string; unit_name: string }[]>();
    (units ?? []).forEach((u: { id: string; unit_name: string; building_id: string }) => {
      const list = unitsByBuilding.get(u.building_id) ?? [];
      list.push({ id: u.id, unit_name: u.unit_name });
      unitsByBuilding.set(u.building_id, list);
    });

    const { data: owners } = await admin.from("unit_owners").select("unit_id, owner_id");
    const { data: assignments } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id");
    const siteRes = await admin.from("user_site_assignments").select("user_id, site_id");
    const siteAssignments = siteRes.error ? [] : (siteRes.data ?? []);
    const { data: profiles } = await admin.from("profiles").select("id, name, surname, email, role, phone");
    const profileMap = new Map<string, ProfileRow>();
    (profiles ?? []).forEach((p: ProfileRow) => profileMap.set(p.id, p));
    const userToSiteAssignment = new Map<string, string>();
    (siteAssignments ?? []).forEach((a: { user_id: string; site_id: string }) => userToSiteAssignment.set(a.user_id, a.site_id));

    const unitToSite = new Map<string, string>();
    (sites ?? []).forEach((s: { id: string }) => {
      const buildIds = buildingsBySite.get(s.id) ?? [];
      buildIds.forEach(bid => {
        const unitList = unitsByBuilding.get(bid) ?? [];
        unitList.forEach(u => unitToSite.set(u.id, s.id));
      });
    });

    const assignedOwnerIds = new Set((owners ?? []).map((o: { owner_id: string }) => o.owner_id));
    const assignedTenantIds = new Set((assignments ?? []).map((a: { tenant_id: string }) => a.tenant_id));

    const result: {
      site_id: string;
      site_name: string;
      manager: ProfileRow | null;
      owners: UserWithUnits[];
      tenants: UserWithUnits[];
    }[] = [];

    for (const site of (sites ?? []) as { id: string; name: string; manager_id: string }[]) {
      const manager = site.manager_id ? (profileMap.get(site.manager_id) ?? null) : null;
      const ownerUnits = new Map<string, string[]>();
      const tenantUnits = new Map<string, string[]>();

      (owners ?? []).forEach((o: { unit_id: string; owner_id: string }) => {
        const siteId = unitToSite.get(o.unit_id);
        if (siteId !== site.id) return;
        const u = (units ?? []).find((x: { id: string }) => x.id === o.unit_id) as { unit_name: string } | undefined;
        const unitName = u?.unit_name ?? o.unit_id.slice(0, 8);
        const list = ownerUnits.get(o.owner_id) ?? [];
        list.push(unitName);
        ownerUnits.set(o.owner_id, list);
      });

      (assignments ?? []).forEach((a: { unit_id: string; tenant_id: string }) => {
        const siteId = unitToSite.get(a.unit_id);
        if (siteId !== site.id) return;
        const u = (units ?? []).find((x: { id: string }) => x.id === a.unit_id) as { unit_name: string } | undefined;
        const unitName = u?.unit_name ?? a.unit_id.slice(0, 8);
        const list = tenantUnits.get(a.tenant_id) ?? [];
        list.push(unitName);
        tenantUnits.set(a.tenant_id, list);
      });

      const ownerList: UserWithUnits[] = [];
      ownerUnits.forEach((unitNames, ownerId) => {
        const p = profileMap.get(ownerId);
        if (p) ownerList.push({ ...p, units: unitNames });
      });
      const tenantList: UserWithUnits[] = [];
      tenantUnits.forEach((unitNames, tenantId) => {
        const p = profileMap.get(tenantId);
        if (p) tenantList.push({ ...p, units: unitNames });
      });
      (profiles ?? []).forEach((p: ProfileRow) => {
        if (p.role === "owner" && !ownerUnits.has(p.id) && userToSiteAssignment.get(p.id) === site.id)
          ownerList.push({ ...p, units: [] });
        if (p.role === "tenant" && !tenantUnits.has(p.id) && userToSiteAssignment.get(p.id) === site.id)
          tenantList.push({ ...p, units: [] });
      });

      result.push({
        site_id: site.id,
        site_name: site.name,
        manager,
        owners: ownerList.sort((a, b) => (a.surname + a.name).localeCompare(b.surname + b.name)),
        tenants: tenantList.sort((a, b) => (a.surname + a.name).localeCompare(b.surname + b.name)),
      });
    }

    const unassignedOwners: UserWithUnits[] = [];
    const unassignedTenants: UserWithUnits[] = [];
    const adminUsers: UserWithUnits[] = [];
    (profiles ?? []).forEach((p: ProfileRow) => {
      if (p.role === "admin") adminUsers.push({ ...p, units: [] });
      if (p.role === "owner" && !assignedOwnerIds.has(p.id) && !userToSiteAssignment.has(p.id)) unassignedOwners.push({ ...p, units: [] });
      if (p.role === "tenant" && !assignedTenantIds.has(p.id) && !userToSiteAssignment.has(p.id)) unassignedTenants.push({ ...p, units: [] });
    });
    if (adminUsers.length) {
      result.push({
        site_id: "__admin__",
        site_name: "Admin (no site)",
        manager: null,
        owners: [],
        tenants: adminUsers.sort((a, b) => (a.surname + a.name).localeCompare(b.surname + b.name)),
      });
    }
    if (unassignedOwners.length || unassignedTenants.length) {
      result.unshift({
        site_id: "__unassigned__",
        site_name: "Unassigned (no site/unit)",
        manager: null,
        owners: unassignedOwners.sort((a, b) => (a.surname + a.name).localeCompare(b.surname + b.name)),
        tenants: unassignedTenants.sort((a, b) => (a.surname + a.name).localeCompare(b.surname + b.name)),
      });
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
