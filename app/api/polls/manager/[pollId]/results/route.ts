import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { countRegisteredUnitsInScope, pollIsOpen } from "@/lib/community-polls";

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
  return { ok: true as const, admin, siteId };
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

    const { data: poll, error: pErr } = await admin
      .from("polls")
      .select("*")
      .eq("id", pollId)
      .eq("site_id", siteId)
      .maybeSingle();
    if (pErr) return NextResponse.json({ error: pErr.message }, { status: 500 });
    if (!poll) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const status = (poll as { status: string }).status;
    if (status === "draft") return NextResponse.json({ error: "Poll is still a draft" }, { status: 400 });

    const { data: questions } = await admin
      .from("poll_questions")
      .select("id,prompt,kind,sort_order, poll_options(id,label,sort_order)")
      .eq("poll_id", pollId)
      .order("sort_order", { ascending: true });

    const { data: votes } = await admin
      .from("poll_question_votes")
      .select("question_id,unit_id,voter_user_id,option_ids")
      .eq("poll_id", pollId);

    const pollRow = poll as {
      classification: string;
      category_scope: "apartment" | "parking" | "garden" | "global";
      threshold_percent: number;
      threshold_question_id: string | null;
      approval_option_id: string | null;
      status: string;
      closes_at: string | null;
    };

    const totalRegisteredUnits = await countRegisteredUnitsInScope(admin, siteId, pollRow.category_scope);
    const open = pollIsOpen({ status: pollRow.status, closes_at: pollRow.closes_at });

    const questionResults = (questions ?? []).map((q: Record<string, unknown>) => {
      const qid = q.id as string;
      const opts = (Array.isArray(q.poll_options) ? q.poll_options : []) as { id: string; label: string }[];
      const qVotes = (votes ?? []).filter((v: { question_id: string }) => v.question_id === qid);

      const ballotKeys = new Set<string>();
      if (pollRow.classification === "formal_resolution") {
        qVotes.forEach((v: { unit_id: string | null; voter_user_id: string }) => {
          if (v.unit_id) ballotKeys.add(`u:${v.unit_id}`);
        });
      } else {
        qVotes.forEach((v: { unit_id: string | null; voter_user_id: string }) => {
          ballotKeys.add(`v:${v.voter_user_id}`);
        });
      }
      const participationCount = ballotKeys.size;

      const countsByOption: Record<string, number> = {};
      opts.forEach((o) => {
        countsByOption[o.id] = 0;
      });

      for (const v of qVotes) {
        const ids = (v as { option_ids: string[] }).option_ids ?? [];
        for (const oid of ids) {
          if (countsByOption[oid] !== undefined) countsByOption[oid] += 1;
        }
      }

      return {
        questionId: qid,
        prompt: q.prompt,
        kind: q.kind,
        options: opts.map((o) => ({ optionId: o.id, label: o.label, votes: countsByOption[o.id] ?? 0 })),
        participationCount,
      };
    });

    let resolutionPassed: boolean | null = null;
    let approvalUnitVotes = 0;
    if (pollRow.classification === "formal_resolution" && pollRow.threshold_question_id && pollRow.approval_option_id) {
      const thVotes = (votes ?? []).filter(
        (v: { question_id: string }) => v.question_id === pollRow.threshold_question_id
      );
      const approvalId = pollRow.approval_option_id;
      const yesUnits = new Set<string>();
      for (const v of thVotes) {
        const u = (v as { unit_id: string | null; option_ids: string[] }).unit_id;
        const oids = (v as { option_ids: string[] }).option_ids ?? [];
        if (u && oids.includes(approvalId)) yesUnits.add(u);
      }
      approvalUnitVotes = yesUnits.size;
      if (totalRegisteredUnits > 0) {
        resolutionPassed = approvalUnitVotes / totalRegisteredUnits >= Number(pollRow.threshold_percent) / 100;
      } else {
        resolutionPassed = false;
      }
    }

    return NextResponse.json({
      pollId,
      classification: pollRow.classification,
      category_scope: pollRow.category_scope,
      totalRegisteredUnits,
      open,
      thresholdPercent: pollRow.threshold_percent,
      approvalUnitVotes,
      resolutionPassed,
      questions: questionResults,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
