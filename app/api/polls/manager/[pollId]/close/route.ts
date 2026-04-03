import { NextResponse } from "next/server";
import { requireManagerSite } from "@/lib/polls/require-manager-site";

export async function POST(
  _request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { pollId } = await context.params;

    const { data: poll } = await admin
      .from("polls")
      .select("id,status")
      .eq("id", pollId)
      .eq("site_id", siteId)
      .maybeSingle();
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((poll as { status: string }).status !== "published") {
      return NextResponse.json({ error: "Only published polls can be closed" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from("polls")
      .update({ status: "closed", updated_at: now })
      .eq("id", pollId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
