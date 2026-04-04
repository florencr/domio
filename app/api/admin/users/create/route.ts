import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/** Admin creates a resident user linked to a site; unit owner/tenant is set when assigning a unit. */
export async function POST(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ success: false, error: "Admin only" }, { status: 403 });

    const { email, password, name, surname, phone, role, siteId } = await request.json();
    if (!email || !password || !name || !surname || !role) {
      return NextResponse.json({ success: false, error: "email, password, name, surname, role required" }, { status: 400 });
    }
    if (role !== "resident" && role !== "owner" && role !== "tenant") {
      return NextResponse.json({ success: false, error: "role must be resident" }, { status: 400 });
    }
    if (!siteId || typeof siteId !== "string") {
      return NextResponse.json({ success: false, error: "siteId required" }, { status: 400 });
    }
    const { data: siteRow, error: siteErr } = await admin.from("sites").select("id").eq("id", siteId).maybeSingle();
    if (siteErr || !siteRow?.id) {
      return NextResponse.json({ success: false, error: "Invalid site" }, { status: 400 });
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: authError?.message ?? "Failed to create user" }, { status: 400 });
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: authData.user.id,
      email,
      name,
      surname,
      phone: phone || null,
      role: "resident",
    });

    if (profileError) {
      return NextResponse.json({ success: false, error: profileError.message }, { status: 400 });
    }

    await admin.from("user_site_assignments").delete().eq("user_id", authData.user.id);
    const { error: assignError } = await admin.from("user_site_assignments").insert({
      user_id: authData.user.id,
      site_id: siteId,
    });
    if (assignError) {
      return NextResponse.json({ success: false, error: assignError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
