import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function requireAdmin() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };
  return { ok: true as const, admin };
}

export async function GET() {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;

    const { data: units } = await admin.from("units").select("id, unit_name, building_id");
    const { data: buildings } = await admin.from("buildings").select("id, name, site_id");
    const buildingMap = new Map<string, { name: string; site_id: string | null }>();
    (buildings ?? []).forEach((b: { id: string; name: string; site_id: string | null }) => {
      buildingMap.set(b.id, { name: b.name, site_id: b.site_id });
    });

    const result = (units ?? []).map((u: { id: string; unit_name: string; building_id: string }) => {
      const b = buildingMap.get(u.building_id);
      return { id: u.id, unit_name: u.unit_name, building_id: u.building_id, building_name: b?.name ?? "", site_id: b?.site_id ?? null };
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
