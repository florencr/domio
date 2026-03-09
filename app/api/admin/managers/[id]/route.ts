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
  if (profile?.role !== "admin") return { ok: false as const, status: 403, error: "Admin only" };
  return { ok: true as const, admin };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;
    const { id } = await context.params;
    const { data, error } = await admin.from("profiles").select("id,name,surname,email,phone").eq("id", id).eq("role", "manager").single();
    if (error || !data) return NextResponse.json({ error: "Manager not found" }, { status: 404 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
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
    const { name, surname, email, phone, password, vat_account, bank_name, iban, swift_code, tax_amount } = body;

    if (!name || !surname || !email) {
      return NextResponse.json({ error: "Name, surname, email required" }, { status: 400 });
    }

    const updates: { name: string; surname: string; email: string; phone?: string | null } = { name, surname, email, phone: phone ?? null };
    await admin.from("profiles").update(updates).eq("id", id);

    if (password && password.length >= 6) {
      await admin.auth.admin.updateUserById(id, { password });
    }

    const { data: site } = await admin.from("sites").select("id").eq("manager_id", id).maybeSingle();
    if (site?.id && (vat_account !== undefined || bank_name !== undefined || iban !== undefined || swift_code !== undefined || tax_amount !== undefined)) {
      const siteUpdates: { vat_account?: string | null; bank_name?: string | null; iban?: string | null; swift_code?: string | null; tax_amount?: number | null } = {};
      if (vat_account !== undefined) siteUpdates.vat_account = vat_account?.trim() || null;
      if (bank_name !== undefined) siteUpdates.bank_name = bank_name?.trim() || null;
      if (iban !== undefined) siteUpdates.iban = iban != null && iban !== "" ? iban : null;
      if (swift_code !== undefined) siteUpdates.swift_code = swift_code?.trim() || null;
      if (tax_amount !== undefined) siteUpdates.tax_amount = tax_amount != null && tax_amount !== "" ? Number(tax_amount) : null;
      if (Object.keys(siteUpdates).length > 0) {
        const { error: updateErr } = await admin.from("sites").update(siteUpdates).eq("id", site.id);
        if (updateErr) return NextResponse.json({ error: updateErr.message || "Failed to save bank details" }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
