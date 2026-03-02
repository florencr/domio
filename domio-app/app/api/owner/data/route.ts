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
      const [expensesRes, tenantsRes] = await Promise.all([
        admin.from("expenses").select("id, title, vendor, amount, period_month, period_year"),
        admin.from("profiles").select("id, name, surname, email").eq("role", "tenant"),
      ]);
      const allUnits = (await admin.from("units").select("id, unit_name")).data ?? [];
      const body: Record<string, unknown> = {
        profile,
        units: [],
        allUnits,
        buildings: [],
        bills: [],
        expenses: expensesRes.data ?? [],
        unitTenantAssignments: [],
        tenants: tenantsRes.data ?? [],
      };
      if (debug) body._debug = { userId: user.id, unitIds: [], billsCount: 0 };
      return NextResponse.json(body);
    }

    const unitIdSet = new Set(unitIds.map((id: string) => String(id).toLowerCase()));
    const [unitsRes, allUnitsRes, buildingsRes, billsRes, expensesRes, assignmentsRes, tenantsRes] = await Promise.all([
      admin.from("units").select("id, unit_name, type, size_m2, building_id").in("id", unitIds),
      admin.from("units").select("id, unit_name"),
      admin.from("buildings").select("id, name"),
      sb.from("bills").select("id, unit_id, period_month, period_year, total_amount, status, paid_at, receipt_url, receipt_filename, receipt_path").order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(500),
      admin.from("expenses").select("id, title, vendor, amount, period_month, period_year"),
      admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", unitIds),
      admin.from("profiles").select("id, name, surname, email").eq("role", "tenant"),
    ]);
    const rawBills = billsRes.data ?? [];
    const allBills = rawBills.filter((b: { unit_id: string }) => unitIdSet.has(String(b?.unit_id || "").toLowerCase()));

    const body: Record<string, unknown> = {
      profile,
      units: unitsRes.data ?? [],
      allUnits: allUnitsRes.data ?? [],
      buildings: buildingsRes.data ?? [],
      bills: allBills,
      expenses: expensesRes.data ?? [],
      unitTenantAssignments: assignmentsRes.data ?? [],
      tenants: tenantsRes.data ?? [],
    };
    if (debug) body._debug = { userId: user.id, unitIds, unitsCount: (unitsRes.data ?? []).length, rawBillsCount: rawBills.length, billsCount: allBills.length };
    return NextResponse.json(body, { headers: { "Cache-Control": "no-store, no-cache, must-revalidate" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
