import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  try {
    const sb = await createClient();
    const { data: { session } } = await sb.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await request.json();
    const token = body?.token;
    const platform = body?.platform;

    if (!token || typeof token !== "string") {
      return NextResponse.json({ error: "Missing or invalid token" }, { status: 400 });
    }
    if (!platform || (platform !== "ios" && platform !== "android")) {
      return NextResponse.json({ error: "Platform must be 'ios' or 'android'" }, { status: 400 });
    }

    const { error } = await sb
      .from("device_tokens")
      .upsert(
        { user_id: user.id, token, platform },
        { onConflict: "user_id,platform" }
      );

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
