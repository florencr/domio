import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

    const { email, password, name, surname, phone, siteName, siteAddress, vat_account, bank_name, iban, swift_code, tax_amount } = await request.json();
    if (!email || !password || !name || !surname) {
      return NextResponse.json({ error: "Email, password, name, surname required" }, { status: 400 });
    }

    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: authError?.message ?? "Failed" }, { status: 400 });
    }

    await admin.from("profiles").insert({
      id: authData.user.id,
      email,
      name,
      surname,
      phone: phone || null,
      role: "manager",
    });

    const siteDisplayName = siteName?.trim() || `${name} ${surname}'s Site`;
    const siteInsert: Record<string, unknown> = {
      name: siteDisplayName,
      manager_id: authData.user.id,
      address: siteAddress?.trim() || "",
    };
    if (vat_account != null) siteInsert.vat_account = vat_account?.trim() || null;
    if (bank_name != null) siteInsert.bank_name = bank_name?.trim() || null;
    if (iban != null) siteInsert.iban = iban != null && iban !== "" ? iban : null;
    if (swift_code != null) siteInsert.swift_code = swift_code?.trim() || null;
    if (tax_amount != null && tax_amount !== "") siteInsert.tax_amount = Number(tax_amount);

    let { error: siteErr } = await admin.from("sites").insert(siteInsert);
    if (siteErr && (siteErr.message?.includes("column") || siteErr.message?.includes("schema"))) {
      const minimalInsert = { name: siteDisplayName, manager_id: authData.user.id, address: siteAddress?.trim() || "" };
      const { error: minimalErr } = await admin.from("sites").insert(minimalInsert);
      if (!minimalErr && (siteInsert.vat_account || siteInsert.bank_name || siteInsert.iban || siteInsert.swift_code || siteInsert.tax_amount != null)) {
        const { data: newSite } = await admin.from("sites").select("id").eq("manager_id", authData.user.id).maybeSingle();
        if (newSite?.id) {
          const updates: Record<string, unknown> = {};
          if (siteInsert.vat_account != null) updates.vat_account = siteInsert.vat_account;
          if (siteInsert.bank_name != null) updates.bank_name = siteInsert.bank_name;
          if (siteInsert.iban != null) updates.iban = siteInsert.iban;
          if (siteInsert.swift_code != null) updates.swift_code = siteInsert.swift_code;
          if (siteInsert.tax_amount != null) updates.tax_amount = siteInsert.tax_amount;
          if (Object.keys(updates).length > 0) await admin.from("sites").update(updates).eq("id", newSite.id);
        }
      }
    } else if (siteErr) {
      return NextResponse.json({ success: false, error: siteErr.message }, { status: 400 });
    }

    return NextResponse.json({ success: true, userId: authData.user.id });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
