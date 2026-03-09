import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function requireManager() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "manager") return { ok: false as const, status: 403, error: "Manager only" };
  const { data: site } = await admin.from("sites").select("id, name, vat_account, tax_amount, bank_name, iban, swift_code").eq("manager_id", user.id).maybeSingle();
  return { ok: true as const, admin, user, site };
}

export async function GET() {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, site } = r;

    const { data: profile } = await admin.from("profiles").select("id, name, surname, email, phone").eq("id", user.id).single();
    if (!profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

    return NextResponse.json({
      ...profile,
      has_site: !!site?.id,
      site_name: (site as { name?: string | null } | null)?.name ?? null,
      vat_account: (site as { vat_account?: string | null } | null)?.vat_account ?? null,
      tax_amount: (site as { tax_amount?: number | null } | null)?.tax_amount ?? null,
      bank_name: (site as { bank_name?: string | null } | null)?.bank_name ?? null,
      iban: (site as { iban?: string | null } | null)?.iban ?? null,
      swift_code: (site as { swift_code?: string | null } | null)?.swift_code ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, site } = r;

    const body = await request.json().catch(() => ({}));
    const { phone, vat_account, tax_amount, bank_name, iban, swift_code } = body;

    const profileUpdates: { phone?: string | null } = {};
    if (phone !== undefined) profileUpdates.phone = phone != null && phone !== "" ? String(phone).trim() : null;

    if (Object.keys(profileUpdates).length > 0) {
      const { error: profileErr } = await admin.from("profiles").update(profileUpdates).eq("id", user.id);
      if (profileErr) return NextResponse.json({ error: profileErr.message || "Failed to save profile" }, { status: 400 });
    }

    const siteUpdates: { vat_account?: string | null; bank_name?: string | null; iban?: string | null; swift_code?: string | null; tax_amount?: number | null } = {};
    if (vat_account !== undefined) siteUpdates.vat_account = vat_account != null && vat_account !== "" ? String(vat_account).trim() : null;
    if (bank_name !== undefined) siteUpdates.bank_name = bank_name != null && bank_name !== "" ? String(bank_name).trim() : null;
    if (iban !== undefined) siteUpdates.iban = iban != null && iban !== "" ? String(iban).trim() : null;
    if (swift_code !== undefined) siteUpdates.swift_code = swift_code != null && swift_code !== "" ? String(swift_code).trim() : null;
    if (tax_amount !== undefined) siteUpdates.tax_amount = tax_amount != null && tax_amount !== "" ? Number(tax_amount) : null;

    if (Object.keys(siteUpdates).length > 0) {
      let siteId = (site as { id?: string } | null)?.id;
      if (!siteId) {
        const { data: existingSite } = await admin.from("sites").select("id").eq("manager_id", user.id).maybeSingle();
        if (existingSite?.id) {
          siteId = (existingSite as { id: string }).id;
        } else {
          const { data: profileRow } = await admin.from("profiles").select("name, surname").eq("id", user.id).single();
          const displayName = profileRow ? `${(profileRow as { name?: string }).name ?? ""} ${(profileRow as { surname?: string }).surname ?? ""}`.trim() || "Manager Site" : "Manager Site";
          const { error: insErr } = await admin.from("sites").insert({ name: displayName, manager_id: user.id, address: "" });
          if (insErr) {
            if (insErr.code === "23505") {
              const { data: newSite } = await admin.from("sites").select("id").eq("manager_id", user.id).maybeSingle();
              siteId = (newSite as { id: string } | null)?.id;
            }
            if (!siteId) return NextResponse.json({ error: insErr.message || "Failed to create site" }, { status: 400 });
          } else {
            const { data: newSite } = await admin.from("sites").select("id").eq("manager_id", user.id).maybeSingle();
            siteId = (newSite as { id: string } | null)?.id;
          }
        }
      }
      if (siteId) {
        const { error: siteErr } = await admin.from("sites").update(siteUpdates).eq("id", siteId);
        if (siteErr) return NextResponse.json({ error: siteErr.message || "Failed to save bank details" }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
