import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

// POST /api/notifications/read - mark notification as read
export async function POST(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const { recipientId } = body;
    if (!recipientId) return NextResponse.json({ error: "Missing recipientId" }, { status: 400 });

    const { error } = await sb
      .from("notification_recipients")
      .update({ read_at: new Date().toISOString() })
      .eq("id", recipientId)
      .eq("user_id", user.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
