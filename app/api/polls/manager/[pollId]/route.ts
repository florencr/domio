import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { requireManagerSite } from "@/lib/polls/require-manager-site";

type QIn = { prompt: string; help_text?: string | null; kind: "single_select" | "multi_select"; options: { label: string; explanation?: string | null }[] };

async function replaceQuestions(admin: SupabaseClient, pollId: string, questions: QIn[]) {
  await admin.from("poll_questions").delete().eq("poll_id", pollId);
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

export async function GET(
  _request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { pollId } = await context.params;

    const { data: poll, error: pErr } = await admin.from("polls").select("*").eq("id", pollId).eq("site_id", siteId).maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: questions, error: qErr } = await admin
      .from("poll_questions")
      .select("id,sort_order,prompt,help_text,kind,created_at, poll_options(id,sort_order,label,explanation,created_at)")
      .eq("poll_id", pollId)
      .order("sort_order", { ascending: true });
    if (qErr) return NextResponse.json({ error: qErr.message }, { status: 500 });

    const qs = (questions ?? []).map((row: Record<string, unknown>) => {
      const opts = row.poll_options;
      const list = Array.isArray(opts) ? opts : [];
      const sorted = [...list].sort((a: { sort_order?: number }, b: { sort_order?: number }) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const { poll_options: _, ...rest } = row;
      return { ...rest, options: sorted };
    });

    return NextResponse.json({ poll, questions: qs });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { pollId } = await context.params;

    const { data: existing, error: exErr } = await admin
      .from("polls")
      .select("id,status,site_id")
      .eq("id", pollId)
      .eq("site_id", siteId)
      .maybeSingle();
    if (exErr) return NextResponse.json({ error: exErr.message }, { status: 500 });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((existing as { status: string }).status !== "draft") {
      return NextResponse.json({ error: "Published polls cannot be edited" }, { status: 400 });
    }

    const body = await request.json();
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : null;
    const classification = body.classification;
    const category_scope = body.category_scope;
    const closes_at = body.closes_at === null || body.closes_at === "" ? null : String(body.closes_at);
    const questions = Array.isArray(body.questions) ? body.questions as QIn[] : null;

    if (!title) return NextResponse.json({ error: "Title required" }, { status: 400 });
    if (classification !== "informal_survey" && classification !== "formal_resolution") {
      return NextResponse.json({ error: "Invalid classification" }, { status: 400 });
    }
    if (!["apartment", "parking", "garden", "global"].includes(category_scope)) {
      return NextResponse.json({ error: "Invalid category_scope" }, { status: 400 });
    }

    const { error: upErr } = await admin
      .from("polls")
      .update({
        title,
        description,
        classification,
        category_scope,
        closes_at,
        threshold_question_id: null,
        approval_option_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pollId)
      .eq("status", "draft");

    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

    if (questions) {
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
      try {
        await replaceQuestions(admin, pollId, questions);
      } catch (insErr) {
        return NextResponse.json({ error: insErr instanceof Error ? insErr.message : "Update failed" }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { pollId } = await context.params;

    const { data: existing } = await admin
      .from("polls")
      .select("id,status,attachment_path")
      .eq("id", pollId)
      .eq("site_id", siteId)
      .maybeSingle();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((existing as { status: string }).status !== "draft") {
      return NextResponse.json({ error: "Only draft polls can be deleted" }, { status: 400 });
    }
    const path = (existing as { attachment_path: string | null }).attachment_path;
    if (path) await admin.storage.from("documents").remove([path]);

    const { error: delErr } = await admin.from("polls").delete().eq("id", pollId);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
