import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// GET /api/receipt?billId=xxx - returns signed URL to view the slip
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get("billId");
    if (!billId) return NextResponse.json({ error: "Missing billId" }, { status: 400 });

    const sb = adminClient();
    const { data: bill, error } = await sb.from("bills").select("receipt_path, receipt_url").eq("id", billId).single();
    if (error || !bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

    const path = bill.receipt_path;
    if (!path) {
      if (bill.receipt_url) {
        const m = bill.receipt_url.match(/\/payment-slips\/(.+)$/);
        const extractedPath = m?.[1];
        if (extractedPath) {
          const { data: signed } = await sb.storage.from("payment-slips").createSignedUrl(extractedPath, 3600);
          if (signed?.signedUrl) return NextResponse.redirect(signed.signedUrl);
        }
      }
      return NextResponse.json({ error: "No receipt found" }, { status: 404 });
    }

    const { data: signed, error: urlErr } = await sb.storage.from("payment-slips").createSignedUrl(path, 3600);
    if (urlErr || !signed?.signedUrl) return NextResponse.json({ error: urlErr?.message ?? "Could not get receipt" }, { status: 500 });
    return NextResponse.redirect(signed.signedUrl);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
