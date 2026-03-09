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

// Fetch tenant dashboard data using service role (bypasses RLS)
export async function GET() {
  try {
    const sb = await createClient();
    const { data: { session } } = await sb.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();

    const [profileRes, tenantAssignmentsRes] = await Promise.all([
      admin.from("profiles").select("id, name, surname, email, role, phone").eq("id", user.id).single(),
      admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", user.id),
    ]);

    const profile = profileRes.data;
    const unitIds = (tenantAssignmentsRes.data ?? []).map((u: { unit_id: string }) => u.unit_id);

    if (!unitIds.length) {
      const allUnits = (await admin.from("units").select("id, unit_name")).data ?? [];
      return NextResponse.json({
        profile,
        units: [],
        allUnits,
        buildings: [],
        bills: [],
        expenses: [],
        unitTenantAssignments: [],
        siteNames: [],
        sites: [],
      });
    }

    const unitIdSet = new Set(unitIds);
    const [unitsRes, allUnitsRes, buildingsRes, billsRes, expensesRes, assignmentsRes] = await Promise.all([
      admin.from("units").select("id, unit_name, type, size_m2, building_id, entrance, floor").in("id", unitIds),
      admin.from("units").select("id, unit_name"),
      admin.from("buildings").select("id, name, site_id"),
      admin.from("bills").select("id, unit_id, period_month, period_year, total_amount, status, paid_at, receipt_url, receipt_filename, receipt_path, reference_code").in("unit_id", unitIds).order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(500),
      admin.from("expenses").select("id, title, vendor, amount, period_month, period_year, paid_at"),
      admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", unitIds),
    ]);
    const assignments = (assignmentsRes ?? { data: [] }).data ?? [];
    const unitPayerMap = new Map<string, string>();
    (assignments as { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }[]).forEach((a: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }) => {
      if (!unitPayerMap.has(a.unit_id) && a.is_payment_responsible !== false) unitPayerMap.set(a.unit_id, a.tenant_id);
      else if (a.is_payment_responsible === true) unitPayerMap.set(a.unit_id, a.tenant_id);
    });
    const myPayingUnitIds = new Set(unitIds.filter((uid: string) => unitPayerMap.get(uid) === user.id));
    const allBills = (billsRes.data ?? []).filter((b: { unit_id: string }) => myPayingUnitIds.has(b.unit_id));
    const buildings = buildingsRes.data ?? [];
    const buildingIds = [...new Set((unitsRes.data ?? []).map((u: { building_id: string }) => u.building_id).filter(Boolean))];
    const siteIds = [...new Set((buildings as { site_id: string | null }[]).map(b => b.site_id).filter(Boolean))] as string[];
    const { data: sitesData } = siteIds.length ? await admin.from("sites").select("id, name").in("id", siteIds) : { data: [] };
    const siteNames = ((sitesData ?? []) as { name: string }[]).map(s => s.name);

    return NextResponse.json({
      profile,
      units: unitsRes.data ?? [],
      allUnits: allUnitsRes.data ?? [],
      buildings,
      bills: allBills,
      expenses: expensesRes.data ?? [],
      unitTenantAssignments: assignments,
      siteNames,
      sites: sitesData ?? [],
    }, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
