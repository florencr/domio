import type { SupabaseClient } from "@supabase/supabase-js";

export type PollCategoryScope = "apartment" | "parking" | "garden" | "global";
export type PollClassification = "informal_survey" | "formal_resolution";
export type PollStatus = "draft" | "published" | "closed";
export type PollQuestionKind = "single_select" | "multi_select";

export function unitTypeMatchesScope(unitType: string, scope: PollCategoryScope): boolean {
  if (scope === "global") return true;
  if (scope === "apartment") return unitType === "apartment";
  if (scope === "parking") return unitType === "parking";
  if (scope === "garden") return unitType === "garden";
  return false;
}

export async function siteBuildingIds(admin: SupabaseClient, siteId: string): Promise<string[]> {
  const { data } = await admin.from("buildings").select("id").eq("site_id", siteId);
  return (data ?? []).map((b: { id: string }) => b.id);
}

export async function siteUnitsWithTypes(
  admin: SupabaseClient,
  siteId: string
): Promise<{ id: string; type: string }[]> {
  const bIds = await siteBuildingIds(admin, siteId);
  if (!bIds.length) return [];
  const { data: units } = await admin.from("units").select("id,type").in("building_id", bIds);
  return (units ?? []) as { id: string; type: string }[];
}

export function unitsMatchingScope(
  units: { id: string; type: string }[],
  scope: PollCategoryScope
): { id: string; type: string }[] {
  return units.filter((u) => unitTypeMatchesScope(u.type, scope));
}

export async function countRegisteredUnitsInScope(
  admin: SupabaseClient,
  siteId: string,
  scope: PollCategoryScope
): Promise<number> {
  const all = await siteUnitsWithTypes(admin, siteId);
  return unitsMatchingScope(all, scope).length;
}

async function ownerUnitIdsOnSet(
  admin: SupabaseClient,
  userId: string,
  candidateUnitIds: string[]
): Promise<string[]> {
  if (!candidateUnitIds.length) return [];
  const out = new Set<string>();
  const { data: mem } = await admin
    .from("unit_memberships")
    .select("unit_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active")
    .in("unit_id", candidateUnitIds);
  (mem ?? []).forEach((r: { unit_id: string }) => out.add(r.unit_id));
  const missing = candidateUnitIds.filter((id) => !out.has(id));
  if (missing.length) {
    const { data: leg } = await admin.from("unit_owners").select("unit_id").eq("owner_id", userId).in("unit_id", missing);
    (leg ?? []).forEach((r: { unit_id: string }) => out.add(r.unit_id));
  }
  return [...out];
}

/** Formal resolutions: only active owner rows in unit_memberships count (no legacy-only owners). */
async function ownerMembershipUnitIdsOnSet(
  admin: SupabaseClient,
  userId: string,
  candidateUnitIds: string[]
): Promise<string[]> {
  if (!candidateUnitIds.length) return [];
  const { data: mem } = await admin
    .from("unit_memberships")
    .select("unit_id")
    .eq("user_id", userId)
    .eq("role", "owner")
    .eq("status", "active")
    .in("unit_id", candidateUnitIds);
  return [...new Set((mem ?? []).map((r: { unit_id: string }) => r.unit_id))];
}

async function tenantUnitIdsOnSet(
  admin: SupabaseClient,
  userId: string,
  candidateUnitIds: string[]
): Promise<string[]> {
  if (!candidateUnitIds.length) return [];
  const out = new Set<string>();
  const { data: mem } = await admin
    .from("unit_memberships")
    .select("unit_id")
    .eq("user_id", userId)
    .eq("role", "tenant")
    .eq("status", "active")
    .in("unit_id", candidateUnitIds);
  (mem ?? []).forEach((r: { unit_id: string }) => out.add(r.unit_id));
  const missing = candidateUnitIds.filter((id) => !out.has(id));
  if (missing.length) {
    const { data: leg } = await admin
      .from("unit_tenant_assignments")
      .select("unit_id")
      .eq("tenant_id", userId)
      .in("unit_id", missing);
    (leg ?? []).forEach((r: { unit_id: string }) => out.add(r.unit_id));
  }
  return [...out];
}

/** Owner unit ids in site that match category scope (for formal or non-global informal). */
export async function ownerUnitsInScopeForUser(
  admin: SupabaseClient,
  userId: string,
  siteId: string,
  scope: PollCategoryScope
): Promise<string[]> {
  const scoped = unitsMatchingScope(await siteUnitsWithTypes(admin, siteId), scope);
  const ids = scoped.map((u) => u.id);
  return ownerUnitIdsOnSet(admin, userId, ids);
}

/** Any tenant/owner attachment to site (any unit). */
export async function userHasAnyUnitInSite(
  admin: SupabaseClient,
  userId: string,
  siteId: string
): Promise<boolean> {
  const all = await siteUnitsWithTypes(admin, siteId);
  const ids = all.map((u) => u.id);
  const owners = await ownerUnitIdsOnSet(admin, userId, ids);
  if (owners.length) return true;
  const tenants = await tenantUnitIdsOnSet(admin, userId, ids);
  return tenants.length > 0;
}

export async function userCanViewPoll(
  admin: SupabaseClient,
  userId: string,
  siteId: string,
  classification: PollClassification,
  scope: PollCategoryScope
): Promise<boolean> {
  if (classification === "informal_survey" && scope === "global") {
    return userHasAnyUnitInSite(admin, userId, siteId);
  }
  const ownerScoped = await ownerUnitsInScopeForUser(admin, userId, siteId, scope);
  return ownerScoped.length > 0;
}

export async function userCanVotePoll(
  admin: SupabaseClient,
  userId: string,
  siteId: string,
  classification: PollClassification,
  scope: PollCategoryScope
): Promise<boolean> {
  if (classification === "formal_resolution") {
    if (scope === "global") {
      const all = await siteUnitsWithTypes(admin, siteId);
      const ids = all.map((u) => u.id);
      const owners = await ownerMembershipUnitIdsOnSet(admin, userId, ids);
      return owners.length > 0;
    }
    const scoped = unitsMatchingScope(await siteUnitsWithTypes(admin, siteId), scope);
    const ids = scoped.map((u) => u.id);
    const owners = await ownerMembershipUnitIdsOnSet(admin, userId, ids);
    return owners.length > 0;
  }
  if (scope === "global") {
    return userHasAnyUnitInSite(admin, userId, siteId);
  }
  const owners = await ownerUnitsInScopeForUser(admin, userId, siteId, scope);
  return owners.length > 0;
}

/** Formal: unit ids this user casts ballots for. Informal: [] (use user-level ballot). */
export async function formalVoteUnitIdsForUser(
  admin: SupabaseClient,
  userId: string,
  siteId: string,
  scope: PollCategoryScope
): Promise<string[]> {
  if (scope === "global") {
    const all = await siteUnitsWithTypes(admin, siteId);
    const ids = all.map((u) => u.id);
    return ownerMembershipUnitIdsOnSet(admin, userId, ids);
  }
  const scoped = unitsMatchingScope(await siteUnitsWithTypes(admin, siteId), scope);
  const ids = scoped.map((u) => u.id);
  return ownerMembershipUnitIdsOnSet(admin, userId, ids);
}

export async function collectEligiblePollNotificationUserIds(
  admin: SupabaseClient,
  siteId: string,
  classification: PollClassification,
  scope: PollCategoryScope
): Promise<string[]> {
  const allUsers = new Set<string>();
  const siteUnits = await siteUnitsWithTypes(admin, siteId);
  const scopedUnits = unitsMatchingScope(siteUnits, scope);
  const scopedIds = new Set(scopedUnits.map((u) => u.id));
  const allIds = siteUnits.map((u) => u.id);

  const addOwnersForUnits = async (unitIds: string[], formalOnlyMembers: boolean) => {
    if (!unitIds.length) return;
    const { data: mem } = await admin
      .from("unit_memberships")
      .select("user_id,unit_id")
      .eq("role", "owner")
      .eq("status", "active")
      .in("unit_id", unitIds);
    (mem ?? []).forEach((r: { user_id: string }) => allUsers.add(r.user_id));
    if (!formalOnlyMembers) {
      const { data: leg } = await admin.from("unit_owners").select("owner_id,unit_id").in("unit_id", unitIds);
      (leg ?? []).forEach((r: { owner_id: string }) => allUsers.add(r.owner_id));
    }
  };

  const addTenantsForUnits = async (unitIds: string[]) => {
    if (!unitIds.length) return;
    const { data: mem } = await admin
      .from("unit_memberships")
      .select("user_id")
      .eq("role", "tenant")
      .eq("status", "active")
      .in("unit_id", unitIds);
    (mem ?? []).forEach((r: { user_id: string }) => allUsers.add(r.user_id));
    const { data: leg } = await admin.from("unit_tenant_assignments").select("tenant_id").in("unit_id", unitIds);
    (leg ?? []).forEach((r: { tenant_id: string }) => allUsers.add(r.tenant_id));
  };

  if (classification === "informal_survey" && scope === "global") {
    await addOwnersForUnits(allIds, false);
    await addTenantsForUnits(allIds);
    return [...allUsers];
  }

  const isFormal = classification === "formal_resolution";
  await addOwnersForUnits([...scopedIds], isFormal);

  return [...allUsers];
}

export function pollIsOpen(row: { status: string; closes_at: string | null }): boolean {
  if (row.status !== "published") return false;
  if (row.closes_at) {
    const end = new Date(row.closes_at).getTime();
    if (!Number.isNaN(end) && Date.now() > end) return false;
  }
  return true;
}

/** Site IDs where the user has any owner or tenant unit (via memberships or legacy tables). */
export async function userSiteIdsForResident(admin: SupabaseClient, userId: string): Promise<string[]> {
  const uidSet = new Set<string>();
  const { data: m1 } = await admin
    .from("unit_memberships")
    .select("unit_id")
    .eq("user_id", userId)
    .eq("status", "active");
  (m1 ?? []).forEach((r: { unit_id: string }) => uidSet.add(r.unit_id));
  const { data: o1 } = await admin.from("unit_owners").select("unit_id").eq("owner_id", userId);
  (o1 ?? []).forEach((r: { unit_id: string }) => uidSet.add(r.unit_id));
  const { data: t1 } = await admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", userId);
  (t1 ?? []).forEach((r: { unit_id: string }) => uidSet.add(r.unit_id));
  const unitIds = [...uidSet];
  if (!unitIds.length) return [];

  const { data: units } = await admin.from("units").select("building_id").in("id", unitIds);
  const bIds = [...new Set((units ?? []).map((u: { building_id: string }) => u.building_id))];
  if (!bIds.length) return [];

  const { data: buildings } = await admin.from("buildings").select("site_id").in("id", bIds);
  const sites = new Set<string>();
  (buildings ?? []).forEach((b: { site_id: string | null }) => {
    if (b.site_id) sites.add(b.site_id);
  });
  return [...sites];
}
