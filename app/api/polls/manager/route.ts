import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { publishDraftPollAndNotify } from "@/lib/poll-publish-notify";
import { requireManagerSite } from "@/lib/polls/require-manager-site";

type QIn = { prompt: string; help_text?: string | null; kind: "single_select" | "multi_select"; options: { label: string; explanation?: string | null }[] };

async function insertQuestions(admin: SupabaseClient, pollId: string, questions: QIn[]) {
  for (let qi = 0; qi < questions.length; qi++) {
    const q = questions[qi];
    const { data: qRow, error: qErr } = await admin
      .from("poll_questions")
      .insert({
        poll_id: pollId,
        sort_order: qi,
        prompt: q.prompt.trim(),
        help_text: q.help_text?.trim() || null,
        kind: q.kind,
      })
      .select("id")
      .single();
    if (qErr || !qRow) throw new Error(qErr?.message ?? "Question insert failed");
    const qid = (qRow as { id: string }).id;
    const optRows = q.options.map((o, oi) => ({
      question_id: qid,
      sort_order: oi,
      label: o.label.trim(),
      explanation: o.explanation?.trim() || null,
    }));
    const { error: oErr } = await admin.from("poll_options").insert(optRows);
    if (oErr) throw new Error(oErr.message);
  }
}

async function resolveFormalThresholdByIndices(
  admin: SupabaseClient,
  pollId: string,
  questionIndex: number,
  optionIndex: number
): Promise<{ questionId: string; optionId: string } | null> {
  const { data: qrows } = await admin
    .from("poll_questions")
    .select("id")
    .eq("poll_id", pollId)
    .order("sort_order", { ascending: true });
  if (!qrows || questionIndex < 0 || questionIndex >= qrows.length) return null;
  const qid = (qrows[questionIndex] as { id: string }).id;
  const { data: orows } = await admin
    .from("poll_options")
    .select("id")
    .eq("question_id", qid)
    .order("sort_order", { ascending: true });
  if (!orows || optionIndex < 0 || optionIndex >= orows.length) return null;
  return { questionId: qid, optionId: (orows[optionIndex] as { id: string }).id };
}

export async function GET() {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { data, error } = await admin
      .from("polls")
      .select("id,site_id,title,description,classification,category_scope,status,published_at,closes_at,created_at,threshold_percent,threshold_question_id,approval_option_id,attachment_filename")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ polls: data ?? [] });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, siteId } = r;
    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const classification = body.classification;
    const category_scope = body.category_scope;
    const closes_at = body.closes_at === null || body.closes_at === "" ? null : String(body.closes_at);
    const questions = Array.isArray(body.questions) ? body.questions as QIn[] : [];
    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    if (classification !== "informal_survey" && classification !== "formal_resolution") {
      return NextResponse.json({ error: "Invalid classification" }, { status: 400 });
    }
    if (!["apartment", "parking", "garden", "global"].includes(category_scope)) {
      return NextResponse.json({ error: "Invalid category_scope" }, { status: 400 });
    }
    if (!questions.length) return NextResponse.json({ error: "At least one question required" }, { status: 400 });
    for (const q of questions) {
      if (!q.prompt?.trim()) return NextResponse.json({ error: "Each question needs a prompt" }, { status: 400 });
      if (q.kind !== "single_select" && q.kind !== "multi_select") {
        return NextResponse.json({ error: "Invalid question kind" }, { status: 400 });
      }
      if (!Array.isArray(q.options) || q.options.length < 2) {
        return NextResponse.json({ error: "Each question needs at least two options" }, { status: 400 });
      }
    }

    const { data: poll, error: pErr } = await admin
      .from("polls")
      .insert({
        site_id: siteId,
        created_by: user.id,
        title,
        description,
        classification,
        category_scope,
        status: "draft",
        closes_at,
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (pErr || !poll) return NextResponse.json({ error: pErr?.message ?? "Insert failed" }, { status: 500 });

    const pollId = (poll as { id: string }).id;
    try {
      await insertQuestions(admin, pollId, questions);
    } catch (insErr) {
      await admin.from("polls").delete().eq("id", pollId);
      return NextResponse.json({ error: insErr instanceof Error ? insErr.message : "Insert failed" }, { status: 500 });
    }

    const publishAndNotify = body.publishAndNotify === true;
    const thresholdPercent =
      typeof body.thresholdPercent === "number" && body.thresholdPercent >= 0 && body.thresholdPercent <= 100
        ? body.thresholdPercent
        : undefined;

    if (publishAndNotify) {
      let thresholdQuestionId: string | null = null;
      let approvalOptionId: string | null = null;
      if (classification === "formal_resolution") {
        const tIdx = body.thresholdQuestionIndex;
        const oIdx = body.thresholdOptionIndex;
        if (typeof tIdx !== "number" || typeof oIdx !== "number") {
          return NextResponse.json(
            {
              error:
                "Formal poll: send thresholdQuestionIndex and thresholdOptionIndex (0-based) when publishAndNotify is true",
            },
            { status: 400 }
          );
        }
        const resolved = await resolveFormalThresholdByIndices(admin, pollId, tIdx, oIdx);
        if (!resolved) {
          await admin.from("polls").delete().eq("id", pollId);
          return NextResponse.json({ error: "Invalid threshold question or option index" }, { status: 400 });
        }
        thresholdQuestionId = resolved.questionId;
        approvalOptionId = resolved.optionId;
      }

      const pub = await publishDraftPollAndNotify(admin, {
        managerUserId: user.id,
        siteId,
        pollId,
        thresholdQuestionId,
        approvalOptionId,
        thresholdPercent,
      });

      if (!pub.ok) {
        return NextResponse.json(
          { error: pub.error, pollId, draftSaved: true },
          { status: pub.status }
        );
      }
      return NextResponse.json({
        success: true,
        pollId,
        published: true,
        recipients: pub.recipientCount,
      });
    }

    return NextResponse.json({ success: true, pollId });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
