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

export async function GET() {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;
    const { data, error } = await admin.from("sites").select("id,name,address,vat_account,manager_id,created_at").order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json(data ?? []);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;
    const { manager_id, name, address, vat_account } = await request.json();

    if (!manager_id || !name?.trim()) {
      return NextResponse.json({ error: "manager_id and name required" }, { status: 400 });
    }

    const { data, error } = await admin.from("sites").insert({
      manager_id,
      name: name.trim(),
      address: address?.trim() || "",
      vat_account: vat_account?.trim() || null,
    }).select("id").single();

    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Manager already has a site" }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
