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

export async function DELETE(request: Request) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId, user } = r;

    const { searchParams } = new URL(request.url);
    const m = parseInt(searchParams.get("month") ?? "", 10);
    const y = parseInt(searchParams.get("year") ?? "", 10);
    if (!m || !y || m < 1 || m > 12) return NextResponse.json({ error: "Valid month and year required" }, { status: 400 });

    const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
    const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
    const { data: units } = await admin.from("units").select("id").in("building_id", buildingIds);
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);

    let billsDeleted = 0;
    let expensesDeleted = 0;

    if (unitIds.length) {
      const { data: deletedBills } = await admin.from("bills").delete().eq("period_month", m).eq("period_year", y).in("unit_id", unitIds).select("id");
      billsDeleted = deletedBills?.length ?? 0;
    }

    const { data: deletedExpenses } = await admin.from("expenses").delete().eq("period_month", m).eq("period_year", y).eq("site_id", siteId).not("template_id", "is", null).select("id");
    expensesDeleted = deletedExpenses?.length ?? 0;

    await logAudit({
      user_id: user.id,
      user_email: user.email ?? undefined,
      action: "delete",
      entity_type: "bill",
      entity_label: `${m}/${y} – ${billsDeleted} bills, ${expensesDeleted} expenses`,
      site_id: siteId,
      meta: { billsDeleted, expensesDeleted },
    });

    return NextResponse.json({ success: true, billsDeleted, expensesDeleted });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
