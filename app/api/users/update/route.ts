import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { logAudit } from "@/lib/audit";
import type { SupabaseClient } from "@supabase/supabase-js";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

async function managerCanEditUser(admin: SupabaseClient, siteId: string, targetUserId: string): Promise<boolean> {
  const { data: assignment } = await admin
    .from("user_site_assignments")
    .select("user_id")
    .eq("site_id", siteId)
    .eq("user_id", targetUserId)
    .maybeSingle();
  if (assignment) return true;

  const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
  const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
  if (!buildingIds.length) return false;

  const { data: units } = await admin.from("units").select("id").in("building_id", buildingIds);
  const unitIds = (units ?? []).map((u: { id: string }) => u.id);
  if (!unitIds.length) return false;

  const { data: ownerRow } = await admin
    .from("unit_owners")
    .select("owner_id")
    .eq("owner_id", targetUserId)
    .in("unit_id", unitIds)
    .limit(1)
    .maybeSingle();
  if (ownerRow) return true;

  const { data: tenantRow } = await admin
    .from("unit_tenant_assignments")
    .select("tenant_id")
    .eq("tenant_id", targetUserId)
    .in("unit_id", unitIds)
    .limit(1)
    .maybeSingle();
  return !!tenantRow;
}

async function requireProfileEditor(admin: SupabaseClient, actorId: string, targetUserId: string) {
  const { data: actorProfile } = await admin.from("profiles").select("role").eq("id", actorId).single();
  const actorRole = (actorProfile as { role?: string } | null)?.role;
  if (actorRole === "admin") return { ok: true as const };
  if (actorRole !== "manager") return { ok: false as const, status: 403, error: "Not allowed" };

  const { data: site } = await admin.from("sites").select("id").eq("manager_id", actorId).maybeSingle();
  const siteId = (site as { id: string } | null)?.id;
  if (!siteId) return { ok: false as const, status: 403, error: "No site assigned" };

  const { data: targetProfile } = await admin.from("profiles").select("role").eq("id", targetUserId).maybeSingle();
  if ((targetProfile as { role?: string } | null)?.role === "manager") {
    return { ok: false as const, status: 403, error: "Cannot edit another manager" };
  }

  const allowed = await managerCanEditUser(admin, siteId, targetUserId);
  if (!allowed) return { ok: false as const, status: 403, error: "User is not on your site" };
  return { ok: true as const };
}

// Update profile fields (name, surname, phone, email, role)
export async function PATCH(request: Request) {
  try {
    const serverSb = await createServerClient();
    const { data: { user: actor } } = await serverSb.auth.getUser();
    if (!actor) return NextResponse.json({ success: false, error: "Not authenticated" }, { status: 401 });

    const { userId, name, surname, phone, role, email } = await request.json();
    if (!userId) return NextResponse.json({ success: false, error: "Missing userId" }, { status: 400 });

    const sb = adminClient();
    const access = await requireProfileEditor(sb, actor.id, userId);
    if (!access.ok) return NextResponse.json({ success: false, error: access.error }, { status: access.status });

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (surname !== undefined) updates.surname = surname;
    if (phone !== undefined) updates.phone = phone || null;
    if (role !== undefined) updates.role = role;

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
        return NextResponse.json({ success: false, error: "Valid email required" }, { status: 400 });
      }

      const { data: currentProfile } = await sb.from("profiles").select("email").eq("id", userId).single();
      const currentEmail = ((currentProfile as { email?: string } | null)?.email ?? "").trim().toLowerCase();
      if (normalizedEmail !== currentEmail) {
        const { data: existingProfile } = await sb
          .from("profiles")
          .select("id")
          .eq("email", normalizedEmail)
          .neq("id", userId)
          .maybeSingle();
        if (existingProfile) {
          return NextResponse.json({ success: false, error: "Email already in use" }, { status: 400 });
        }

        const { error: authError } = await sb.auth.admin.updateUserById(userId, {
          email: normalizedEmail,
          email_confirm: true,
        });
        if (authError) return NextResponse.json({ success: false, error: authError.message }, { status: 400 });
        updates.email = normalizedEmail;
      }
    }

    if (Object.keys(updates).length <= 1) {
      return NextResponse.json({ success: false, error: "No valid updates" }, { status: 400 });
    }

    const { error } = await sb.from("profiles").update(updates).eq("id", userId);
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
