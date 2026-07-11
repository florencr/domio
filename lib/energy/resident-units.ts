import type { SupabaseClient } from "@supabase/supabase-js";

/** Active owner + tenant unit IDs for the logged-in resident (memberships + legacy). */
export async function activeResidentUnitIds(
  admin: SupabaseClient,
  userId: string
): Promise<string[]> {
  const ids = new Set<string>();

  const { data: memberships } = await admin
    .from("unit_memberships")
    .select("unit_id")
    .eq("user_id", userId)
    .eq("status", "active");
  (memberships ?? []).forEach((r: { unit_id: string }) => ids.add(r.unit_id));

  const { data: owners } = await admin.from("unit_owners").select("unit_id").eq("owner_id", userId);
  (owners ?? []).forEach((r: { unit_id: string }) => ids.add(r.unit_id));

  const { data: tenants } = await admin
    .from("unit_tenant_assignments")
    .select("unit_id")
    .eq("tenant_id", userId);
  (tenants ?? []).forEach((r: { unit_id: string }) => ids.add(r.unit_id));

  return [...ids];
}

export async function assertResidentOwnsUnit(
  admin: SupabaseClient,
  userId: string,
  unitId: string
): Promise<boolean> {
  const ids = await activeResidentUnitIds(admin, userId);
  return ids.includes(unitId);
}
