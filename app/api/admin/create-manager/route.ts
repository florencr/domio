import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { email, password, name, surname, phone, siteName } = await request.json();
    if (!email || !password || !name || !surname) {
      return NextResponse.json({ error: "Email, password, name, surname required" }, { status: 400 });
    }

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: authError?.message ?? "Failed" }, { status: 400 });
    }

    await admin.from("profiles").insert({
      id: authData.user.id,
      email,
      name,
      surname,
      phone: phone || null,
      role: "manager",
    });

    const siteDisplayName = siteName?.trim() || `${name} ${surname}'s Site`;
    await admin.from("sites").insert({
      name: siteDisplayName,
      manager_id: authData.user.id,
    });

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
