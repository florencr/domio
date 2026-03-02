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
      admin.from("profiles").select("id, name, surname, email, role").eq("id", user.id).single(),
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
      });
    }

    const unitIdSet = new Set(unitIds);
    const [unitsRes, allUnitsRes, buildingsRes, billsRes, expensesRes] = await Promise.all([
      admin.from("units").select("id, unit_name, type, size_m2, building_id").in("id", unitIds),
      admin.from("units").select("id, unit_name"),
      admin.from("buildings").select("id, name"),
      sb.from("bills").select("id, unit_id, period_month, period_year, total_amount, status, paid_at, receipt_url, receipt_filename, receipt_path").order("period_year", { ascending: false }).order("period_month", { ascending: false }).limit(500),
      admin.from("expenses").select("id, title, vendor, amount, period_month, period_year"),
    ]);
    const allBills = (billsRes.data ?? []).filter((b: { unit_id: string }) => unitIdSet.has(b.unit_id));

    return NextResponse.json({
      profile,
      units: unitsRes.data ?? [],
      allUnits: allUnitsRes.data ?? [],
      buildings: buildingsRes.data ?? [],
      bills: allBills,
      expenses: expensesRes.data ?? [],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
