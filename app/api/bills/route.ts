import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Mark bill paid or unpaid
export async function PATCH(request: Request) {
  try {
    const { billId, paid } = await request.json();
    if (!billId) return NextResponse.json({ success: false, error: "Missing billId" }, { status: 400 });
    const sb = adminClient();
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
