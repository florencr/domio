import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// Update profile fields (name, surname, phone, role)
export async function PATCH(request: Request) {
  try {
    const { userId, name, surname, phone, role } = await request.json();
    const sb = adminClient();
    const { error } = await sb.from("profiles").update({ name, surname, phone: phone || null, role }).eq("id", userId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// Delete user
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");
    if (!userId) return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });
    const sb = adminClient();

    const { data: deletedProfile } = await sb.from("profiles").select("name, surname, email, role").eq("id", userId).single();
    let entityLabel = userId;
    if (deletedProfile) {
      const dp = deletedProfile as { name?: string; surname?: string; email?: string };
      const fullName = `${dp.name ?? ""} ${dp.surname ?? ""}`.trim();
      entityLabel = fullName || dp.email || userId;
    }

    const { error } = await sb.auth.admin.deleteUser(userId);
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });

    const serverSb = await createServerClient();
    const { data: { user: actor } } = await serverSb.auth.getUser();
    await logAudit({
      user_id: actor?.id ?? undefined,
      user_email: actor?.email ?? undefined,
      action: "delete",
      entity_type: "user",
      entity_id: userId,
      entity_label: entityLabel,
      old_values: deletedProfile ? { email: (deletedProfile as { email?: string }).email, role: (deletedProfile as { role?: string }).role } : undefined,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}

// Reset password
export async function POST(request: Request) {
  try {
    const { userId, newPassword } = await request.json();
    if (!newPassword || newPassword.length < 6) {
      return NextResponse.json({ success: false, error: "Password must be at least 6 characters." }, { status: 400 });
    }
    const sb = adminClient();
    const { error } = await sb.auth.admin.updateUserById(userId, { password: newPassword });
    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Unknown error" }, { status: 500 });
  }
}
