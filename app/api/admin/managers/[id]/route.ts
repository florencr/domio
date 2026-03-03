import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  return { ok: true as const, admin };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;
    const { id } = await context.params;
    const body = await request.json();
    const { name, surname, email, phone, password } = body;

    if (!name || !surname || !email) {
      return NextResponse.json({ error: "Name, surname, email required" }, { status: 400 });
    }

    const updates: { name: string; surname: string; email: string; phone?: string | null } = { name, surname, email, phone: phone ?? null };
    await admin.from("profiles").update(updates).eq("id", id);

    if (password && password.length >= 6) {
      await admin.auth.admin.updateUserById(id, { password });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
