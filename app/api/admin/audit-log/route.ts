import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function requireAdminOrManager() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "admin" && role !== "manager") return { ok: false as const, status: 403, error: "Admin or manager only" };
  return { ok: true as const, admin, user, role };
}

export async function GET(request: Request) {
  try {
    const r = await requireAdminOrManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, role } = r;
    let siteId: string | null = null;
    if (role === "manager") {
      const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
      siteId = (site as { id: string } | null)?.id ?? null;
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);
    const offset = parseInt(searchParams.get("offset") || "0", 10);
    const entityType = searchParams.get("entityType");
    const entityId = searchParams.get("entityId");

    let query = admin.from("audit_log").select("id,created_at,user_id,user_email,action,entity_type,entity_id,entity_label,old_values,new_values", { count: "exact" }).order("created_at", { ascending: false }).range(offset, offset + limit - 1);

    if (siteId) query = query.eq("site_id", siteId);
    if (entityType) query = query.eq("entity_type", entityType);
    if (entityId) query = query.eq("entity_id", entityId);

    const { data, error, count } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entries: data ?? [], total: count ?? 0 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
