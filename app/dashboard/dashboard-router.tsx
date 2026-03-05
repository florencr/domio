"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function DashboardRouter() {
  const router = useRouter();

  useEffect(() => {
    async function route() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      let profile: { role?: string } | null = null;
      const apiRes = await fetch("/api/profile");
      if (apiRes.ok) profile = await apiRes.json();
      if (!profile) {
        const res = await supabase.from("profiles").select("role").eq("id", user.id).single();
        profile = res.data;
      }
      if (profile?.role === "admin") router.push("/dashboard/admin");
      else if (profile?.role === "manager") router.push("/dashboard/manager");
      else if (profile?.role === "tenant") router.push("/dashboard/tenant");
      else router.push("/dashboard/owner");
    }
    route();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
