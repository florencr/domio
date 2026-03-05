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
    const { title, category, vendor, amount, periodMonth, periodYear } = body;

    const t = typeof title === "string" ? title.trim() : "";
    if (!t) return NextResponse.json({ error: "Title is required" }, { status: 400 });

    const amt = typeof amount === "number" ? amount : parseFloat(String(amount || 0));
    if (isNaN(amt) || amt <= 0) return NextResponse.json({ error: "Amount must be positive" }, { status: 400 });

    const m = typeof periodMonth === "number" ? periodMonth : parseInt(String(periodMonth), 10);
    const y = typeof periodYear === "number" ? periodYear : parseInt(String(periodYear), 10);
    if (!m || !y || m < 1 || m > 12) return NextResponse.json({ error: "Valid month and year required" }, { status: 400 });

    const cat = typeof category === "string" ? category.trim() || "Misc" : "Misc";
    const vend = typeof vendor === "string" ? vendor.trim() || "—" : "—";

    const { data: exp, error: expErr } = await admin.from("expenses").insert({
      title: t,
      category: cat,
      vendor: vend,
      amount: amt,
      frequency: "ad_hoc",
      period_month: m,
      period_year: y,
      site_id: siteId,
    }).select("id").single();

    if (expErr || !exp) return NextResponse.json({ error: expErr?.message ?? "Failed to create expense" }, { status: 400 });

    const expenseId = (exp as { id: string }).id;

    return NextResponse.json({
      success: true,
      expenseId,
      message: "Expense recorded. Bills and expenses are managed separately.",
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
