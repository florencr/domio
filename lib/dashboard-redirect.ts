/** Where to send a logged-in user (residents → single resident dashboard). */
export async function getPostLoginDashboard(): Promise<string> {
  try {
    const pr = await fetch("/api/profile", { cache: "no-store" });
    if (!pr.ok) {
      // Don’t send to /dashboard (router loop). After sign-in, profile may 401 briefly before cookies attach.
      return "/dashboard/resident";
    }
    const profile = await pr.json();
    const r = profile?.role as string | undefined;
    if (r === "admin") return "/dashboard/admin";
    if (r === "manager") return "/dashboard/manager";
    return "/dashboard/resident";
  } catch {
    return "/dashboard/resident";
  }
}
