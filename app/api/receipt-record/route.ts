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
      // Consolidated: owner (per unit membership) can upload for payer on their units; tenant only for self as payer.
      let unitIds: string[] = [];
      const { data: ownerMem } = await admin
        .from("unit_memberships")
        .select("unit_id")
        .eq("user_id", user.id)
        .eq("role", "owner")
        .eq("status", "active");
      let ownerUnitIds = (ownerMem ?? []).map((u: { unit_id: string }) => u.unit_id);
      if (!ownerUnitIds.length) {
        const { data: legacyO } = await admin.from("unit_owners").select("unit_id").eq("owner_id", user.id);
        ownerUnitIds = (legacyO ?? []).map((u: { unit_id: string }) => u.unit_id);
      }
      const { data: tenantMem } = await admin
        .from("unit_memberships")
        .select("unit_id")
        .eq("user_id", user.id)
        .eq("role", "tenant")
        .eq("status", "active");
      let tenantUnitIds = (tenantMem ?? []).map((u: { unit_id: string }) => u.unit_id);
      if (!tenantUnitIds.length) {
        const { data: legacyT } = await admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", user.id);
        tenantUnitIds = (legacyT ?? []).map((u: { unit_id: string }) => u.unit_id);
      }
      const paymentResponsibleId = body.paymentResponsibleId ?? user.id;
      const unitPayerMap = new Map<string, string>();
      if (ownerUnitIds.length) {
        const { data: asn } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", ownerUnitIds.length ? ownerUnitIds : ["__none__"]);
        (asn ?? []).forEach((a: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }) => {
          if (!unitPayerMap.has(a.unit_id) && a.is_payment_responsible !== false) unitPayerMap.set(a.unit_id, a.tenant_id);
          else if (a.is_payment_responsible === true) unitPayerMap.set(a.unit_id, a.tenant_id);
        });
        unitIds.push(...ownerUnitIds.filter((uid: string) => (unitPayerMap.get(uid) ?? user.id) === paymentResponsibleId));
      }
      if (tenantUnitIds.length && paymentResponsibleId === user.id) {
        const { data: asn } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible").in("unit_id", tenantUnitIds.length ? tenantUnitIds : ["__none__"]);
        const tpm = new Map<string, string>();
        (asn ?? []).forEach((a: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }) => {
          if (!tpm.has(a.unit_id) && a.is_payment_responsible !== false) tpm.set(a.unit_id, a.tenant_id);
          else if (a.is_payment_responsible === true) tpm.set(a.unit_id, a.tenant_id);
        });
        unitIds.push(...tenantUnitIds.filter((uid: string) => tpm.get(uid) === user.id));
      } else if (tenantUnitIds.length && paymentResponsibleId !== user.id && !ownerUnitIds.length) {
        return NextResponse.json({ error: "Tenant can only upload for their own bills" }, { status: 403 });
      }
      unitIds = [...new Set(unitIds)];
      if (!unitIds.length) return NextResponse.json({ error: "No bills for this period" }, { status: 403 });
      const { data: urlData } = admin.storage.from("payment-slips").getPublicUrl(receipt_path);
      const update = { receipt_url: urlData.publicUrl, receipt_filename: receipt_filename ?? receipt_path, receipt_path, status: "in_process" };
      const { error: upErr } = await admin.from("bills").update(update).in("unit_id", unitIds).eq("period_month", periodMonth).eq("period_year", periodYear);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (!billId) return NextResponse.json({ error: "Missing billId or periodMonth+periodYear" }, { status: 400 });
    const { data: bill, error: billErr } = await admin.from("bills").select("id, unit_id").eq("id", billId).single();
    if (billErr || !bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });

    const [ownerMem, tenantMem, ownerRes, tenantRes] = await Promise.all([
      admin.from("unit_memberships").select("unit_id").eq("user_id", user.id).eq("unit_id", bill.unit_id).eq("role", "owner").eq("status", "active"),
      admin.from("unit_memberships").select("unit_id").eq("user_id", user.id).eq("unit_id", bill.unit_id).eq("role", "tenant").eq("status", "active"),
      admin.from("unit_owners").select("unit_id").eq("owner_id", user.id).eq("unit_id", bill.unit_id),
      admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", user.id).eq("unit_id", bill.unit_id).eq("is_payment_responsible", true),
    ]);
    const isOwner = (ownerMem.data ?? []).length > 0 || (ownerRes.data ?? []).length > 0;
    const isTenant = (tenantMem.data ?? []).length > 0 || (tenantRes.data ?? []).length > 0;
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
