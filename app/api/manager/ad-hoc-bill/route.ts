import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function requireManager() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "manager") return { ok: false as const, status: 403, error: "Manager only" };
  const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
  if (!site?.id) return { ok: false as const, status: 403, error: "No site" };
  return { ok: true as const, admin, siteId: site.id };
}

export async function POST(request: Request) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;

    const body = await request.json();
    const {
      description,
      unitType,
      pricingModel,
      amount,
      periodMonth,
      periodYear,
    } = body;

    const desc = typeof description === "string" ? description.trim() : "";
    if (!desc) return NextResponse.json({ error: "Description is required" }, { status: 400 });

    const unitTypeFilter = typeof unitType === "string" ? unitType : "all";

    const pm = typeof pricingModel === "string" ? pricingModel : "fixed";
    if (pm !== "per_m2" && pm !== "fixed") return NextResponse.json({ error: "Pricing must be per_m2 or fixed" }, { status: 400 });

    const amt = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
    if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: "Amount must be a positive number" }, { status: 400 });

    const m = typeof periodMonth === "number" ? periodMonth : parseInt(String(periodMonth), 10);
    const y = typeof periodYear === "number" ? periodYear : parseInt(String(periodYear), 10);
    if (!m || !y || m < 1 || m > 12) return NextResponse.json({ error: "Valid month and year required" }, { status: 400 });

    const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
    const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
    if (!buildingIds.length) return NextResponse.json({ error: "No buildings in your site" }, { status: 400 });

    const { data: unitsData } = await admin.from("units").select("id, type, size_m2").in("building_id", buildingIds);
    const units = (unitsData ?? []) as { id: string; type: string; size_m2: number | null }[];

    const filtered = unitTypeFilter === "all" ? units : units.filter(u => u.type === unitTypeFilter);
    if (!filtered.length) return NextResponse.json({ error: "No units match the selected unit type" }, { status: 400 });

    let linesAdded = 0;
    let billsCreated = 0;

    for (const unit of filtered) {
      const lineAmount = pm === "per_m2"
        ? Math.round(amt * (unit.size_m2 ?? 0) * 100) / 100
        : Math.round(amt * 100) / 100;

      if (pm === "per_m2" && (unit.size_m2 == null || unit.size_m2 <= 0)) continue;

      const { data: existingBill } = await admin
        .from("bills")
        .select("id, total_amount")
        .eq("unit_id", unit.id)
        .eq("period_month", m)
        .eq("period_year", y)
        .maybeSingle();

      let billId: string;
      let currentTotal: number;

      if (existingBill) {
        billId = (existingBill as { id: string }).id;
        currentTotal = Number((existingBill as { total_amount: number }).total_amount);
      } else {
        const { data: newBill, error: insErr } = await admin
          .from("bills")
          .insert({ unit_id: unit.id, period_month: m, period_year: y, total_amount: 0, status: "draft" })
          .select("id")
          .single();
        if (insErr || !newBill) return NextResponse.json({ error: insErr?.message ?? "Failed to create bill" }, { status: 400 });
        billId = (newBill as { id: string }).id;
        currentTotal = 0;
        billsCreated++;
      }

      const newTotal = Math.round((currentTotal + lineAmount) * 100) / 100;

      const { error: lineErr } = await admin.from("bill_lines").insert({
        bill_id: billId,
        line_type: "manual",
        reference_id: null,
        description: desc,
        amount: lineAmount,
      });
      if (lineErr) return NextResponse.json({ error: "Bill line: " + lineErr.message }, { status: 400 });

      const { error: upErr } = await admin.from("bills").update({ total_amount: newTotal, updated_at: new Date().toISOString() }).eq("id", billId);
      if (upErr) return NextResponse.json({ error: "Bill update: " + upErr.message + " (period may be locked)" }, { status: 400 });

      linesAdded++;
    }

    return NextResponse.json({
      success: true,
      linesAdded,
      billsCreated,
      message: `Added ${linesAdded} ad hoc charge(s) to ${filtered.length} unit(s).`,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
