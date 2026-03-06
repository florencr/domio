import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

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
  return { ok: true as const, admin, siteId: site.id, user };
}

export async function POST(request: Request) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId, user } = r;

    const body = await request.json();
    const { month: monthParam, year: yearParam } = body;
    const m = typeof monthParam === "number" ? monthParam : parseInt(String(monthParam), 10);
    const y = typeof yearParam === "number" ? yearParam : parseInt(String(yearParam), 10);
    if (!m || !y || m < 1 || m > 12) return NextResponse.json({ error: "Valid month and year required" }, { status: 400 });

    const { data: expenses } = await admin.from("expenses").select("id, title, category, vendor, amount, frequency, site_id, building_id, template_id, period_month, period_year").or(`site_id.eq.${siteId},site_id.is.null`);
    const recurrentTemplates = (expenses ?? []).filter(
      (e: { frequency: string; template_id: string | null; period_month: number | null }) =>
        e.frequency === "recurrent" && !e.template_id && e.period_month == null
    );

    let count = 0;
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
        count++;
      }
    }

    await logAudit({
      user_id: user.id,
      user_email: user.email ?? undefined,
      action: "create",
      entity_type: "expense",
      entity_label: `${m}/${y} – ${count} recurrent expense(s)`,
      site_id: siteId,
      new_values: { period_month: m, period_year: y, count },
    });

    return NextResponse.json({ success: true, count });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
