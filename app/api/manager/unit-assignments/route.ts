import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Manager only" }, { status: 403 });

    const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
    if (!site?.id) return NextResponse.json({ unitOwners: [], unitTenantAssignments: [] });

    const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", site.id);
    const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
    if (!buildingIds.length) return NextResponse.json({ unitOwners: [], unitTenantAssignments: [] });

    const { data: units } = await admin.from("units").select("id").in("building_id", buildingIds);
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);
    if (!unitIds.length) return NextResponse.json({ unitOwners: [], unitTenantAssignments: [] });

    const { data: unitOwners } = await admin.from("unit_owners").select("unit_id, owner_id").in("unit_id", unitIds);
    const { data: unitTenantAssignments } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", unitIds);

    return NextResponse.json({
      unitOwners: unitOwners ?? [],
      unitTenantAssignments: unitTenantAssignments ?? [],
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
