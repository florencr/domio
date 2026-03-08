import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { notifyUsers } from "@/lib/notify-users";

export async function POST(request: Request) {
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
    if (!site?.id) return NextResponse.json({ error: "No site" }, { status: 403 });

    const { unitId, ownerId, tenantId } = await request.json();
    if (!unitId) return NextResponse.json({ error: "unitId required" }, { status: 400 });

    const { data: unit } = await admin.from("units").select("id, building_id, unit_name").eq("id", unitId).single();
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

    const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", site.id);
    const managerBuildingIds = new Set((buildings ?? []).map((b: { id: string }) => b.id));
    if (!managerBuildingIds.has(unit.building_id)) return NextResponse.json({ error: "Unit not in your site" }, { status: 403 });

    const unitName = (unit as { unit_name?: string }).unit_name ?? "your unit";

    if (ownerId) {
      const { data: existing } = await admin.from("unit_owners").select("id").eq("unit_id", unitId).maybeSingle();
      if (existing) await admin.from("unit_owners").delete().eq("unit_id", unitId);
      const { error } = await admin.from("unit_owners").insert({ unit_id: unitId, owner_id: ownerId });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await admin.from("user_site_assignments").delete().eq("user_id", ownerId);
      await notifyUsers(admin, user.id, new Set([ownerId]), "Unit assigned", `You have been assigned to ${unitName}. Log in to view your dashboard.`).catch(() => {});
    } else {
      await admin.from("unit_owners").delete().eq("unit_id", unitId);
    }

    if (tenantId) {
      await admin.from("unit_tenant_assignments").delete().eq("unit_id", unitId);
      const { error } = await admin.from("unit_tenant_assignments").insert({ unit_id: unitId, tenant_id: tenantId, is_payment_responsible: true });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      await admin.from("user_site_assignments").delete().eq("user_id", tenantId);
      await notifyUsers(admin, user.id, new Set([tenantId]), "Unit assigned", `You have been assigned to ${unitName}. Log in to view your bills.`).catch(() => {});
    } else {
      await admin.from("unit_tenant_assignments").delete().eq("unit_id", unitId);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
