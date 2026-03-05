import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/** Manager creates owner/tenant - auto-assigns to manager's site. User appears in manager dashboard. */
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
    if (profile?.role !== "manager") return NextResponse.json({ success: false, error: "Manager only" }, { status: 403 });

    const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
    if (!site?.id) return NextResponse.json({ success: false, error: "No site" }, { status: 403 });

    const { email, password, name, surname, phone, role } = await request.json();
    if (!email || !password || !name || !surname || !role) {
      return NextResponse.json({ success: false, error: "email, password, name, surname, role required" }, { status: 400 });
    }
    if (role !== "owner" && role !== "tenant") {
      return NextResponse.json({ success: false, error: "role must be owner or tenant" }, { status: 400 });
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    let userId: string;
    if (authError?.message?.toLowerCase().includes("already") || authError?.message?.toLowerCase().includes("already registered") || authError?.message?.toLowerCase().includes("already in use")) {
      const { data: existingProfile } = await admin.from("profiles").select("id, role").eq("email", email).single();
      if (!existingProfile || ((existingProfile.role as string) !== "owner" && (existingProfile.role as string) !== "tenant")) {
        return NextResponse.json({ success: false, error: authError?.message ?? "Email already in use. Use a different email or ask admin to assign this user to your site." }, { status: 400 });
      }
      userId = existingProfile.id;
    } else if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: authError?.message ?? "Failed to create user" }, { status: 400 });
    } else {
      userId = authData.user.id;
      const { error: profileError } = await admin.from("profiles").insert({
        id: authData.user.id,
        email,
        name,
        surname,
        phone: phone || null,
        role,
      });
      if (profileError) {
        return NextResponse.json({ success: false, error: profileError.message }, { status: 400 });
      }
    }

    const { error: assignError } = await admin.from("user_site_assignments").upsert(
      { user_id: userId, site_id: site.id },
      { onConflict: "user_id" }
    );

    if (assignError) {
      return NextResponse.json({ success: false, error: assignError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
