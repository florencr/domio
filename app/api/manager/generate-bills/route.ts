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
    const { month: monthParam, year: yearParam } = body;
    const m = typeof monthParam === "number" ? monthParam : parseInt(String(monthParam), 10);
    const y = typeof yearParam === "number" ? yearParam : parseInt(String(yearParam), 10);
    if (!m || !y || m < 1 || m > 12) return NextResponse.json({ error: "Valid month and year required" }, { status: 400 });

    const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
    const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
    if (!buildingIds.length) return NextResponse.json({ error: "No buildings in your site" }, { status: 400 });

    const { data: units } = await admin.from("units").select("id, type, size_m2, building_id").in("building_id", buildingIds);
    if (!units?.length) return NextResponse.json({ error: "No units in your site" }, { status: 400 });

    const unitsList = units as { id: string; type: string; size_m2: number | null; building_id: string }[];

    const { data: existingBills } = await admin.from("bills").select("unit_id").eq("period_month", m).eq("period_year", y);
    const done = new Set((existingBills ?? []).map((b: { unit_id: string }) => b.unit_id));
    const toProcess = unitsList.filter(u => !done.has(u.id));
    if (!toProcess.length) return NextResponse.json({ error: "Bills already generated for this period", alreadyDone: true }, { status: 400 });

    const { data: expenses } = await admin.from("expenses").select("id, title, category, vendor, amount, frequency, site_id, building_id").or(`site_id.eq.${siteId},site_id.is.null`);
    const recurrentTemplates = (expenses ?? []).filter(
      (e: { frequency: string; template_id: string | null; period_month: number | null }) =>
        e.frequency === "recurrent" && !e.template_id && e.period_month == null
    );

    for (const t of recurrentTemplates) {
      const { data: existingExp } = await admin.from("expenses").select("id").eq("template_id", t.id).eq("period_month", m).eq("period_year", y).limit(1);
      if (!(existingExp?.length)) {
        const { error } = await admin.from("expenses").insert({
          title: (t as { title: string }).title,
          category: (t as { category: string }).category,
          vendor: (t as { vendor: string }).vendor,
          amount: Number((t as { amount: number }).amount),
          frequency: "recurrent",
          template_id: t.id,
          period_month: m,
          period_year: y,
          site_id: siteId,
          building_id: (t as { building_id?: string }).building_id ?? null,
        });
        if (error) return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    const { data: services } = await admin.from("services").select("id, name, unit_type, pricing_model, price_value, frequency").or(`site_id.eq.${siteId},site_id.is.null`);
    const recurrentServices = (services ?? []).filter((s: { frequency: string }) => s.frequency === "recurrent") as { id: string; name: string; unit_type: string; pricing_model: string; price_value: number }[];

    const rows: { unit_id: string; period_month: number; period_year: number; total_amount: number; status: string }[] = [];
    const linesByUnit = new Map<string, { line_type: string; reference_id: string | null; description: string; amount: number }[]>();

    for (const unit of toProcess) {
      const lines: { line_type: string; reference_id: string | null; description: string; amount: number }[] = [];
      let total = 0;

      for (const s of recurrentServices) {
        if (s.unit_type !== unit.type) continue;
        const amount = s.pricing_model === "per_m2" && unit.size_m2
          ? Number(s.price_value) * Number(unit.size_m2)
          : Number(s.price_value);
        lines.push({ line_type: "service", reference_id: s.id, description: s.name ?? "", amount: Math.round(amount * 100) / 100 });
        total += amount;
      }

      total = Math.round(total * 100) / 100;
      rows.push({ unit_id: unit.id, period_month: m, period_year: y, total_amount: total, status: "draft" });
      linesByUnit.set(unit.id, lines);
    }

    const { data: inserted, error } = await admin.from("bills").insert(rows).select("id, unit_id");
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const insertedBills = (inserted ?? []) as { id: string; unit_id: string }[];
    for (const bill of insertedBills) {
      const lines = linesByUnit.get(bill.unit_id) ?? [];
      for (const line of lines) {
        const { error: lineErr } = await admin.from("bill_lines").insert({
          bill_id: bill.id,
          line_type: line.line_type,
          reference_id: line.reference_id,
          description: line.description,
          amount: line.amount,
        });
        if (lineErr) return NextResponse.json({ error: "Bill line: " + lineErr.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true, count: insertedBills.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
