import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import {
  formalVoteUnitIdsForUser,
  pollIsOpen,
  userCanVotePoll,
} from "@/lib/community-polls";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function POST(
  request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { pollId } = await context.params;
    const admin = adminClient();
    const body = await request.json();
    const answers = body.answers as Record<string, string | string[]> | undefined;
    if (!answers || typeof answers !== "object") return NextResponse.json({ error: "Invalid answers" }, { status: 400 });

    const { data: poll, error: pErr } = await admin.from("polls").select("*").eq("id", pollId).maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const prow = poll as {
      site_id: string;
      classification: "informal_survey" | "formal_resolution";
      category_scope: "apartment" | "parking" | "garden" | "global";
      status: string;
      closes_at: string | null;
    };

    if (!pollIsOpen(prow)) return NextResponse.json({ error: "Poll is not open" }, { status: 400 });

    const allowed = await userCanVotePoll(admin, user.id, prow.site_id, prow.classification, prow.category_scope);
    if (!allowed) return NextResponse.json({ error: "You are not eligible to vote on this poll" }, { status: 403 });

    const { count: prior } = await admin
      .from("poll_question_votes")
      .select("id", { count: "exact", head: true })
      .eq("poll_id", pollId)
      .eq("voter_user_id", user.id);
    if ((prior ?? 0) > 0) return NextResponse.json({ error: "You already submitted a response" }, { status: 409 });

    const { data: questions } = await admin.from("poll_questions").select("id,kind").eq("poll_id", pollId);
    const qList = questions ?? [];
    if (!qList.length) return NextResponse.json({ error: "Poll has no questions" }, { status: 400 });

    const qids = qList.map((q: { id: string }) => q.id);
    const { data: optRows } = await admin.from("poll_options").select("id,question_id").in("question_id", qids);

    const optionBelongs = new Map<string, { questionId: string }>();
    for (const o of optRows ?? []) {
      const orow = o as { id: string; question_id: string };
      optionBelongs.set(orow.id, { questionId: orow.question_id });
    }

    const rows: {
      poll_id: string;
      question_id: string;
      voter_user_id: string;
      unit_id: string | null;
      option_ids: string[];
    }[] = [];

    for (const q of qList) {
      const qrow = q as { id: string; kind: "single_select" | "multi_select" };
      const qid = qrow.id;
      const raw = answers[qid];
      if (raw === undefined || raw === null) {
        return NextResponse.json({ error: `Missing answer for question ${qid}` }, { status: 400 });
      }
      let optionIds: string[] = [];
      if (qrow.kind === "single_select") {
        if (typeof raw !== "string") return NextResponse.json({ error: "Invalid answer type" }, { status: 400 });
        optionIds = [raw];
      } else {
        if (!Array.isArray(raw) || raw.length < 1) {
          return NextResponse.json({ error: "Select at least one option for multi-select questions" }, { status: 400 });
        }
        optionIds = raw.map((x) => String(x));
      }
      const uniq = [...new Set(optionIds)];
      for (const oid of uniq) {
        const meta = optionBelongs.get(oid);
        if (!meta || meta.questionId !== qid) {
          return NextResponse.json({ error: "Invalid option for question" }, { status: 400 });
        }
      }

      if (prow.classification === "formal_resolution") {
        const unitIds = await formalVoteUnitIdsForUser(admin, user.id, prow.site_id, prow.category_scope);
        if (!unitIds.length) {
          return NextResponse.json({ error: "No voting units found for your account" }, { status: 403 });
        }
        for (const uid of unitIds) {
          rows.push({
            poll_id: pollId,
            question_id: qid,
            voter_user_id: user.id,
            unit_id: uid,
            option_ids: qrow.kind === "single_select" ? [uniq[0]] : uniq,
          });
        }
      } else {
        rows.push({
          poll_id: pollId,
          question_id: qid,
          voter_user_id: user.id,
          unit_id: null,
          option_ids: qrow.kind === "single_select" ? [uniq[0]] : uniq,
        });
      }
    }

    const { error: insErr } = await admin.from("poll_question_votes").insert(rows);
    if (insErr) {
      if (insErr.code === "23505" || insErr.message.includes("unique")) {
        return NextResponse.json({ error: "Duplicate vote — already submitted" }, { status: 409 });
      }
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, ballots: rows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
