import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Managers only" }, { status: 403 });

    const { data, error } = await sb
      .from("notifications")
      .select("id, title, body, created_at, target_audience")
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const notifs = data ?? [];
    const ids = notifs.map((n: { id: string }) => n.id);
    const countMap = new Map<string, number>();

    if (ids.length > 0) {
      const { data: recs } = await sb
        .from("notification_recipients")
        .select("notification_id")
        .in("notification_id", ids);
      (recs ?? []).forEach((r: { notification_id: string }) => {
        countMap.set(r.notification_id, (countMap.get(r.notification_id) ?? 0) + 1);
      });
    }

    const items = notifs.map((n: { id: string; title: string; body: string | null; created_at: string; target_audience: string }) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      created_at: n.created_at,
      target_audience: n.target_audience,
      recipients: countMap.get(n.id) ?? 0,
    }));

    return NextResponse.json({ notifications: items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
