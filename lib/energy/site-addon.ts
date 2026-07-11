import type { SupabaseClient } from "@supabase/supabase-js";

export async function isSiteEnergyAddonEnabled(
  admin: SupabaseClient,
  siteId: string
): Promise<boolean> {
  const { data, error } = await admin
    .from("sites")
    .select("energy_addon_enabled")
    .eq("id", siteId)
    .maybeSingle();
  if (error) return false;
  return (data as { energy_addon_enabled?: boolean } | null)?.energy_addon_enabled === true;
}

export type SiteAddonGateResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

export async function requireSiteEnergyAddon(
  admin: SupabaseClient,
  siteId: string
): Promise<SiteAddonGateResult> {
  const enabled = await isSiteEnergyAddonEnabled(admin, siteId);
  if (!enabled) {
    return {
      ok: false,
      status: 403,
      error: "Energy module is not enabled for this site. Contact your administrator.",
    };
  }
  return { ok: true };
}

/** True if any of the given sites has the energy addon turned on. */
export async function anySiteEnergyAddonEnabled(
  admin: SupabaseClient,
  siteIds: string[]
): Promise<boolean> {
  if (!siteIds.length) return false;
  const { data, error } = await admin
    .from("sites")
    .select("id")
    .in("id", siteIds)
    .eq("energy_addon_enabled", true)
    .limit(1);
  if (error) return false;
  return (data ?? []).length > 0;
}
