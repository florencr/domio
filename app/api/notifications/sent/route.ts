import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export async function GET() {
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Managers only" }, { status: 403 });

    const admin = adminClient();
    const { data, error } = await admin
      .from("notifications")
      .select("id, title, body, created_at, target_audience")
      .eq("created_by", user.id)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const notifs = data ?? [];
    const ids = notifs.map((n: { id: string }) => n.id);
    const countMap = new Map<string, number>();

    if (ids.length > 0) {
      const { data: recs } = await admin
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

export async function DELETE(request: Request) {
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Managers only" }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const admin = adminClient();
    const { data: existing, error: fetchErr } = await admin
      .from("notifications")
      .select("id, created_by")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if ((existing as { created_by: string }).created_by !== user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error: delErr } = await admin.from("notifications").delete().eq("id", id);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
