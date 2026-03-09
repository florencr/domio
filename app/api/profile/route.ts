import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile, error } = await admin.from("profiles").select("id, name, surname, email, role, phone, locale, contact_email").eq("id", user.id).single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const updates: Record<string, unknown> = {};
    if (typeof body.locale === "string" && (body.locale === "en" || body.locale === "al")) {
      updates.locale = body.locale;
    }
    if (body.phone !== undefined) {
      updates.phone = body.phone != null && body.phone !== "" ? String(body.phone).trim() : null;
    }
    if (body.contact_email !== undefined) {
      updates.contact_email = body.contact_email != null && body.contact_email !== "" ? String(body.contact_email).trim() : null;
    }

    if (Object.keys(updates).length === 0) return NextResponse.json({ error: "No valid updates" }, { status: 400 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile, error } = await admin.from("profiles").update({ ...updates, updated_at: new Date().toISOString() }).eq("id", user.id).select("id, name, surname, email, role, phone, locale, contact_email").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(profile);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
