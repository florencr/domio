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

async function requireOwnerUnit(unitId: string) {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };

  const admin = adminClient();
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "owner") return { ok: false as const, status: 403, error: "Owner only" };

  const { data: ownership } = await admin.from("unit_owners").select("id").eq("unit_id", unitId).eq("owner_id", user.id).maybeSingle();
  if (!ownership) return { ok: false as const, status: 403, error: "You do not own this unit" };

  return { ok: true as const, admin, user };
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { unitId, tenantId, isPaymentResponsible } = body;
    if (!unitId || !tenantId) return NextResponse.json({ error: "unitId and tenantId required" }, { status: 400 });

    const r = await requireOwnerUnit(unitId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;

    const { data: existing } = await admin.from("unit_tenant_assignments").select("tenant_id").eq("unit_id", unitId).maybeSingle();
    const currentTenantId = (existing as { tenant_id: string } | null)?.tenant_id;
    if (currentTenantId && currentTenantId !== tenantId) {
      return NextResponse.json({ error: "Unit already has a tenant. Release the current tenant first before assigning another." }, { status: 400 });
    }

    const resp = typeof isPaymentResponsible === "boolean" ? isPaymentResponsible : true;
    if (currentTenantId && currentTenantId === tenantId) {
      const { error } = await admin.from("unit_tenant_assignments").update({ is_payment_responsible: resp }).eq("unit_id", unitId).eq("tenant_id", tenantId);
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    } else {
      const { error } = await admin.from("unit_tenant_assignments").insert({ unit_id: unitId, tenant_id: tenantId, is_payment_responsible: resp });
      if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const unitId = searchParams.get("unitId");
    const tenantId = searchParams.get("tenantId");
    if (!unitId || !tenantId) return NextResponse.json({ error: "unitId and tenantId required" }, { status: 400 });

    const r = await requireOwnerUnit(unitId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;

    const { error } = await admin.from("unit_tenant_assignments").delete().eq("unit_id", unitId).eq("tenant_id", tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { unitId, tenantId, isPaymentResponsible } = body;
    if (!unitId || !tenantId || typeof isPaymentResponsible !== "boolean") return NextResponse.json({ error: "unitId, tenantId and isPaymentResponsible required" }, { status: 400 });

    const r = await requireOwnerUnit(unitId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin } = r;

    const { error } = await admin.from("unit_tenant_assignments").update({ is_payment_responsible: isPaymentResponsible }).eq("unit_id", unitId).eq("tenant_id", tenantId);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
