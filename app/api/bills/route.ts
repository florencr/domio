import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { notifyUsers } from "@/lib/notify-users";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

async function notifyBillPaid(admin: ReturnType<typeof adminClient>, createdBy: string, unitIds: string[], periodMonth: number, periodYear: number) {
  if (unitIds.length === 0) return;
  const { data: owners } = await admin.from("unit_owners").select("unit_id, owner_id").in("unit_id", unitIds);
  const { data: assignments } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", unitIds);
  const billToMap = new Map<string, string>();
  (owners ?? []).forEach((r: { unit_id: string; owner_id: string }) => { if (!billToMap.has(r.unit_id)) billToMap.set(r.unit_id, r.owner_id); });
  (assignments ?? []).forEach((a: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }) => {
    if (a.is_payment_responsible === true) billToMap.set(a.unit_id, a.tenant_id);
  });
  const userIds = new Set<string>();
  billToMap.forEach(uid => userIds.add(uid));
  const monthName = MONTHS[periodMonth - 1] ?? String(periodMonth);
  await notifyUsers(admin, createdBy, userIds, "Payment recorded", `Your payment for ${monthName} ${periodYear} has been recorded. Thank you.`);
}

// Mark bill paid or unpaid (status can change anytime). Also supports bulk: { ownerId, periodMonth, periodYear, paid }
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { billId, paid, ownerId, periodMonth, periodYear } = body;

    const sb = adminClient();
    const serverSb = await createServerClient();
    const { data: { user } } = await serverSb.auth.getUser();
    const createdBy = user?.id;

    if (ownerId != null && periodMonth != null && periodYear != null) {
      // Bulk: mark all bills for owner+period (status can change anytime)
      if (typeof paid !== "boolean") return NextResponse.json({ success: false, error: "paid required for bulk" }, { status: 400 });
      const { data: unitOwners } = await sb.from("unit_owners").select("unit_id").eq("owner_id", ownerId);
      const unitIds = (unitOwners ?? []).map((u: { unit_id: string }) => u.unit_id);
      if (!unitIds.length) return NextResponse.json({ success: false, error: "No units for owner" }, { status: 404 });
      const update = paid
        ? { paid_at: new Date().toISOString(), status: "paid" }
        : { paid_at: null, status: "draft", receipt_url: null, receipt_filename: null, receipt_path: null };
      const { error } = await sb.from("bills").update(update).in("unit_id", unitIds).eq("period_month", periodMonth).eq("period_year", periodYear);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      if (paid && createdBy) notifyBillPaid(sb, createdBy, unitIds, periodMonth, periodYear).catch(() => {});
      return NextResponse.json({ success: true });
    }

    if (!billId) return NextResponse.json({ success: false, error: "Missing billId" }, { status: 400 });
    const { data: bill, error: fetchErr } = await sb.from("bills").select("id, unit_id, period_month, period_year").eq("id", billId).single();
    if (fetchErr || !bill) return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 });
    const update = paid
      ? { paid_at: new Date().toISOString(), status: "paid" }
      : { paid_at: null, status: "draft", receipt_url: null, receipt_filename: null, receipt_path: null };
    const { error } = await sb.from("bills").update(update).eq("id", billId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    if (paid && createdBy) {
      const b = bill as { unit_id: string; period_month: number; period_year: number };
      notifyBillPaid(sb, createdBy, [b.unit_id], b.period_month, b.period_year).catch(() => {});
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
