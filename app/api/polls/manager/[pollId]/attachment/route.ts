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
  return { ok: true as const, admin, user, siteId };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { pollId } = await context.params;

    const { data: poll } = await admin
      .from("polls")
      .select("id,status,site_id,attachment_path")
      .eq("id", pollId)
      .eq("site_id", siteId)
      .maybeSingle();
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((poll as { status: string }).status !== "draft") {
      return NextResponse.json({ error: "Attachment can only be changed while draft" }, { status: 400 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file || !(file instanceof File)) return NextResponse.json({ error: "Missing file" }, { status: 400 });

    const prev = (poll as { attachment_path: string | null }).attachment_path;
    if (prev) await admin.storage.from("documents").remove([prev]);

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_") || "attachment";
    const path = `polls/${siteId}/${pollId}/${Date.now()}-${safeName}`;
    const buf = await file.arrayBuffer();
    const { error: upErr } = await admin.storage.from("documents").upload(path, buf, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    const { error: upRow } = await admin
      .from("polls")
      .update({
        attachment_path: path,
        attachment_filename: file.name,
        attachment_mime: file.type || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pollId);

    if (upRow) return NextResponse.json({ error: upRow.message }, { status: 500 });
    return NextResponse.json({ success: true, path });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
