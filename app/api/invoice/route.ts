import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { t } from "@/lib/i18n";

export const maxDuration = 60;
import PDFDocument from "pdfkit";
import path from "path";
import fs from "fs";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}


type InvoiceSite = { id?: string; name?: string; address?: string; vat_account?: string; bank_name?: string; iban?: string; swift_code?: string; tax_amount?: number | null; manager_id?: string } | null;

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

    const { data: userProfile } = await admin.from("profiles").select("locale").eq("id", user.id).single();
    const locale: "en" | "al" = (userProfile as { locale?: string } | null)?.locale === "al" ? "al" : "en";

    let bills: { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; paid_at: string | null; reference_code?: string }[];
    let site: InvoiceSite = null;
    let ownerProfile: { name?: string; surname?: string; email?: string } | null = null;
    let billToName = "Owner";
    let billToRole: "Owner" | "Tenant" = "Owner";
    let billToEmail: string | null = null;
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
      if (payerProfile) {
        billToName = `${(payerProfile as { name: string }).name} ${(payerProfile as { surname: string }).surname}`;
        billToEmail = (payerProfile as { email?: string }).email ?? null;
      }
      billToRole = (myOwnerUnits.length && payerId === user.id) ? "Owner" : "Tenant";
      const unitIdsUsed = [...new Set(bills.map(b => b.unit_id))];
      const units = (await admin.from("units").select("id, unit_name, building_id, size_m2").in("id", unitIdsUsed)).data ?? [];
      const buildIds = [...new Set(units.map((u: { building_id: string }) => u.building_id))];
      const buildings = (await admin.from("buildings").select("id, name, site_id").in("id", buildIds)).data ?? [];
      buildings.forEach((b: { id: string; name: string; site_id: string }) => { buildingMap.set(b.id, b.name); });
      const firstSiteId = (buildings[0] as { site_id: string })?.site_id;
      if (firstSiteId) {
        const minimalRes = await admin.from("sites").select("id, name, address, manager_id").eq("id", firstSiteId).single();
        const fullRes = await admin.from("sites").select("id, name, address, vat_account, bank_name, iban, swift_code, tax_amount, manager_id").eq("id", firstSiteId).single();
        site = (fullRes.error ? minimalRes : fullRes).data as InvoiceSite;
      }
    } else {
      const { data: bill, error: billErr } = await admin.from("bills")
        .select("id, unit_id, period_month, period_year, total_amount, paid_at, reference_code")
        .eq("id", billId!).single();
      if (billErr || !bill) return NextResponse.json({ error: "Bill not found" }, { status: 404 });
      const { data: ownership } = await admin.from("unit_owners").select("unit_id").eq("owner_id", user.id).eq("unit_id", bill.unit_id).single();
      if (!ownership) return NextResponse.json({ error: "You do not own this unit" }, { status: 403 });
      bills = [bill as (typeof bills)[0]];
      const { data: unit } = await admin.from("units").select("id, unit_name, building_id, size_m2").eq("id", bill.unit_id).single();
      if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
      const { data: building } = await admin.from("buildings").select("id, name, site_id").eq("id", (unit as { building_id: string }).building_id).single();
      if (building?.site_id) {
        const sid = (building as { site_id: string }).site_id;
        const fullRes = await admin.from("sites").select("id, name, address, vat_account, bank_name, iban, swift_code, tax_amount, manager_id").eq("id", sid).single();
        const minimalRes = await admin.from("sites").select("id, name, address, manager_id").eq("id", sid).single();
        site = (fullRes.error ? minimalRes : fullRes).data as InvoiceSite;
        buildingMap.set((building as { id: string }).id, (building as { name: string }).name ?? "");
      }
      ownerProfile = (await admin.from("profiles").select("name, surname, email").eq("id", user.id).single()).data;
      if (ownerProfile) {
        billToName = `${ownerProfile.name} ${ownerProfile.surname}`;
        billToEmail = ownerProfile.email ?? null;
      }
      billToRole = "Owner";
    }

    const billIds = bills.map(b => b.id);
    const { data: allBillLines } = await admin.from("bill_lines").select("bill_id, line_type, reference_id, description, amount").in("bill_id", billIds);
    const billLinesByBill = new Map<string, { line_type: string; reference_id: string | null; description: string; amount: number }[]>();
    (allBillLines ?? []).forEach((l: { bill_id: string; line_type: string; reference_id: string | null; description: string; amount: number }) => {
      const list = billLinesByBill.get(l.bill_id) ?? [];
      list.push({ line_type: l.line_type, reference_id: l.reference_id, description: l.description, amount: Number(l.amount) });
      billLinesByBill.set(l.bill_id, list);
    });

    const serviceIds = [...new Set((allBillLines ?? [])
      .filter((l: { line_type: string; reference_id: string | null }) => l.line_type === "service" && l.reference_id)
      .map((l: { reference_id: string }) => l.reference_id))];
    const { data: services } = await admin.from("services").select("id, name, pricing_model, price_value").in("id", serviceIds);
    const serviceMap = new Map<string, { name: string; pricing_model: string; price_value: number }>();
    (services ?? []).forEach((s: { id: string; name: string; pricing_model: string; price_value: number }) => {
      serviceMap.set(s.id, { name: s.name, pricing_model: s.pricing_model, price_value: Number(s.price_value) });
    });

    const unitMapForPdf = new Map<string, { unit_name: string; size_m2: number | null }>();
    const allUnitIds = [...new Set(bills.map(b => b.unit_id))];
    const unitsForPdf = (await admin.from("units").select("id, unit_name, size_m2").in("id", allUnitIds)).data ?? [];
    unitsForPdf.forEach((u: { id: string; unit_name: string; size_m2: number | null }) => {
      unitMapForPdf.set(u.id, { unit_name: u.unit_name, size_m2: u.size_m2 != null ? Number(u.size_m2) : null });
    });

    let managerProfile: { name?: string; surname?: string; email?: string; phone?: string } | null = null;
    if (site?.manager_id) {
      managerProfile = (await admin.from("profiles").select("name, surname, email, phone").eq("id", site.manager_id).single()).data;
    }

    const monthName = t(locale, `common.month${bills[0].period_month}`);
    const periodLabel = `${monthName} ${bills[0].period_year}`;
    const periodShort = `${monthName.slice(0, 3)}${String(bills[0].period_year).slice(-2)}`;
    const subtotal = bills.reduce((s, b) => s + Number(b.total_amount), 0);
    const taxPct = site?.tax_amount != null ? Number(site.tax_amount) : 0;
    const taxAmount = Math.round((subtotal * taxPct / 100) * 100) / 100;
    const grandTotal = Math.round((subtotal + taxAmount) * 100) / 100;
    const allPaid = bills.every(b => b.paid_at);
    const paidDate = allPaid && bills[0].paid_at ? new Date(bills[0].paid_at).toLocaleDateString(locale === "al" ? "sq-AL" : "en-GB") : null;

    const payerId = consolidated ? (paymentResponsibleId ?? user.id) : user.id;
    const siteId = site?.id ?? null;
    const siteCode = (site?.name ?? "SITE").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6) || "SITE";

    let refCode: string;
    if (siteId) {
      const { data: existing } = await admin.from("invoice_references")
        .select("reference_code")
        .eq("site_id", siteId)
        .eq("period_month", bills[0].period_month)
        .eq("period_year", bills[0].period_year)
        .eq("payment_responsible_id", payerId)
        .maybeSingle();
      if (existing?.reference_code) {
        refCode = (existing as { reference_code: string }).reference_code;
      } else {
        const { data: seqResult } = await admin.rpc("get_next_invoice_number", { p_site_id: siteId });
        const seq = (seqResult as number) ?? 1;
        refCode = `INV-${siteCode}-${periodShort}-${String(seq).padStart(4, "0")}`;
        const { error: insErr } = await admin.from("invoice_references").insert({
          site_id: siteId,
          period_month: bills[0].period_month,
          period_year: bills[0].period_year,
          payment_responsible_id: payerId,
          reference_code: refCode,
        }).select("reference_code").single();
        if (insErr?.code === "23505") {
          const { data: retry } = await admin.from("invoice_references")
            .select("reference_code")
            .eq("site_id", siteId)
            .eq("period_month", bills[0].period_month)
            .eq("period_year", bills[0].period_year)
            .eq("payment_responsible_id", payerId)
            .single();
          refCode = (retry as { reference_code: string })?.reference_code ?? refCode;
        }
      }
    } else {
      refCode = consolidated ? `INV-${periodShort}-${bills[0].id.slice(0, 6).toUpperCase()}` : (bills[0] as { reference_code?: string }).reference_code ?? `BILL-${bills[0].id.slice(0, 8).toUpperCase()}`;
    }
    const issuedDate = new Date();
    const dueDate = new Date(issuedDate);
    dueDate.setMonth(dueDate.getMonth() + 1);

    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));

    let y = 50;
    const pageWidth = doc.page.width - 100;

const logoPath = path.join(process.cwd(), "public", "domio-icon.webp");
  const logoPathFallback = path.join(process.cwd(), "public", "domio-logo.webp");
    if (fs.existsSync(logoPath)) {
      doc.image(logoPath, 50, y, { width: 60 });
    } else if (fs.existsSync(logoPathFallback)) {
      doc.image(logoPathFallback, 50, y, { width: 100 });
    }
    doc.fontSize(22).fillColor("black").text(t(locale, "invoice.title"), 50, y, { width: pageWidth, align: "right" });
    y += 55;
    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke("#e5e5e5");
    y += 18;

    doc.fontSize(10);
    doc.font("Helvetica-Bold").text(t(locale, "invoice.issuedBy"), 50, y);
    doc.font("Helvetica");
    y += 14;
    doc.text(t(locale, "invoice.site"), 50, y);
    doc.text(site?.name ?? "—", 120, y);
    y += 12;
    doc.text(t(locale, "invoice.address"), 50, y);
    doc.text(site?.address ?? "—", 120, y);
    y += 12;
    doc.text(t(locale, "invoice.manager"), 50, y);
    const managerName = managerProfile ? (`${managerProfile.name ?? ""} ${managerProfile.surname ?? ""}`.trim() || "—") : "—";
    doc.text(managerName, 120, y);
    y += 12;
    doc.text(t(locale, "invoice.vat"), 50, y);
    doc.text(site?.vat_account ?? "—", 120, y);
    y += 12;
    doc.text(t(locale, "invoice.email"), 50, y);
    doc.text(managerProfile?.email ?? "—", 120, y);
    y += 12;
    doc.text(t(locale, "invoice.phone"), 50, y);
    doc.text(managerProfile?.phone ?? "—", 120, y);
    y += 18;

    doc.font("Helvetica-Bold").text(t(locale, "invoice.billingPeriod"), 50, y);
    doc.font("Helvetica").text(periodLabel, 150, y);
    doc.font("Helvetica-Bold").text(t(locale, "invoice.issuedDate"), 280, y);
    doc.font("Helvetica").text(issuedDate.toLocaleDateString(locale === "al" ? "sq-AL" : "en-GB"), 360, y);
    y += 14;
    doc.font("Helvetica-Bold").text(t(locale, "invoice.reference"), 50, y);
    doc.font("Helvetica").text(refCode, 150, y);
    y += 28;

    const billToRoleLabel = billToRole === "Owner" ? t(locale, "common.owner") : t(locale, "common.tenant");
    doc.font("Helvetica-Bold").text(t(locale, "invoice.billTo"), 50, y);
    doc.font("Helvetica").text(`${billToName} (${billToRoleLabel})`, 150, y);
    y += 14;
    if (billToEmail) { doc.text(billToEmail, 50, y); y += 6; }
    y += 12;

    doc.font("Helvetica-Bold").text(t(locale, "invoice.itemizedBill"), 50, y);
    y += 18;

    const itemizedRows: { desc: string; qty: string; price: string; amt: string }[] = [];
    for (const b of bills) {
      const unitInfo = unitMapForPdf.get(b.unit_id);
      const unitName = unitInfo?.unit_name ?? "—";
      const lines = billLinesByBill.get(b.id) ?? [];
      for (const line of lines) {
        if (line.line_type === "service" && line.reference_id) {
          const svc = serviceMap.get(line.reference_id);
          const isPerM2 = svc?.pricing_model === "per_m2";
          const qty = isPerM2 ? (unitInfo?.size_m2 ?? 0) : 1;
          const price = svc?.price_value ?? 0;
          const amt = line.amount;
          const desc = (svc?.name ?? line.description) + (unitName ? ` · ${unitName}` : "");
          const qtyStr = isPerM2 ? `${qty}m²` : String(qty);
          itemizedRows.push({ desc, qty: qtyStr, price: price.toFixed(2), amt: amt.toFixed(2) });
        } else if (line.line_type === "expense") {
          itemizedRows.push({ desc: `${line.description} · ${unitName}`, qty: "1", price: line.amount.toFixed(2), amt: line.amount.toFixed(2) });
        } else {
          itemizedRows.push({ desc: `${line.description} · ${unitName}`, qty: "1", price: line.amount.toFixed(2), amt: line.amount.toFixed(2) });
        }
      }
    }

    if (itemizedRows.length) {
      const colDesc = 50;
      const colQty = 280;
      const colPrice = 330;
      const colAmt = 420;
      doc.fontSize(9).fillColor("#666666");
      doc.text(t(locale, "invoice.description"), colDesc, y);
      doc.text(t(locale, "invoice.qty"), colQty, y);
      doc.text(t(locale, "invoice.price"), colPrice, y);
      doc.text(t(locale, "invoice.amount"), colAmt, y);
      y += 14;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke("#e5e5e5");
      y += 12;
      doc.fillColor("black");
      for (const row of itemizedRows) {
        doc.text(row.desc, colDesc, y, { width: 220 });
        doc.text(row.qty, colQty, y);
        doc.text(row.price, colPrice, y);
        doc.text(row.amt, colAmt, y);
        y += 14;
      }
      y += 8;
    } else {
      bills.forEach(b => {
        const unitName = unitMapForPdf.get(b.unit_id)?.unit_name ?? "—";
        doc.text(`  ${unitName}: ${Number(b.total_amount).toFixed(2)}`, 50, y);
        y += 14;
      });
      y += 8;
    }

    doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke("#e5e5e5");
    y += 14;
    doc.font("Helvetica").text(t(locale, "invoice.subtotal"), 50, y);
    doc.text(subtotal.toFixed(2), 420, y, { align: "right", width: 80 });
    y += 16;
    doc.text(t(locale, "invoice.tax", { pct: String(taxPct) }), 50, y);
    doc.text(taxAmount.toFixed(2), 420, y, { align: "right", width: 80 });
    y += 16;
    doc.font("Helvetica-Bold").text(t(locale, "invoice.grandTotal"), 50, y);
    doc.text(grandTotal.toFixed(2), 420, y, { align: "right", width: 80 });
    y += 24;

    doc.font("Helvetica-Bold").text(t(locale, "invoice.bankSection"), 50, y);
    doc.font("Helvetica");
    y += 14;
    doc.text(t(locale, "invoice.bankName"), 50, y);
    doc.text(site?.bank_name ?? "—", 120, y);
    y += 12;
    doc.text(t(locale, "invoice.iban"), 50, y);
    doc.text(site?.iban ?? "—", 120, y);
    y += 12;
    doc.text(t(locale, "invoice.swift"), 50, y);
    doc.text(site?.swift_code ?? "—", 120, y);
    y += 12;
    doc.text(t(locale, "invoice.paymentMethod", { ref: refCode }), 50, y);
    y += 24;

    doc.font("Helvetica-Bold").text(t(locale, "invoice.paymentDueDate"), 50, y);
    doc.font("Helvetica").text(dueDate.toLocaleDateString(locale === "al" ? "sq-AL" : "en-GB") + " (" + t(locale, "invoice.dueDateNote") + ")", 200, y);
    y += 20;

    doc.fontSize(9).fillColor("#999999").text(
      allPaid && paidDate ? t(locale, "invoice.paidOn", { date: paidDate }) : t(locale, "invoice.statusUnpaid"),
      50, y, { align: "center", width: pageWidth }
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
