import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { publishDraftPollAndNotify } from "@/lib/poll-publish-notify";

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
