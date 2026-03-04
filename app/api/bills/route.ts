import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Mark bill paid or unpaid (status can change anytime). Also supports bulk: { ownerId, periodMonth, periodYear, paid }
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { billId, paid, ownerId, periodMonth, periodYear } = body;

    const sb = adminClient();

    if (ownerId != null && periodMonth != null && periodYear != null) {
      // Bulk: mark all bills for owner+period (status can change anytime)
      if (typeof paid !== "boolean") return NextResponse.json({ success: false, error: "paid required for bulk" }, { status: 400 });
      const { data: unitOwners } = await sb.from("unit_owners").select("unit_id").eq("owner_id", ownerId);
      const unitIds = (unitOwners ?? []).map((u: { unit_id: string }) => u.unit_id);
      if (!unitIds.length) return NextResponse.json({ success: false, error: "No units for owner" }, { status: 404 });
      const update = paid ? { paid_at: new Date().toISOString(), status: "paid" } : { paid_at: null, status: "draft" };
      const { error } = await sb.from("bills").update(update).in("unit_id", unitIds).eq("period_month", periodMonth).eq("period_year", periodYear);
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
      return NextResponse.json({ success: true });
    }

    if (!billId) return NextResponse.json({ success: false, error: "Missing billId" }, { status: 400 });
    const { data: bill, error: fetchErr } = await sb.from("bills").select("id").eq("id", billId).single();
    if (fetchErr || !bill) return NextResponse.json({ success: false, error: "Bill not found" }, { status: 404 });
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
