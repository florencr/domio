import { createClient } from "@/lib/supabase/client";

/** Prefer role from the live browser session (avoids /api/profile 401 right after sign-in). */
export async function getPostLoginDashboard(): Promise<string> {
  try {
    const sb = createClient();
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return "/login";

    const { data: profile, error: profileErr } = await sb
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    let r = (profile?.role as string | undefined) ?? undefined;

    if (profileErr || r == null) {
      const pr = await fetch("/api/profile", { cache: "no-store", credentials: "same-origin" });
      if (pr.ok) {
        const p = (await pr.json()) as { role?: string };
        r = p?.role;
      }
    }

    if (r === "admin") return "/dashboard/admin";
    if (r === "manager") return "/dashboard/manager";
    return "/dashboard/resident";
  } catch {
    return "/dashboard/resident";
  }
}
