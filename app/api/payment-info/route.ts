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

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();

    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    const role = (profile as { role?: string } | null)?.role;

    let unitIds: string[] = [];
    if (role === "owner") {
      const { data: ownerUnits } = await admin.from("unit_owners").select("unit_id").eq("owner_id", user.id);
      unitIds = (ownerUnits ?? []).map((u: { unit_id: string }) => u.unit_id);
    } else if (role === "tenant") {
      const { data: tenantUnits } = await admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", user.id);
      unitIds = (tenantUnits ?? []).map((u: { unit_id: string }) => u.unit_id);
    }
    if (!unitIds.length) {
      return NextResponse.json({
        site_name: null,
        bank_name: null,
        iban: null,
        swift_code: null,
        vat_account: null,
        manager_name: null,
        manager_email: null,
        manager_phone: null,
        payment_methods: ["Contact your property manager for payment instructions."],
      });
    }

    const { data: units } = await admin.from("units").select("id, building_id").in("id", unitIds);
    const buildIds = [...new Set((units ?? []).map((u: { building_id: string }) => u.building_id))];
    const { data: buildings } = await admin.from("buildings").select("id, site_id").in("id", buildIds);
    const siteIds = [...new Set((buildings ?? []).map((b: { site_id: string | null }) => b.site_id).filter(Boolean))];
    if (!siteIds.length) {
      return NextResponse.json({
        site_name: null,
        bank_name: null,
        iban: null,
        swift_code: null,
        vat_account: null,
        manager_name: null,
        manager_email: null,
        manager_phone: null,
        payment_methods: ["Contact your property manager for payment instructions."],
      });
    }

    const { data: site } = await admin.from("sites").select("id, name, address, vat_account, bank_name, iban, swift_code, manager_id").eq("id", siteIds[0]).single();
    if (!site) {
      return NextResponse.json({
        site_name: null,
        bank_name: null,
        iban: null,
        swift_code: null,
        vat_account: null,
        manager_name: null,
        manager_email: null,
        manager_phone: null,
        payment_methods: ["Contact your property manager for payment instructions."],
      });
    }

    let manager_name: string | null = null;
    let manager_email: string | null = null;
    let manager_phone: string | null = null;
    if ((site as { manager_id?: string }).manager_id) {
      const { data: manager } = await admin.from("profiles").select("name, surname, email, phone").eq("id", (site as { manager_id: string }).manager_id).single();
      if (manager) {
        manager_name = `${(manager as { name: string }).name ?? ""} ${(manager as { surname: string }).surname ?? ""}`.trim() || null;
        manager_email = (manager as { email?: string }).email ?? null;
        manager_phone = (manager as { phone?: string | null }).phone ?? null;
      }
    }

    const paymentMethods: string[] = [];
    const bankName = (site as { bank_name?: string | null }).bank_name ?? null;
    const iban = (site as { iban?: string | null }).iban ?? null;
    const swiftCode = (site as { swift_code?: string | null }).swift_code ?? null;
    if (bankName || iban || swiftCode) {
      if (bankName) paymentMethods.push(`Bank: ${bankName}`);
      if (iban) paymentMethods.push(`IBAN: ${iban}`);
      if (swiftCode) paymentMethods.push(`SWIFT: ${swiftCode}`);
    }
    if (paymentMethods.length === 0) {
      paymentMethods.push("Contact your property manager for payment instructions.");
    }

    return NextResponse.json({
      site_name: (site as { name?: string }).name ?? null,
      site_address: (site as { address?: string }).address ?? null,
      bank_name: bankName,
      iban: iban,
      swift_code: swiftCode,
      vat_account: (site as { vat_account?: string | null }).vat_account ?? null,
      manager_name,
      manager_email,
      manager_phone,
      payment_methods: paymentMethods,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
