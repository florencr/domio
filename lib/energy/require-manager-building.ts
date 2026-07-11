import { requireManagerSite } from "@/lib/polls/require-manager-site";
import { requireSiteEnergyAddon } from "@/lib/energy/site-addon";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type ManagerBuildingResult =
  | { ok: true; admin: SupabaseClient; user: User; siteId: string; buildingId: string }
  | { ok: false; status: number; error: string };

export async function requireManagerBuilding(buildingId: string): Promise<ManagerBuildingResult> {
  const r = await requireManagerSite();
  if (!r.ok) return r;

  const addon = await requireSiteEnergyAddon(r.admin, r.siteId);
  if (!addon.ok) return { ok: false, status: addon.status, error: addon.error };

  const bid = typeof buildingId === "string" ? buildingId.trim() : "";  if (!bid) return { ok: false, status: 400, error: "building_id required" };

  const { data: building, error } = await r.admin
    .from("buildings")
    .select("id, site_id")
    .eq("id", bid)
    .maybeSingle();

  if (error) return { ok: false, status: 500, error: error.message };
  if (!building || (building as { site_id: string | null }).site_id !== r.siteId) {
    return { ok: false, status: 403, error: "Building not in your site" };
  }

  return { ok: true, admin: r.admin, user: r.user, siteId: r.siteId, buildingId: bid };
}
