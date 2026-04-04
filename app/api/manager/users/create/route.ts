import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

/** Manager creates a resident user; owner/tenant is set per unit when assigning. */
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

    const { email, password, name, surname, phone } = await request.json();
    if (!email || !password || !name || !surname) {
      return NextResponse.json({ success: false, error: "email, password, name, surname required" }, { status: 400 });
    }
    const profileRole = "resident";

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    let userId: string;
    if (authError?.message?.toLowerCase().includes("already") || authError?.message?.toLowerCase().includes("already registered") || authError?.message?.toLowerCase().includes("already in use")) {
      const { data: existingProfile } = await admin.from("profiles").select("id, role").eq("email", email).single();
      const er = ((existingProfile?.role as string) || "");
      if (!existingProfile || (er !== "owner" && er !== "tenant" && er !== "resident")) {
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
        role: profileRole,
      });
      if (profileError) {
        return NextResponse.json({ success: false, error: profileError.message }, { status: 400 });
      }
    }

    await admin.from("user_site_assignments").delete().eq("user_id", userId);
    const { error: assignError } = await admin.from("user_site_assignments").insert({
      user_id: userId,
      site_id: site.id,
    });

    if (assignError) {
      return NextResponse.json({ success: false, error: assignError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId });
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
