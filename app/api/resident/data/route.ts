import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function ownerUnitIds(admin: ReturnType<typeof adminClient>, userId: string): Promise<string[]> {
  const { data: memRows, error: memErr } = await admin
    .from("unit_memberships")
    .select("unit_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active");
  if (!memErr && memRows?.length) {
    return (memRows as { unit_id: string }[]).map((r) => r.unit_id);
  }
  const { data: legacy } = await admin.from("unit_owners").select("unit_id").eq("owner_id", userId);
  return (legacy ?? []).map((u: { unit_id: string }) => u.unit_id);
}

async function tenantUnitIds(admin: ReturnType<typeof adminClient>, userId: string): Promise<string[]> {
  const { data: memRows, error: memErr } = await admin
    .from("unit_memberships")
    .select("unit_id")
    .eq("user_id", userId)
    .eq("role", "tenant")
    .eq("status", "active");
  if (!memErr && memRows?.length) {
    return (memRows as { unit_id: string }[]).map((r) => r.unit_id);
  }
  const { data: legacy } = await admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", userId);
  return (legacy ?? []).map((u: { unit_id: string }) => u.unit_id);
}

function uniq(ids: string[]): string[] {
  return [...new Set(ids.map((id) => String(id)))];
}

type UnitOwnerRow = { unit_id: string; owner_id: string };

/** One owner per unit: memberships first, then legacy unit_owners. */
async function unitOwnersForUnits(admin: ReturnType<typeof adminClient>, unitIds: string[]): Promise<UnitOwnerRow[]> {
  if (!unitIds.length) return [];
  const byUnit = new Map<string, string>();
  const { data: memRows, error: memErr } = await admin
    .from("unit_memberships")
    .select("unit_id, user_id")
    .in("unit_id", unitIds)
    .eq("role", "owner")
    .eq("status", "active");
  if (!memErr && memRows?.length) {
    (memRows as { unit_id: string; user_id: string }[]).forEach((r) => {
      if (!byUnit.has(r.unit_id)) byUnit.set(r.unit_id, r.user_id);
    });
  }
  const missing = unitIds.filter((id) => !byUnit.has(id));
  if (missing.length) {
    const { data: legacy } = await admin.from("unit_owners").select("unit_id, owner_id").in("unit_id", missing);
    (legacy ?? []).forEach((r: { unit_id: string; owner_id: string }) => {
      if (!byUnit.has(r.unit_id)) byUnit.set(r.unit_id, r.owner_id);
    });
  }
  return [...byUnit.entries()].map(([unit_id, owner_id]) => ({ unit_id, owner_id }));
}

/** Owner + tenant memberships: one dashboard for residents. */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const debug = searchParams.get("debug") === "1";
    const filterUnitId = searchParams.get("unitId");
    const sb = await createClient();
    const { data: { user }, error: authErr } = await sb.auth.getUser();
    if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();

    const { data: profile } = await admin.from("profiles").select("id, name, surname, email, role").eq("id", user.id).single();

    let ownerIds = await ownerUnitIds(admin, user.id);
    let tenantIds = await tenantUnitIds(admin, user.id);
    let allUnitIds = uniq([...ownerIds, ...tenantIds]);

    if (filterUnitId) {
      const ok = allUnitIds.some((id) => id === filterUnitId);
      if (!ok) return NextResponse.json({ error: "No access to this unit" }, { status: 403 });
      ownerIds = ownerIds.filter((id) => id === filterUnitId);
      tenantIds = tenantIds.filter((id) => id === filterUnitId);
      allUnitIds = [filterUnitId];
    }

    const ownerIdSet = new Set(ownerIds.map((id) => String(id).toLowerCase()));

    if (!allUnitIds.length) {
      const [expensesRes, asnRes] = await Promise.all([
        admin.from("expenses").select("id, title, vendor, amount, period_month, period_year, paid_at"),
        admin.from("user_site_assignments").select("site_id").eq("user_id", user.id),
      ]);
      const allUnits = (await admin.from("units").select("id, unit_name")).data ?? [];
      const asnSiteIds = [...new Set((asnRes.data ?? []).map((a: { site_id: string }) => a.site_id).filter(Boolean))];
      const { data: asnSites } = asnSiteIds.length ? await admin.from("sites").select("id, name").in("id", asnSiteIds) : { data: [] };
      const siteNamesEmpty = ((asnSites ?? []) as { name: string }[]).map((s) => s.name);
      const siteUserIds = new Set<string>();
      if (asnSiteIds.length) {
        const { data: siteUsers } = await admin.from("user_site_assignments").select("user_id").in("site_id", asnSiteIds);
        (siteUsers ?? []).forEach((r: { user_id: string }) => siteUserIds.add(r.user_id));
      }
      const { data: tenantCandidates } = siteUserIds.size
        ? await admin.from("profiles").select("id, name, surname, email").in("id", [...siteUserIds]).neq("role", "admin").neq("role", "manager")
        : { data: [] };
      const body: Record<string, unknown> = {
        profile,
        ownerUnitIds: [],
        units: [],
        allUnits,
        buildings: [],
        bills: [],
        expenses: expensesRes.data ?? [],
        unitTenantAssignments: [],
        unitOwnerProfiles: [],
        tenants: tenantCandidates ?? [],
        siteNames: siteNamesEmpty,
        sites: asnSites ?? [],
      };
      if (debug) body._debug = { userId: user.id, allUnitIds: [], billsCount: 0 };
      return NextResponse.json(body);
    }

    const unitIdSet = new Set(allUnitIds.map((id: string) => String(id).toLowerCase()));
    const [unitsRes, allUnitsRes, billsRes, expensesRes, assignmentsRes] = await Promise.all([
      admin.from("units").select("id, unit_name, type, size_m2, building_id, entrance, floor").in("id", allUnitIds),
      admin.from("units").select("id, unit_name"),
      admin.from("bills").select("id, unit_id, period_month, period_year, total_amount, status, paid_at, receipt_url, receipt_filename, receipt_path, reference_code").in("unit_id", allUnitIds).order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(500),
      admin.from("expenses").select("id, title, vendor, amount, period_month, period_year, paid_at"),
      admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", allUnitIds),
    ]);
    const unitData = unitsRes.data ?? [];
    const buildingIds = [...new Set((unitData as { building_id: string }[]).map((u: { building_id: string }) => u.building_id).filter(Boolean))];
    const { data: buildingsData } = buildingIds.length
      ? await admin.from("buildings").select("id, name, site_id").in("id", buildingIds)
      : { data: [] };
    const buildings = buildingsData ?? [];
    let siteIds = [...new Set((buildings as { site_id: string | null }[]).map((b) => b.site_id).filter(Boolean))] as string[];
    if (!siteIds.length) {
      const { data: asn } = await admin.from("user_site_assignments").select("site_id").eq("user_id", user.id);
      siteIds = [...new Set((asn ?? []).map((a: { site_id: string }) => a.site_id).filter(Boolean))];
    }
    const { data: sitesData } = siteIds.length ? await admin.from("sites").select("id, name").in("id", siteIds) : { data: [] };
    const siteNames = ((sitesData ?? []) as { name: string }[]).map((s) => s.name);

    const assignments = (assignmentsRes.data ?? []) as { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }[];
    const unitPayerMap = new Map<string, string>();
    assignments.forEach((a) => {
      if (!unitPayerMap.has(a.unit_id) && a.is_payment_responsible !== false) unitPayerMap.set(a.unit_id, a.tenant_id);
      else if (a.is_payment_responsible === true) unitPayerMap.set(a.unit_id, a.tenant_id);
    });

    const rawBills = billsRes.data ?? [];
    const inScope = rawBills.filter((b: { unit_id: string }) => unitIdSet.has(String(b?.unit_id || "").toLowerCase()));
    const allBills = inScope.filter((b: { unit_id: string }) => {
      const uid = String(b.unit_id);
      if (ownerIdSet.has(uid.toLowerCase())) return true;
      return unitPayerMap.get(uid) === user.id;
    });

    const siteUserIds = new Set<string>();
    if (siteIds.length) {
      const { data: siteUsers } = await admin.from("user_site_assignments").select("user_id").in("site_id", siteIds);
      (siteUsers ?? []).forEach((r: { user_id: string }) => siteUserIds.add(r.user_id));
    }
    const { data: tenantCandidates } = siteUserIds.size
      ? await admin.from("profiles").select("id, name, surname, email").in("id", [...siteUserIds]).neq("role", "admin").neq("role", "manager")
      : { data: [] };

    const ownerRows = await unitOwnersForUnits(admin, allUnitIds);
    const ownerProfileIds = uniq(ownerRows.map((r) => r.owner_id));
    const { data: ownerProfilesRaw } = ownerProfileIds.length
      ? await admin.from("profiles").select("id, name, surname, email").in("id", ownerProfileIds)
      : { data: [] };
    const ownerProfileById = new Map(
      (ownerProfilesRaw ?? []).map((p: { id: string; name: string; surname: string; email: string }) => [p.id, p])
    );
    const unitOwnerProfiles = ownerRows.map(({ unit_id, owner_id }) => {
      const p = ownerProfileById.get(owner_id);
      return {
        unit_id,
        id: owner_id,
        name: p?.name ?? "",
        surname: p?.surname ?? "",
        email: p?.email ?? "",
      };
    });

    const body: Record<string, unknown> = {
      profile,
      ownerUnitIds: ownerIds,
      units: unitsRes.data ?? [],
      allUnits: allUnitsRes.data ?? [],
      buildings,
      bills: allBills,
      expenses: expensesRes.data ?? [],
      unitTenantAssignments: assignments,
      unitOwnerProfiles,
      tenants: tenantCandidates ?? [],
      siteNames,
      sites: sitesData ?? [],
    };
    if (debug) {
      body._debug = {
        userId: user.id,
        allUnitIds,
        ownerCount: ownerIds.length,
        tenantCount: tenantIds.length,
        rawBillsCount: rawBills.length,
        billsCount: allBills.length,
      };
    }
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
