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

// POST /api/receipt-record - record slip upload. Supports single billId or period (periodMonth, periodYear) for owner's consolidated upload
export async function POST(request: Request) {
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { billId, receipt_path, receipt_filename, periodMonth, periodYear } = body;
    if (!receipt_path) return NextResponse.json({ error: "receipt_path required" }, { status: 400 });

    const admin = adminClient();

    if (periodMonth != null && periodYear != null) {
      // Consolidated: record slip for bills. Owner can upload for any of their units (own or tenant's). Tenant can only upload for their own.
      let unitIds: string[] = [];
      const { data: ownerUnits } = await admin.from("unit_owners").select("unit_id").eq("owner_id", user.id);
      const ownerUnitIds = (ownerUnits ?? []).map((u: { unit_id: string }) => u.unit_id);
      const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
      const paymentResponsibleId = body.paymentResponsibleId ?? user.id;
      let unitPayerMap = new Map<string, string>();
      if (profile?.role === "owner") {
        const { data: asn } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", ownerUnitIds.length ? ownerUnitIds : ["__none__"]);
        (asn ?? []).forEach((a: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }) => {
          if (!unitPayerMap.has(a.unit_id) && a.is_payment_responsible !== false) unitPayerMap.set(a.unit_id, a.tenant_id);
          else if (a.is_payment_responsible === true) unitPayerMap.set(a.unit_id, a.tenant_id);
        });
        unitIds = ownerUnitIds.filter((uid: string) => (unitPayerMap.get(uid) ?? user.id) === paymentResponsibleId);
      } else {
        if (paymentResponsibleId !== user.id) return NextResponse.json({ error: "Tenant can only upload for their own bills" }, { status: 403 });
        const { data: myAssignments } = await admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", user.id);
        const myUnitIds = (myAssignments ?? []).map((u: { unit_id: string }) => u.unit_id);
        const { data: asn } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", myUnitIds.length ? myUnitIds : ["__none__"]);
        (asn ?? []).forEach((a: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }) => {
          if (!unitPayerMap.has(a.unit_id) && a.is_payment_responsible !== false) unitPayerMap.set(a.unit_id, a.tenant_id);
          else if (a.is_payment_responsible === true) unitPayerMap.set(a.unit_id, a.tenant_id);
        });
        unitIds = myUnitIds.filter((uid: string) => unitPayerMap.get(uid) === user.id);
      }
      if (!unitIds.length) return NextResponse.json({ error: "No bills for this period" }, { status: 403 });
      const { data: urlData } = admin.storage.from("payment-slips").getPublicUrl(receipt_path);
      const update = { receipt_url: urlData.publicUrl, receipt_filename: receipt_filename ?? receipt_path, receipt_path, paid_at: new Date().toISOString(), status: "paid" };
      const { error: upErr } = await admin.from("bills").update(update).in("unit_id", unitIds).eq("period_month", periodMonth).eq("period_year", periodYear);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (!billId) return NextResponse.json({ error: "Missing billId or periodMonth+periodYear" }, { status: 400 });
    const { data: bill, error: billErr } = await admin.from("bills").select("id, unit_id").eq("id", billId).single();
    if (billErr || !bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

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
