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

// Fetch owner dashboard data using service role (bypasses RLS)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const debug = searchParams.get("debug") === "1";
    const sb = await createClient();
    const { data: { session } } = await sb.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();

    const [profileRes, unitOwnersRes] = await Promise.all([
      admin.from("profiles").select("id, name, surname, email, role").eq("id", user.id).single(),
      admin.from("unit_owners").select("unit_id").eq("owner_id", user.id),
    ]);

    const profile = profileRes.data;
    // Allow any authenticated user - owners get their units from unit_owners; others get empty
    const unitIds = (unitOwnersRes.data ?? []).map((u: { unit_id: string }) => u.unit_id);

    if (!unitIds.length) {
      const [expensesRes, tenantsRes, asnRes] = await Promise.all([
        admin.from("expenses").select("id, title, vendor, amount, period_month, period_year"),
        admin.from("profiles").select("id, name, surname, email").eq("role", "tenant"),
        admin.from("user_site_assignments").select("site_id").eq("user_id", user.id),
      ]);
      const allUnits = (await admin.from("units").select("id, unit_name")).data ?? [];
      const asnSiteIds = [...new Set((asnRes.data ?? []).map((a: { site_id: string }) => a.site_id).filter(Boolean))];
      const { data: asnSites } = asnSiteIds.length ? await admin.from("sites").select("id, name").in("id", asnSiteIds) : { data: [] };
      const siteNamesEmpty = ((asnSites ?? []) as { name: string }[]).map(s => s.name);
      const body: Record<string, unknown> = {
        profile,
        units: [],
        allUnits,
        buildings: [],
        bills: [],
        expenses: expensesRes.data ?? [],
        unitTenantAssignments: [],
        tenants: tenantsRes.data ?? [],
        siteNames: siteNamesEmpty,
      };
      if (debug) body._debug = { userId: user.id, unitIds: [], billsCount: 0 };
      return NextResponse.json(body);
    }

    const unitIdSet = new Set(unitIds.map((id: string) => String(id).toLowerCase()));
    const [unitsRes, allUnitsRes, billsRes, expensesRes, assignmentsRes, tenantsRes] = await Promise.all([
      admin.from("units").select("id, unit_name, type, size_m2, building_id").in("id", unitIds),
      admin.from("units").select("id, unit_name"),
      admin.from("bills").select("id, unit_id, period_month, period_year, total_amount, status, paid_at, receipt_url, receipt_filename, receipt_path, reference_code").in("unit_id", unitIds).order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(500),
      admin.from("expenses").select("id, title, vendor, amount, period_month, period_year"),
      admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", unitIds),
      admin.from("profiles").select("id, name, surname, email").eq("role", "tenant"),
    ]);
    const unitData = unitsRes.data ?? [];
    const buildingIds = [...new Set((unitData as { building_id: string }[]).map((u: { building_id: string }) => u.building_id).filter(Boolean))];
    const { data: buildingsData } = buildingIds.length
      ? await admin.from("buildings").select("id, name, site_id").in("id", buildingIds)
      : { data: [] };
    const buildings = buildingsData ?? [];
    let siteIds = [...new Set((buildings as { site_id: string | null }[]).map(b => b.site_id).filter(Boolean))] as string[];
    if (!siteIds.length) {
      const { data: asn } = await admin.from("user_site_assignments").select("site_id").eq("user_id", user.id);
      siteIds = [...new Set((asn ?? []).map((a: { site_id: string }) => a.site_id).filter(Boolean))];
    }
    const { data: sitesData } = siteIds.length ? await admin.from("sites").select("id, name").in("id", siteIds) : { data: [] };
    const siteNames = ((sitesData ?? []) as { name: string }[]).map(s => s.name);
    const rawBills = billsRes.data ?? [];
    const allBills = rawBills.filter((b: { unit_id: string }) => unitIdSet.has(String(b?.unit_id || "").toLowerCase()));

    const body: Record<string, unknown> = {
      profile,
      units: unitsRes.data ?? [],
      allUnits: allUnitsRes.data ?? [],
      buildings,
      bills: allBills,
      expenses: expensesRes.data ?? [],
      unitTenantAssignments: assignmentsRes.data ?? [],
      tenants: tenantsRes.data ?? [],
      siteNames,
    };
    if (debug) body._debug = { userId: user.id, unitIds, unitsCount: (unitsRes.data ?? []).length, rawBillsCount: rawBills.length, billsCount: allBills.length };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
