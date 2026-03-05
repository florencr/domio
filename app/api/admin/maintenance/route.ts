import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

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
  if ((profile as { role?: string } | null)?.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };
  return { ok: true as const, admin };
}

export async function GET() {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;
    try {
      const { data, error } = await admin.rpc("admin_get_delete_lock_state");
      if (error) throw error;
      return NextResponse.json({ deleteLocksEnabled: (data as { enabled?: boolean })?.enabled ?? true });
    } catch (rpcErr) {
      return NextResponse.json({ deleteLocksEnabled: true });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;
    const body = await request.json().catch(() => ({}));
    const action = (body.action as string) || "";

    if (action === "toggle") {
      const enabled = body.enabled as boolean | undefined;
      const { data, error } = await admin.rpc("admin_set_delete_locks", { p_enabled: enabled });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, enabled: (data as { enabled?: boolean })?.enabled });
    }

    if (action === "clear") {
      const siteId = body.siteId as string | undefined;
      if (!siteId || typeof siteId !== "string") {
        return NextResponse.json({ error: "Select a site to clear." }, { status: 400 });
      }
      const { data, error } = await admin.rpc("admin_clear_site_data", { p_site_id: siteId });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const result = data as { success?: boolean; error?: string } | null;
      if (result && result.success === false) {
        return NextResponse.json({ error: result.error || "Clear failed" }, { status: 400 });
      }
      return NextResponse.json({ success: true });
    }

    if (action === "clearExpenses") {
      const siteId = body.siteId as string | undefined;
      if (!siteId || typeof siteId !== "string") {
        return NextResponse.json({ error: "Select a site." }, { status: 400 });
      }
      try {
        const { data, error } = await admin.rpc("admin_clear_site_expenses", { p_site_id: siteId });
        if (error) return NextResponse.json({ error: error.message }, { status: 500 });
        const result = data as { success?: boolean; error?: string } | null;
        if (result && result.success === false) {
          return NextResponse.json({ error: result.error || "Clear failed" }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      } catch (rpcErr) {
        return NextResponse.json({ error: "Function admin_clear_site_expenses may not exist. Run migration 052." }, { status: 500 });
      }
    }

    return NextResponse.json({ error: "Invalid action. Use toggle, clear, or clearExpenses." }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
