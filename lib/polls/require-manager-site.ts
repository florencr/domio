import { createServiceRoleClient } from "@/lib/supabase/service-role";
import { getSessionUserInRoute } from "@/lib/supabase/get-session-user-in-route";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";

export type ManagerSiteResult =
  | { ok: true; admin: SupabaseClient; user: User; siteId: string }
  | { ok: false; status: number; error: string };

export async function requireManagerSite(): Promise<ManagerSiteResult> {
  const user = await getSessionUserInRoute();
  if (!user) return { ok: false, status: 401, error: "Unauthorized" };

  let admin: SupabaseClient;
  try {
    admin = createServiceRoleClient();
  } catch (e) {
    return {
      ok: false,
      status: 500,
      error: e instanceof Error ? e.message : "Server misconfiguration",
    };
  }

  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if ((profile as { role?: string } | null)?.role !== "manager") {
    return { ok: false, status: 403, error: "Managers only" };
  }

  const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).maybeSingle();
  const siteId = (site as { id: string } | null)?.id ?? null;
  if (!siteId) return { ok: false, status: 400, error: "No site assigned" };

  return { ok: true, admin, user, siteId };
}
