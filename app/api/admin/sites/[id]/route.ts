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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const r = await requireAdmin();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user } = r;
    const { id } = await context.params;
    const { name, address, vat_account, bank_name, iban, swift_code, tax_amount, manager_id } = await request.json();

    const updates: { name?: string; address?: string; vat_account?: string; bank_name?: string; iban?: string; swift_code?: string; tax_amount?: number | null; manager_id?: string } = {};
    if (manager_id !== undefined && manager_id) updates.manager_id = manager_id;
    if (name !== undefined) updates.name = name.trim();
    if (address !== undefined) updates.address = address.trim();
    if (vat_account !== undefined) updates.vat_account = vat_account?.trim() || null;
    if (bank_name !== undefined) updates.bank_name = bank_name?.trim() || null;
    if (iban !== undefined) updates.iban = iban != null && iban !== "" ? iban : null;
    if (swift_code !== undefined) updates.swift_code = swift_code?.trim() || null;
    if (tax_amount !== undefined) updates.tax_amount = tax_amount != null && tax_amount !== "" ? Number(tax_amount) : null;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "name, address, vat_account, bank_name, iban, swift_code, tax_amount or manager_id required" }, { status: 400 });
    }

    let updateResult = await admin.from("sites").update(updates).eq("id", id);
    if (updateResult.error && (updateResult.error.message?.includes("column") || updateResult.error.message?.includes("schema cache"))) {
      const coreUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) coreUpdates.name = updates.name;
      if (updates.address !== undefined) coreUpdates.address = updates.address;
      if (updates.manager_id !== undefined) coreUpdates.manager_id = updates.manager_id;
      if (Object.keys(coreUpdates).length > 0) {
        updateResult = await admin.from("sites").update(coreUpdates).eq("id", id);
      }
    }
    if (updateResult.error) return NextResponse.json({ error: updateResult.error.message }, { status: 500 });

    await logAudit({
      user_id: user.id,
      user_email: user.email,
      action: "update",
      entity_type: "site",
      entity_id: id,
      entity_label: name ?? updates.name ?? id,
      site_id: id,
      new_values: updates,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
