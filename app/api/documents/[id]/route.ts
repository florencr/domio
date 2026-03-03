import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function requireManager() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "manager") return { ok: false as const, status: 403, error: "Manager only" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
  const siteId = (site as { id: string } | null)?.id ?? null;
  return { ok: true as const, admin, siteId };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { id } = await context.params;

    const { data: doc, error } = await admin.from("documents").select("id,path,building_id").eq("id", id).single();
    if (error || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: building } = await admin.from("buildings").select("site_id").eq("id", (doc as { building_id: string }).building_id).single();
    if (!building || (building as { site_id: string }).site_id !== siteId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const { data: urlData } = await admin.storage.from("documents").createSignedUrl((doc as { path: string }).path, 3600);
    if (!urlData?.signedUrl) return NextResponse.json({ error: "Failed to generate URL" }, { status: 500 });
    return NextResponse.json({ url: urlData.signedUrl });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { id } = await context.params;

    const { data: doc, error: fetchErr } = await admin.from("documents").select("path,building_id").eq("id", id).single();
    if (fetchErr || !doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { data: building } = await admin.from("buildings").select("site_id").eq("id", (doc as { building_id: string }).building_id).single();
    if (!building || (building as { site_id: string }).site_id !== siteId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    await admin.storage.from("documents").remove([(doc as { path: string }).path]);
    await admin.from("documents").delete().eq("id", id);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
