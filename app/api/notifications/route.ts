import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { session } } = await sb.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data, error } = await sb
      .from("notification_recipients")
      .select("id, read_at, notifications!inner(id, title, body, created_at)")
      .eq("user_id", user.id)
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const raw = data || [];
    const items: Array<{ recipientId: string; readAt: string | null; id: string; title: string; body: string | null; created_at: string }> = [];

    for (let i = 0; i < raw.length; i++) {
      const row = raw[i];
      const notif = Array.isArray(row.notifications) ? row.notifications[0] : row.notifications;
      if (notif && notif.id) {
        items.push({
          recipientId: row.id,
          readAt: row.read_at,
          id: notif.id,
          title: notif.title || "",
          body: notif.body,
          created_at: notif.created_at,
        });
      }
    }

    items.sort((a, b) => b.created_at.localeCompare(a.created_at));
    return NextResponse.json({ notifications: items });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
