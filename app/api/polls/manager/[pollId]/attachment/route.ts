import { NextResponse } from "next/server";
import { requireManagerSite } from "@/lib/polls/require-manager-site";

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
