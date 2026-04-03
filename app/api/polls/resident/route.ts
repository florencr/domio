import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { NextResponse } from "next/server";
import { pollIsOpen, userCanViewPoll, userSiteIdsForResident } from "@/lib/community-polls";
import { getSessionUserInRoute } from "@/lib/supabase/get-session-user-in-route";

function adminClient() {
  return createServiceRoleClient();
}

export async function GET() {
  try {
    const user = await getSessionUserInRoute();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();
    const siteIds = await userSiteIdsForResident(admin, user.id);
    if (!siteIds.length) return NextResponse.json({ polls: [] });

    const { data: polls, error } = await admin
      .from("polls")
      .select(
        "id,site_id,title,description,classification,category_scope,status,published_at,closes_at,created_at,attachment_filename,threshold_percent"
      )
      .in("site_id", siteIds)
      .in("status", ["published", "closed"])
      .order("published_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const out: Record<string, unknown>[] = [];
    for (const p of polls ?? []) {
      const row = p as {
        site_id: string;
        classification: "informal_survey" | "formal_resolution";
        category_scope: "apartment" | "parking" | "garden" | "global";
        status: string;
        closes_at: string | null;
        id: string;
      };
      const can = await userCanViewPoll(admin, user.id, row.site_id, row.classification, row.category_scope);
      if (!can) continue;

      const { count } = await admin
        .from("poll_question_votes")
        .select("id", { count: "exact", head: true })
        .eq("poll_id", row.id)
        .eq("voter_user_id", user.id);

      out.push({
        ...p,
        open: pollIsOpen({ status: row.status, closes_at: row.closes_at }),
        hasSubmitted: (count ?? 0) > 0,
      });
    }

    return NextResponse.json({ polls: out });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
