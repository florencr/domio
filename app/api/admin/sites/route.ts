import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { logAudit } from "@/lib/audit";

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
  if (profile?.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };
  return { ok: true as const, admin, user };
}

export async function GET() {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;
    const fullSelect = "id,name,address,vat_account,bank_name,iban,swift_code,tax_amount,manager_id,created_at";
    const result = await admin.from("sites").select(fullSelect).order("created_at", { ascending: false });
    if (result.error && (result.error.message?.includes("column") || result.error.message?.includes("schema"))) {
      const minimalResult = await admin.from("sites").select("id,name,address,manager_id,created_at").order("created_at", { ascending: false });
      if (minimalResult.error) return NextResponse.json({ error: minimalResult.error.message }, { status: 500 });
      return NextResponse.json(minimalResult.data ?? []);
    }
    if (result.error) return NextResponse.json({ error: result.error.message }, { status: 500 });
    return NextResponse.json(result.data ?? []);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user } = r;
    const { manager_id, name, address } = await request.json();

    if (!manager_id || !name?.trim()) {
      return NextResponse.json({ error: "manager_id and name required" }, { status: 400 });
    }

    const coreInsert = { manager_id, name: name.trim(), address: address?.trim() || "" };
    const result = await admin.from("sites").insert(coreInsert).select("id").single();
    const { data, error } = result;
    if (error) {
      if (error.code === "23505") return NextResponse.json({ error: "Manager already has a site" }, { status: 400 });
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "create",
      entity_type: "site",
      entity_id: data.id,
      entity_label: name.trim(),
      site_id: data.id,
      new_values: { name: name.trim(), manager_id },
    });

    return NextResponse.json({ success: true, id: data.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
