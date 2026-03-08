import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { notifyUsers } from "@/lib/notify-users";

/**
 * Cron job: sends overdue reminders for all sites.
 * Secured by CRON_SECRET - set in Vercel env vars.
 * Vercel sends: Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  const { data: sites } = await admin.from("sites").select("id, manager_id").not("manager_id", "is", null);
  if (!sites?.length) return NextResponse.json({ success: true, sitesProcessed: 0 });

  let totalRecipients = 0;
  const now = Date.now();

  for (const site of sites as { id: string; manager_id: string }[]) {
    const siteId = site.id;
    const managerId = site.manager_id;

    const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
    const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
    if (!buildingIds.length) continue;

    const { data: units } = await admin.from("units").select("id").in("building_id", buildingIds);
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);
    if (!unitIds.length) continue;

    const { data: unpaidBills } = await admin
      .from("bills")
      .select("unit_id, period_month, period_year")
      .in("unit_id", unitIds)
      .is("paid_at", null)
      .neq("status", "in_process");

    const overdue30Days = (unpaidBills ?? []).filter((b: { unit_id: string; period_month: number; period_year: number }) => {
      const issueDate = new Date(b.period_year, b.period_month - 1, 1).getTime();
      const overdueDate = issueDate + 30 * 24 * 60 * 60 * 1000;
      return now >= overdueDate;
    });
    const unpaidUnitIds = new Set(overdue30Days.map((b: { unit_id: string }) => b.unit_id));
    if (unpaidUnitIds.size === 0) continue;

    const { data: owners } = await admin.from("unit_owners").select("unit_id, owner_id").in("unit_id", [...unpaidUnitIds]);
    const { data: assignments } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", [...unpaidUnitIds]);

    const billToMap = new Map<string, string>();
    (owners ?? []).forEach((r: { unit_id: string; owner_id: string }) => { if (!billToMap.has(r.unit_id)) billToMap.set(r.unit_id, r.owner_id); });
    (assignments ?? []).forEach((a: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }) => {
      if (a.is_payment_responsible === true) billToMap.set(a.unit_id, a.tenant_id);
    });
    const notifyUserIds = new Set<string>();
    billToMap.forEach(uid => notifyUserIds.add(uid));

    const { count } = await notifyUsers(
      admin,
      managerId,
      notifyUserIds,
      "Overdue: Please pay your bills",
      "You have unpaid maintenance bills. Please log in to view and pay to avoid late fees."
    );
    totalRecipients += count;
  }

  return NextResponse.json({ success: true, sitesProcessed: sites.length, totalRecipients });
}
