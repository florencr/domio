import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };
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
    const { name, address } = await request.json();

    const updates: { name?: string; address?: string } = {};
    if (name !== undefined) updates.name = name.trim();
    if (address !== undefined) updates.address = address.trim();

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "name or address required" }, { status: 400 });
    }

    const updateResult = await admin.from("sites").update(updates).eq("id", id);
    if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "update",
      entity_type: "site",
      entity_id: id,
      entity_label: name ?? updates.name ?? id,
      site_id: id,
      new_values: updates,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
