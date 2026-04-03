import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function requireManagerSite() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Unauthorized" };
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "manager") {
    return { ok: false as const, status: 403, error: "Managers only" };
  }
  const admin = adminClient();
  const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).maybeSingle();
  const siteId = (site as { id: string } | null)?.id ?? null;
  if (!siteId) return { ok: false as const, status: 400, error: "No site assigned" };
  return { ok: true as const, admin, siteId };
}

export async function POST(
  _request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { pollId } = await context.params;

    const { data: poll } = await admin
      .from("polls")
      .select("id,status")
      .eq("id", pollId)
      .eq("site_id", siteId)
      .maybeSingle();
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((poll as { status: string }).status !== "published") {
      return NextResponse.json({ error: "Only published polls can be closed" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from("polls")
      .update({ status: "closed", updated_at: now })
      .eq("id", pollId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
