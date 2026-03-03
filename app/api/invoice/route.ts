import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import PDFDocument from "pdfkit";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const billId = searchParams.get("billId");
    const periodMonth = searchParams.get("periodMonth");
    const periodYear = searchParams.get("periodYear");
    const paymentResponsibleId = searchParams.get("paymentResponsibleId");
    const consolidated = periodMonth != null && periodYear != null;
    if (!billId && !consolidated) return NextResponse.json({ error: "Missing billId or periodMonth+periodYear" }, { status: 400 });

    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();

    let bills: { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; paid_at: string | null; reference_code?: string }[];
    let site: { name?: string; address?: string; vat_account?: string } | null = null;
    let ownerProfile: { name?: string; surname?: string; email?: string } | null = null;
    let billToName = "Owner";
    const buildingMap = new Map<string, string>();

    if (consolidated) {
      const pm = parseInt(periodMonth!, 10), py = parseInt(periodYear!, 10);
      const payerId = paymentResponsibleId ?? user.id;
      const { data: allAssignments } = await admin.from("unit_tenant_assignments").select("unit_id, tenant_id, is_payment_responsible");
      const unitPayerMap = new Map<string, string>();
      (allAssignments ?? []).forEach((a: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }) => {
        if (!unitPayerMap.has(a.unit_id) && a.is_payment_responsible !== false) unitPayerMap.set(a.unit_id, a.tenant_id);
        else if (a.is_payment_responsible === true) unitPayerMap.set(a.unit_id, a.tenant_id);
      });
      let unitIds: string[] = [];
      const { data: ownerUnits } = await admin.from("unit_owners").select("unit_id").eq("owner_id", user.id);
      const myOwnerUnits = (ownerUnits ?? []).map((u: { unit_id: string }) => u.unit_id);
      const { data: tenantUnits } = await admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", user.id);
      const myTenantUnits = (tenantUnits ?? []).map((u: { unit_id: string }) => u.unit_id);
      if (payerId === user.id) {
        if (myOwnerUnits.length) unitIds = myOwnerUnits.filter((uid: string) => (unitPayerMap.get(uid) ?? user.id) === user.id);
        else unitIds = myTenantUnits.filter((uid: string) => unitPayerMap.get(uid) === user.id);
      } else {
        if (myOwnerUnits.length) unitIds = myOwnerUnits.filter((uid: string) => (unitPayerMap.get(uid) ?? user.id) === payerId);
        else return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      }
      if (!unitIds.length) return NextResponse.json({ error: "No bills for this period" }, { status: 404 });
      const { data: billsData } = await admin.from("bills")
        .select("id, unit_id, period_month, period_year, total_amount, paid_at, reference_code")
        .in("unit_id", unitIds).eq("period_month", pm).eq("period_year", py);
      bills = (billsData ?? []) as typeof bills;
      if (!bills.length) return NextResponse.json({ error: "No bills for this period" }, { status: 404 });
      const { data: payerProfile } = await admin.from("profiles").select("name, surname, email").eq("id", payerId).single();
      if (payerProfile) billToName = `${(payerProfile as { name: string }).name} ${(payerProfile as { surname: string }).surname}`;
      const unitIdsUsed = [...new Set(bills.map(b => b.unit_id))];
      const units = (await admin.from("units").select("id, unit_name, building_id").in("id", unitIdsUsed)).data ?? [];
      const buildIds = [...new Set(units.map((u: { building_id: string }) => u.building_id))];
      const buildings = (await admin.from("buildings").select("id, name, site_id").in("id", buildIds)).data ?? [];
      buildings.forEach((b: { id: string; name: string; site_id: string }) => { buildingMap.set(b.id, b.name); });
      const firstSiteId = (buildings[0] as { site_id: string })?.site_id;
      if (firstSiteId) site = (await admin.from("sites").select("name, address, vat_account").eq("id", firstSiteId).single()).data;
    } else {
      const { data: bill, error: billErr } = await admin.from("bills")
        .select("id, unit_id, period_month, period_year, total_amount, paid_at, reference_code")
        .eq("id", billId!).single();
      if (billErr || !bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      const { data: ownership } = await admin.from("unit_owners").select("unit_id").eq("owner_id", user.id).eq("unit_id", bill.unit_id).single();
      if (!ownership) return NextResponse.json({ error: "You do not own this unit" }, { status: 403 });
      bills = [bill as (typeof bills)[0]];
      const { data: unit } = await admin.from("units").select("id, unit_name, building_id").eq("id", bill.unit_id).single();
      if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
      const { data: building } = await admin.from("buildings").select("id, name, site_id").eq("id", (unit as { building_id: string }).building_id).single();
      if (building?.site_id) {
        site = (await admin.from("sites").select("name, address, vat_account").eq("id", (building as { site_id: string }).site_id).single()).data;
        buildingMap.set((building as { id: string }).id, (building as { name: string }).name ?? "");
      }
      ownerProfile = (await admin.from("profiles").select("name, surname, email").eq("id", user.id).single()).data;
      if (ownerProfile) billToName = `${ownerProfile.name} ${ownerProfile.surname}`;
    }

    const periodLabel = `${MONTHS[bills[0].period_month - 1]} ${bills[0].period_year}`;
    const totalAmount = bills.reduce((s, b) => s + Number(b.total_amount), 0);
    const allPaid = bills.every(b => b.paid_at);
    const paidDate = allPaid && bills[0].paid_at ? new Date(bills[0].paid_at).toLocaleDateString() : null;
    const refCode = consolidated ? `INV-${periodLabel.replace(" ", "")}` : (bills[0] as { reference_code?: string }).reference_code ?? `BILL-${bills[0].id.slice(0, 8).toUpperCase()}`;

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    doc.fontSize(20).text("INVOICE", { align: "center" });
    doc.moveDown(1);

    doc.fontSize(10);
    doc.text(site?.name ?? "Property Management", { continued: false });
    if (site?.address) doc.text(site.address);
    if (site?.vat_account) doc.text(`VAT: ${site.vat_account}`);
    doc.moveDown(1);

    doc.text("Bill to:", { underline: true });
    doc.text(billToName);
    if (ownerProfile?.email) doc.text(ownerProfile.email);
    doc.moveDown(1);

    doc.text(`Period: ${periodLabel}`);
    doc.text(`Invoice date: ${new Date().toLocaleDateString("en-GB")}`);
    doc.moveDown(1);

    doc.text("Description", { underline: true });
    const unitMapForPdf = new Map<string, string>();
    if (!consolidated) {
      const u = (await admin.from("units").select("id, unit_name").eq("id", bills[0].unit_id).single()).data;
      if (u) unitMapForPdf.set(bills[0].unit_id, (u as { unit_name: string }).unit_name);
    } else {
      const unitsForPdf = (await admin.from("units").select("id, unit_name").in("id", [...new Set(bills.map(b => b.unit_id))])).data ?? [];
      unitsForPdf.forEach((u: { id: string; unit_name: string }) => unitMapForPdf.set(u.id, u.unit_name));
    }
    bills.forEach(b => {
      const unitName = unitMapForPdf.get(b.unit_id) ?? "—";
      doc.text(`  ${unitName}: ${Number(b.total_amount).toFixed(2)}`);
    });
    doc.moveDown(0.5);
    doc.fontSize(14).text(`Total: ${totalAmount.toFixed(2)}`, { align: "right" });
    doc.moveDown(1);

    doc.fontSize(9).fillColor("gray").text(
      allPaid && paidDate ? `Paid on ${paidDate}` : "Status: Unpaid",
      { align: "center" }
    );

    const endPromise = new Promise<void>((resolve) => doc.on("end", () => resolve()));
    doc.end();
    await endPromise;
    const pdfBuffer = Buffer.concat(chunks);

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${refCode}.pdf"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
