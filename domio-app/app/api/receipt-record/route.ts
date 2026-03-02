import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// POST /api/receipt-record - record slip upload and set status to in_process (bypasses RLS)
export async function POST(request: Request) {
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { billId, receipt_path, receipt_filename } = body;
    if (!billId || !receipt_path) return NextResponse.json({ error: "Missing billId or receipt_path" }, { status: 400 });

    const admin = adminClient();
    const { data: bill, error: billErr } = await admin.from("bills").select("id, unit_id").eq("id", billId).single();
    if (billErr || !bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

    // Verify user is owner or tenant (payment responsible) for this bill's unit
    const [ownerRes, tenantRes] = await Promise.all([
      admin.from("unit_owners").select("unit_id").eq("owner_id", user.id).eq("unit_id", bill.unit_id),
      admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", user.id).eq("unit_id", bill.unit_id).eq("is_payment_responsible", true),
    ]);
    const isOwner = (ownerRes.data ?? []).length > 0;
    const isTenant = (tenantRes.data ?? []).length > 0;
    if (!isOwner && !isTenant) return NextResponse.json({ error: "Not authorized for this bill" }, { status: 403 });

    const { data: urlData } = admin.storage.from("payment-slips").getPublicUrl(receipt_path);
    const { error: upErr } = await admin.from("bills").update({
      receipt_url: urlData.publicUrl,
      receipt_filename: receipt_filename ?? receipt_path,
      receipt_path,
      status: "in_process",
    }).eq("id", billId);

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
