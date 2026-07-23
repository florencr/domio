import type { SupabaseClient } from "@supabase/supabase-js";

export type ClearSiteUnitsResidentsResult = {
  unitsDeleted: number;
  usersDeleted: number;
  userErrors: string[];
};

async function disableDeleteLocks(admin: SupabaseClient) {
  await admin.rpc("admin_set_delete_locks", { p_enabled: false });
}

async function enableDeleteLocks(admin: SupabaseClient) {
  await admin.rpc("admin_set_delete_locks", { p_enabled: true });
}

export async function clearSiteUnitsAndResidents(
  admin: SupabaseClient,
  siteId: string
): Promise<ClearSiteUnitsResidentsResult> {
  const { data: site, error: siteErr } = await admin
    .from("sites")
    .select("id, manager_id, name")
    .eq("id", siteId)
    .maybeSingle();
  if (siteErr) throw new Error(siteErr.message);
  if (!site?.id) throw new Error("Site not found");

  const managerId = (site as { manager_id?: string | null }).manager_id ?? null;

  const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
  const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);

  let unitIds: string[] = [];
  if (buildingIds.length) {
    const { data: units } = await admin.from("units").select("id").in("building_id", buildingIds);
    unitIds = (units ?? []).map((u: { id: string }) => u.id);
  }

  const userIds = new Set<string>();

  if (unitIds.length) {
    const [{ data: owners }, { data: tenants }, { data: memberships }] = await Promise.all([
      admin.from("unit_owners").select("owner_id").in("unit_id", unitIds),
      admin.from("unit_tenant_assignments").select("tenant_id").in("unit_id", unitIds),
      admin.from("unit_memberships").select("user_id").in("unit_id", unitIds),
    ]);
    (owners ?? []).forEach((r: { owner_id: string }) => userIds.add(r.owner_id));
    (tenants ?? []).forEach((r: { tenant_id: string }) => userIds.add(r.tenant_id));
    (memberships ?? []).forEach((r: { user_id: string }) => userIds.add(r.user_id));
  }

  const { data: siteAssignments } = await admin.from("user_site_assignments").select("user_id").eq("site_id", siteId);
  (siteAssignments ?? []).forEach((r: { user_id: string }) => userIds.add(r.user_id));

  if (managerId) userIds.delete(managerId);

  const candidateIds = [...userIds];
  const deletableUserIds: string[] = [];
  if (candidateIds.length) {
    const { data: profiles } = await admin.from("profiles").select("id, role").in("id", candidateIds);
    for (const p of profiles ?? []) {
      const id = (p as { id: string }).id;
      const role = (p as { role?: string }).role;
      if (role === "admin" || role === "manager") continue;
      deletableUserIds.push(id);
    }
  }

  await disableDeleteLocks(admin);
  try {
    if (unitIds.length) {
      await admin.from("poll_question_votes").delete().in("unit_id", unitIds);

      const { data: bills } = await admin.from("bills").select("id").in("unit_id", unitIds);
      const billIds = (bills ?? []).map((b: { id: string }) => b.id);
      if (billIds.length) {
        await admin.from("bill_lines").delete().in("bill_id", billIds);
      }

      await admin.from("bills").delete().in("unit_id", unitIds);
      await admin.from("payments").delete().in("unit_id", unitIds);
      await admin.from("unit_memberships").delete().in("unit_id", unitIds);
      await admin.from("unit_tenant_assignments").delete().in("unit_id", unitIds);
      await admin.from("unit_owners").delete().in("unit_id", unitIds);
      await admin.from("documents").delete().in("unit_id", unitIds);
      await admin.from("energy_wallet_ledger").delete().in("unit_id", unitIds);
      await admin.from("energy_unit_shares").delete().in("unit_id", unitIds);
      await admin.from("energy_meters").delete().in("unit_id", unitIds);

      const { error: unitsErr } = await admin.from("units").delete().in("id", unitIds);
      if (unitsErr) throw new Error(unitsErr.message);
    }

    if (deletableUserIds.length) {
      await admin.from("user_site_assignments").delete().eq("site_id", siteId).in("user_id", deletableUserIds);
    }
  } finally {
    await enableDeleteLocks(admin);
  }

  const userErrors: string[] = [];
  let usersDeleted = 0;
  for (const userId of deletableUserIds) {
    const { data: otherMemberships } = await admin
      .from("unit_memberships")
      .select("unit_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(1);
    if ((otherMemberships ?? []).length > 0) continue;

    const { data: otherOwner } = await admin.from("unit_owners").select("unit_id").eq("owner_id", userId).limit(1);
    if ((otherOwner ?? []).length > 0) continue;

    const { data: otherTenant } = await admin
      .from("unit_tenant_assignments")
      .select("unit_id")
      .eq("tenant_id", userId)
      .limit(1);
    if ((otherTenant ?? []).length > 0) continue;

    const { error } = await admin.auth.admin.deleteUser(userId);
    if (error) userErrors.push(`${userId}: ${error.message}`);
    else usersDeleted++;
  }

  return {
    unitsDeleted: unitIds.length,
    usersDeleted,
    userErrors,
  };
}
