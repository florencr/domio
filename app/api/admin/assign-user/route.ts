import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { notifyUsers } from "@/lib/notify-users";
import { replaceOwnerMembership, replaceTenantMembership } from "@/lib/unit-memberships";

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

export async function POST(request: Request) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user: adminUser } = r;

    const { userId, siteId, unitId, role } = await request.json();
    if (!userId || !role) return NextResponse.json({ error: "userId and role required" }, { status: 400 });
    if (role !== "owner" && role !== "tenant") return NextResponse.json({ error: "role must be owner or tenant" }, { status: 400 });

    const { data: profile } = await admin.from("profiles").select("role").eq("id", userId).single();
    const pr = (profile as { role?: string } | null)?.role;
    if (!profile || pr === "admin" || pr === "manager") return NextResponse.json({ error: "Invalid user for unit assignment" }, { status: 400 });

    if (siteId && !unitId) {
      const { error } = await admin.from("user_site_assignments").upsert({ user_id: userId, site_id: siteId }, { onConflict: "user_id" });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (unitId) {
      const { data: unit } = await admin.from("units").select("unit_name").eq("id", unitId).single();
      const unitName = (unit as { unit_name?: string } | null)?.unit_name ?? "your unit";
      if (role === "owner") {
        const { data: existing } = await admin.from("unit_owners").select("id").eq("unit_id", unitId).maybeSingle();
        if (existing) return NextResponse.json({ error: "Unit already has an owner. Release the current owner first before assigning another." }, { status: 400 });
        const { error } = await admin.from("unit_owners").insert({ unit_id: unitId, owner_id: userId });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await replaceOwnerMembership(admin, unitId, userId);
        await notifyUsers(admin, adminUser.id, new Set([userId]), "Unit assigned", `You have been assigned to ${unitName}. Log in to view your dashboard.`).catch(() => {});
      } else {
        const { data: existing } = await admin.from("unit_tenant_assignments").select("id").eq("unit_id", unitId).maybeSingle();
        if (existing) return NextResponse.json({ error: "Unit already has a tenant. Release the current tenant first before assigning another." }, { status: 400 });
        const { error } = await admin.from("unit_tenant_assignments").insert({ unit_id: unitId, tenant_id: userId, is_payment_responsible: true });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
        await replaceTenantMembership(admin, unitId, userId, true);
        await notifyUsers(admin, adminUser.id, new Set([userId]), "Unit assigned", `You have been assigned to ${unitName}. Log in to view your bills.`).catch(() => {});
      }
      await admin.from("user_site_assignments").delete().eq("user_id", userId);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "siteId or unitId required" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
