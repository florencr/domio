import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return { ok: true as const, admin, user };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user } = r;
    const { id } = await context.params;
    const { name, site_id } = await request.json();

    const updates: { name?: string; site_id?: string | null } = {};
    if (name !== undefined) updates.name = name.trim();
    if (site_id !== undefined) updates.site_id = site_id || null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "name or site_id required" }, { status: 400 });
    }

    const { data: building } = await admin.from("buildings").select("site_id").eq("id", id).single();
    await admin.from("buildings").update(updates).eq("id", id);

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "update",
      entity_type: "building",
      entity_id: id,
      entity_label: updates.name,
      site_id: (building as { site_id?: string } | null)?.site_id,
      new_values: updates,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user } = r;
    const { id } = await context.params;

    const { data: building } = await admin.from("buildings").select("name,site_id").eq("id", id).single();
    await admin.from("buildings").delete().eq("id", id);

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "delete",
      entity_type: "building",
      entity_id: id,
      entity_label: (building as { name?: string } | null)?.name ?? id,
      site_id: (building as { site_id?: string } | null)?.site_id,
      old_values: building ?? undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
