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

export async function POST(request: Request) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;

    const { managerId, siteId } = await request.json();
    if (!managerId || !siteId) return NextResponse.json({ error: "managerId and siteId required" }, { status: 400 });

    const { data: managerProfile } = await admin.from("profiles").select("role").eq("id", managerId).single();
    if (!managerProfile || (managerProfile as { role: string }).role !== "manager") {
      return NextResponse.json({ error: "User is not a manager" }, { status: 400 });
    }

    const { data: site } = await admin.from("sites").select("id, manager_id").eq("id", siteId).single();
    if (!site) return NextResponse.json({ error: "Site not found" }, { status: 404 });

    const { data: oldSite } = await admin.from("sites").select("id").eq("manager_id", managerId).maybeSingle();
    if (oldSite?.id) {
      await admin.from("sites").update({ manager_id: null }).eq("id", oldSite.id);
    }
    const { error } = await admin.from("sites").update({ manager_id: managerId }).eq("id", siteId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
