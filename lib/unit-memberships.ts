import type { SupabaseClient } from "@supabase/supabase-js";

/** Keep unit_memberships in sync when legacy unit_owners / unit_tenant_assignments rows change. */
export async function replaceOwnerMembership(
  admin: SupabaseClient,
  unitId: string,
  ownerId: string | null
) {
  await admin.from("unit_memberships").delete().eq("unit_id", unitId).eq("role", "owner");
  if (ownerId) {
    const { error } = await admin.from("unit_memberships").upsert(
      {
        unit_id: unitId,
        user_id: ownerId,
        role: "owner",
        status: "active",
        is_payment_responsible: false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "unit_id,user_id" }
    );
    if (error) throw error;
  }
}

export async function replaceTenantMembership(
  admin: SupabaseClient,
  unitId: string,
  tenantId: string | null,
  isPaymentResponsible: boolean
) {
  await admin.from("unit_memberships").delete().eq("unit_id", unitId).eq("role", "tenant");
  if (tenantId) {
    const { error } = await admin.from("unit_memberships").upsert(
      {
        unit_id: unitId,
        user_id: tenantId,
        role: "tenant",
        status: "active",
        is_payment_responsible: isPaymentResponsible,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "unit_id,user_id" }
    );
    if (error) throw error;
  }
}

export async function updateTenantPaymentFlag(
  admin: SupabaseClient,
  unitId: string,
  tenantId: string,
  isPaymentResponsible: boolean
) {
  const { error } = await admin
    .from("unit_memberships")
    .update({ is_payment_responsible: isPaymentResponsible, updated_at: new Date().toISOString() })
    .eq("unit_id", unitId)
    .eq("user_id", tenantId)
    .eq("role", "tenant");
  if (error) throw error;
}

export async function deleteTenantMembership(admin: SupabaseClient, unitId: string, tenantId: string) {
  const { error } = await admin
    .from("unit_memberships")
    .delete()
    .eq("unit_id", unitId)
    .eq("user_id", tenantId)
    .eq("role", "tenant");
  if (error) throw error;
}
