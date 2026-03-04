import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Mark expense paid or unpaid (paid_at can change anytime)
export async function PATCH(request: Request) {
  try {
    const { expenseId, paid } = await request.json();
    if (!expenseId) return NextResponse.json({ success: false, error: "Missing expenseId" }, { status: 400 });
    const sb = adminClient();
    const { data: expense, error: fetchErr } = await sb.from("expenses").select("id").eq("id", expenseId).single();
    if (fetchErr || !expense) return NextResponse.json({ success: false, error: "Expense not found" }, { status: 404 });
    const update = paid ? { paid_at: new Date().toISOString() } : { paid_at: null };
    const { error } = await sb.from("expenses").update(update).eq("id", expenseId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
