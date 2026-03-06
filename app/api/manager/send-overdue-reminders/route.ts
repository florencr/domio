import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { notifyUsers } from "@/lib/notify-users";

async function requireManager() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "manager") return { ok: false as const, status: 403, error: "Manager only" };
  const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
  if (!site?.id) return { ok: false as const, status: 403, error: "No site" };
  return { ok: true as const, admin, siteId: site.id, user };
}

export async function POST() {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId, user } = r;

    const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
    const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
    if (!buildingIds.length) return NextResponse.json({ success: true, recipients: 0, message: "No buildings" });

    const { data: units } = await admin.from("units").select("id").in("building_id", buildingIds);
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);
    if (!unitIds.length) return NextResponse.json({ success: true, recipients: 0, message: "No units" });

    const { data: unpaidBills } = await admin
      .from("bills")
      .select("unit_id")
      .in("unit_id", unitIds)
      .is("paid_at", null)
      .neq("status", "in_process");
    const unpaidUnitIds = new Set((unpaidBills ?? []).map((b: { unit_id: string }) => b.unit_id));
    if (unpaidUnitIds.size === 0) return NextResponse.json({ success: true, recipients: 0, message: "No overdue bills" });

    const { data: owners } = await admin.from("unit_owners").select("unit_id, owner_id").in("unit_id", [...unpaidUnitIds]);
    const { data: assignments } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", [...unpaidUnitIds]);

    const billToMap = new Map<string, string>();
    (owners ?? []).forEach((r: { unit_id: string; owner_id: string }) => { if (!billToMap.has(r.unit_id)) billToMap.set(r.unit_id, r.owner_id); });
    (assignments ?? []).forEach((a: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }) => {
      if (a.is_payment_responsible === true) billToMap.set(a.unit_id, a.tenant_id);
    });
    const notifyUserIds = new Set<string>();
    billToMap.forEach(uid => notifyUserIds.add(uid));

    const { success, count } = await notifyUsers(
      admin,
      user.id,
      notifyUserIds,
      "Overdue: Please pay your bills",
      "You have unpaid maintenance bills. Please log in to view and pay to avoid late fees."
    );

    return NextResponse.json({ success, recipients: count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
