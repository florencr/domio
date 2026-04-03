"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { getPostLoginDashboard } from "@/lib/dashboard-redirect";

export function DashboardRouter() {
  const router = useRouter();

  useEffect(() => {
    async function route() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.replace("/login");
        return;
      }
      let dest = await getPostLoginDashboard();
      if (dest === "/dashboard") dest = "/dashboard/resident";
      router.replace(dest);
    }
    route();
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Loading...</p>
    </div>
  );
}
