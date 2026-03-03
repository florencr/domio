import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return { ok: true as const, admin, user };
}

export async function POST(request: Request) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user } = r;
    const { site_id, name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json({ error: "name required" }, { status: 400 });
    }

    const { data, error } = await admin.from("buildings").insert({
      site_id: site_id || null,
      name: name.trim(),
    }).select("id").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    let auditSiteId: string | null = site_id || null;
    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "create",
      entity_type: "building",
      entity_id: data.id,
      entity_label: name.trim(),
      site_id: auditSiteId ?? undefined,
      new_values: { name: name.trim(), site_id: site_id || null },
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
