import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

function isPeriodEditable(periodMonth: number, periodYear: number): boolean {
  const now = new Date();
  const curM = now.getMonth() + 1, curY = now.getFullYear();
  const prevM = curM === 1 ? 12 : curM - 1, prevY = curM === 1 ? curY - 1 : curY;
  return (periodMonth === curM && periodYear === curY) || (periodMonth === prevM && periodYear === prevY);
}

// Mark bill paid or unpaid. Also supports bulk: { ownerId, periodMonth, periodYear, paid }
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { billId, paid, ownerId, periodMonth, periodYear } = body;

    const sb = adminClient();

    if (ownerId != null && periodMonth != null && periodYear != null) {
      // Bulk: mark all bills for owner+period
      if (typeof paid !== "boolean") return NextResponse.json({ success: false, error: "paid required for bulk" }, { status: 400 });
      if (!isPeriodEditable(Number(periodMonth), Number(periodYear))) {
        return NextResponse.json({ success: false, error: "This billing period is locked." }, { status: 403 });
      }
      const { data: unitOwners } = await sb.from("unit_owners").select("unit_id").eq("owner_id", ownerId);
      const unitIds = (unitOwners ?? []).map((u: { unit_id: string }) => u.unit_id);
      if (!unitIds.length) return NextResponse.json({ success: false, error: "No units for owner" }, { status: 404 });
      const update = paid ? { paid_at: new Date().toISOString(), status: "paid" } : { paid_at: null, status: "draft" };
      const { error } = await sb.from("bills").update(update).in("unit_id", unitIds).eq("period_month", periodMonth).eq("period_year", periodYear);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (!billId) return NextResponse.json({ success: false, error: "Missing billId" }, { status: 400 });
    const { data: bill, error: fetchErr } = await sb.from("bills").select("period_month,period_year").eq("id", billId).single();
    if (fetchErr || !bill) return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 });
    if (!isPeriodEditable(bill.period_month, bill.period_year)) {
      return NextResponse.json({ success: false, error: "This billing period is locked. Only current month and previous month can be edited." }, { status: 403 });
    }
    const update = paid
      ? { paid_at: new Date().toISOString(), status: "paid" }
      : { paid_at: null, status: "draft" };
    const { error } = await sb.from("bills").update(update).eq("id", billId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
