import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

// POST /api/manager/log-audit - Manager logs an audit entry (e.g. from client-side unit create/update/delete)
export async function POST(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Manager only" }, { status: 403 });

    const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
    const siteId = site?.id ?? undefined;

    const body = await request.json();
    const { action, entity_type, entity_id, entity_label, old_values, new_values } = body;
    if (!action || !entity_type) return NextResponse.json({ error: "action and entity_type required" }, { status: 400 });

    await logAudit({
      user_id: user.id,
      user_email: user.email ?? undefined,
      action: String(action),
      entity_type: String(entity_type),
      entity_id: entity_id != null ? String(entity_id) : undefined,
      entity_label: entity_label != null ? String(entity_label) : undefined,
      site_id: siteId,
      old_values: typeof old_values === "object" ? old_values : undefined,
      new_values: typeof new_values === "object" ? new_values : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
