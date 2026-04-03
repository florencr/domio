import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";
import type { User } from "@supabase/supabase-js";

/**
 * User for API routes: cookie session first, then Authorization Bearer (browser client
 * sometimes has a session without cookies reaching the Route Handler).
 */
export async function getSessionUserInRoute(): Promise<User | null> {
  const sb = await createClient();
  const { data: cookieData } = await sb.auth.getUser();
  if (cookieData?.user) return cookieData.user;

  const h = await headers();
  const auth = h.get("authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  const jwt = auth.slice(7).trim();
  if (!jwt) return null;

  const { data: jwtData, error } = await sb.auth.getUser(jwt);
  if (error || !jwtData?.user) return null;
  return jwtData.user;
}
