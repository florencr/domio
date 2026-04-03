import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";
import { pollIsOpen, userCanViewPoll, userCanVotePoll } from "@/lib/community-polls";
import { getSessionUserInRoute } from "@/lib/supabase/get-session-user-in-route";

function adminClient() {
  return createServiceRoleClient();
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const user = await getSessionUserInRoute();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { pollId } = await context.params;
    const admin = adminClient();

    const { data: poll, error: pErr } = await admin.from("polls").select("*").eq("id", pollId).maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const row = poll as {
      site_id: string;
      classification: "informal_survey" | "formal_resolution";
      category_scope: "apartment" | "parking" | "garden" | "global";
      status: string;
      closes_at: string | null;
      attachment_path: string | null;
    };

    if (row.status === "draft") return NextResponse.json({ error: "Not found" }, { status: 404 });

    const canView = await userCanViewPoll(admin, user.id, row.site_id, row.classification, row.category_scope);
    if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data: questions, error: qErr } = await admin
      .from("poll_questions")
      .select("id,sort_order,prompt,help_text,kind, poll_options(id,sort_order,label,explanation)")
      .eq("poll_id", pollId)
      .order("sort_order", { ascending: true });
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

    const qs = (questions ?? []).map((q: Record<string, unknown>) => {
      const opts = q.poll_options;
      const list = Array.isArray(opts) ? opts : [];
      const sorted = [...list].sort((a: { sort_order?: number }, b: { sort_order?: number }) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const { poll_options: _, ...rest } = q;
      return { ...rest, options: sorted };
    });

    let attachmentUrl: string | null = null;
    if (row.attachment_path) {
      const { data: signed } = await admin.storage.from("documents").createSignedUrl(row.attachment_path, 3600);
      attachmentUrl = signed?.signedUrl ?? null;
    }

    const { count } = await admin
      .from("poll_question_votes")
      .select("id", { count: "exact", head: true })
      .eq("poll_id", pollId)
      .eq("voter_user_id", user.id);

    const open = pollIsOpen({ status: row.status, closes_at: row.closes_at });
    const canVote = open && (await userCanVotePoll(admin, user.id, row.site_id, row.classification, row.category_scope));
    const hasSubmitted = (count ?? 0) > 0;

    return NextResponse.json({
      poll,
      questions: qs,
      attachmentUrl,
      open,
      canVote,
      hasSubmitted,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
