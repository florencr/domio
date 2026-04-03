import { NextResponse } from "next/server";
import { publishDraftPollAndNotify } from "@/lib/poll-publish-notify";
import { requireManagerSite } from "@/lib/polls/require-manager-site";

export async function POST(
  request: Request,
  context: { params: Promise<{ pollId: string }> }
) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, siteId } = r;
    const { pollId } = await context.params;
    const body = await request.json().catch(() => ({}));
    const thresholdQuestionId = typeof body.thresholdQuestionId === "string" ? body.thresholdQuestionId : null;
    const approvalOptionId = typeof body.approvalOptionId === "string" ? body.approvalOptionId : null;
    const thresholdPercent =
      typeof body.thresholdPercent === "number" && body.thresholdPercent >= 0 && body.thresholdPercent <= 100
        ? body.thresholdPercent
        : undefined;

    const result = await publishDraftPollAndNotify(admin, {
      managerUserId: user.id,
      siteId,
      pollId,
      thresholdQuestionId,
      approvalOptionId,
      thresholdPercent,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, recipients: result.recipientCount });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
