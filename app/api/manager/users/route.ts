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
    if (!site?.id) return NextResponse.json([]);

    const siteId = site.id;

    const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
    const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
    let unitIds = new Set<string>();
    if (buildingIds.length) {
      const { data: units } = await admin.from("units").select("id").in("building_id", buildingIds);
      unitIds = new Set((units ?? []).map((u: { id: string }) => u.id));
    }

    const { data: unitOwners } = await admin.from("unit_owners").select("unit_id, owner_id");
    const { data: unitTenants } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id");
    const { data: siteAssignments } = await admin.from("user_site_assignments").select("user_id").eq("site_id", siteId);

    const userIds = new Set<string>();
    (unitOwners ?? []).forEach((o: { unit_id: string; owner_id: string }) => {
      if (unitIds.has(o.unit_id)) userIds.add(o.owner_id);
    });
    (unitTenants ?? []).forEach((a: { unit_id: string; tenant_id: string }) => {
      if (unitIds.has(a.unit_id)) userIds.add(a.tenant_id);
    });
    (siteAssignments ?? []).forEach((a: { user_id: string }) => userIds.add(a.user_id));

    const allUserIds = [...userIds];
    if (!allUserIds.length) return NextResponse.json([]);

    const { data: profiles, error } = await admin.from("profiles").select("id,name,surname,email,role,phone,avatar_url").in("id", allUserIds);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json(profiles ?? []);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
