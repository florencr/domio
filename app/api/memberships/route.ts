import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

function adminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

/** Active unit memberships for the signed-in user (e.g. admin/manager tools). */
export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();
    const { data: rows, error } = await admin
      .from("unit_memberships")
      .select("unit_id, role, status, is_payment_responsible")
      .eq("user_id", user.id)
      .eq("status", "active");

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const list = rows ?? [];
    const unitIds = [...new Set(list.map((r: { unit_id: string }) => r.unit_id))];
    let unitNames = new Map<string, string>();
    if (unitIds.length) {
      const { data: units } = await admin.from("units").select("id, unit_name").in("id", unitIds);
      unitNames = new Map((units ?? []).map((u: { id: string; unit_name: string }) => [u.id, u.unit_name]));
    }

    const memberships = list.map((r: { unit_id: string; role: string; status: string; is_payment_responsible: boolean }) => ({
      unit_id: r.unit_id,
      role: r.role,
      status: r.status,
      is_payment_responsible: r.is_payment_responsible,
      unit_name: unitNames.get(r.unit_id) ?? "—",
    }));

    return NextResponse.json({ memberships });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
