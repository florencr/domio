import { createClient } from "@/lib/supabase/client";

/** Sends Bearer token so Route Handlers see the user when cookies lag behind the browser session. */
export async function pollApiHeaders(base?: Record<string, string>): Promise<Record<string, string>> {
  const headers: Record<string, string> = { ...base };
  const supabase = createClient();
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }
  return headers;
}
