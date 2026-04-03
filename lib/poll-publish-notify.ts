import type { SupabaseClient } from "@supabase/supabase-js";
import { collectEligiblePollNotificationUserIds, type PollCategoryScope, type PollClassification } from "@/lib/community-polls";
import { getFcmMessaging } from "@/lib/firebase-admin";

export type PublishPollNotifyResult =
  | { ok: true; recipientCount: number }
  | { ok: false; error: string; status: number };

/**
 * Validates draft, sets status published, inserts in-app notifications + push for all eligible participants.
 */
export async function publishDraftPollAndNotify(
  admin: SupabaseClient,
  params: {
    managerUserId: string;
    siteId: string;
    pollId: string;
    thresholdQuestionId?: string | null;
    approvalOptionId?: string | null;
    thresholdPercent?: number;
  }
): Promise<PublishPollNotifyResult> {
  const { managerUserId, siteId, pollId, thresholdQuestionId, approvalOptionId, thresholdPercent } = params;

  const { data: poll, error: pErr } = await admin
    .from("polls")
    .select("*")
    .eq("id", pollId)
    .eq("site_id", siteId)
    .maybeSingle();
  if (pErr) return { ok: false, error: pErr.message, status: 500 };
  if (!poll) return { ok: false, error: "Not found", status: 404 };
  if ((poll as { status: string }).status !== "draft") {
    return { ok: false, error: "Already published", status: 400 };
  }

  const { data: questions, error: qErr } = await admin
    .from("poll_questions")
    .select("id")
    .eq("poll_id", pollId)
    .limit(500);
  if (qErr) return { ok: false, error: qErr.message, status: 500 };
  if (!questions?.length) return { ok: false, error: "Poll has no questions", status: 400 };

  const classification = (poll as { classification: string }).classification;
  let thQ = thresholdQuestionId ?? null;
  let apO = approvalOptionId ?? null;

  if (classification === "formal_resolution") {
    if (!thQ || !apO) {
      return {
        ok: false,
        error: "Formal resolutions require thresholdQuestionId and approvalOptionId",
        status: 400,
      };
    }
    const { data: thQRow } = await admin
      .from("poll_questions")
      .select("id")
      .eq("id", thQ)
      .eq("poll_id", pollId)
      .maybeSingle();
    if (!thQRow) return { ok: false, error: "Threshold question not part of this poll", status: 400 };
    const { data: apORow } = await admin
      .from("poll_options")
      .select("id")
      .eq("id", apO)
      .eq("question_id", thQ)
      .maybeSingle();
    if (!apORow) return { ok: false, error: "Approval option must belong to the threshold question", status: 400 };
  }

  const publishedAt = new Date().toISOString();
  const { error: upErr } = await admin
    .from("polls")
    .update({
      status: "published",
      published_at: publishedAt,
      threshold_question_id: classification === "formal_resolution" ? thQ : null,
      approval_option_id: classification === "formal_resolution" ? apO : null,
      ...(thresholdPercent !== undefined ? { threshold_percent: thresholdPercent } : {}),
      updated_at: publishedAt,
    })
    .eq("id", pollId)
    .eq("status", "draft");

  if (upErr) return { ok: false, error: upErr.message, status: 500 };

  const pollRow = poll as {
    title: string;
    classification: PollClassification;
    category_scope: PollCategoryScope;
  };
  const userIds = await collectEligiblePollNotificationUserIds(admin, siteId, pollRow.classification, pollRow.category_scope);

  const notifTitle = `Poll: ${pollRow.title}`;
  const notifBody =
    classification === "formal_resolution"
      ? "Formal resolution — please vote in the app."
      : "New community poll — please respond in the app.";

  if (userIds.length === 0) {
    return { ok: true, recipientCount: 0 };
  }

  const { data: notif, error: nErr } = await admin
    .from("notifications")
    .insert({
      title: notifTitle,
      body: `${notifBody}\n[[poll:${pollId}]]`,
      created_by: managerUserId,
      target_audience: "both",
      target_unit_types: null,
      unpaid_only: false,
    })
    .select("id")
    .single();

  if (nErr || !notif?.id) {
    await admin
      .from("polls")
      .update({
        status: "draft",
        published_at: null,
        threshold_question_id: null,
        approval_option_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pollId);
    return {
      ok: false,
      error: nErr?.message ?? "Failed to create notification — poll was reverted to draft",
      status: 500,
    };
  }

  const recipientRows = userIds.map((uid) => ({ notification_id: notif.id, user_id: uid }));
  const { error: rErr } = await admin.from("notification_recipients").insert(recipientRows);
  if (rErr) {
    await admin.from("notifications").delete().eq("id", notif.id);
    await admin
      .from("polls")
      .update({
        status: "draft",
        published_at: null,
        threshold_question_id: null,
        approval_option_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", pollId);
    return {
      ok: false,
      error: rErr.message + " — poll was reverted to draft",
      status: 500,
    };
  }

  const fcm = getFcmMessaging();
  if (fcm && userIds.length > 0) {
    const { data: tokens } = await admin.from("device_tokens").select("token").in("user_id", userIds);
    if (tokens && tokens.length > 0) {
      await Promise.allSettled(
        (tokens as { token: string }[]).map(({ token }) =>
          fcm.send({ token, notification: { title: notifTitle, body: notifBody }, data: { pollId } }).catch(() => null)
        )
      );
    }
  }

  return { ok: true, recipientCount: userIds.length };
}
