"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { DomioLogo } from "@/components/DomioLogo";

export default function HomePage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let done = false;
    const timeout = setTimeout(() => {
      if (!done) { done = true; setLoading(false); }
    }, 8000);
    supabase.auth.getSession()
      .then(async ({ data: { session } }) => {
        if (done) return;
        if (!session?.user) {
          setUser(null);
          setLoading(false);
          done = true;
          return;
        }
        setUser(session.user);
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
        setRole(profile?.role ?? null);
        setLoading(false);
        done = true;
      })
      .catch(() => { if (!done) { done = true; setLoading(false); } })
      .finally(() => clearTimeout(timeout));
    return () => clearTimeout(timeout);
  }, []);

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  const dashboardHref = role === "admin" ? "/dashboard/admin" : role === "manager" ? "/dashboard/manager" : role === "tenant" ? "/dashboard/tenant" : "/dashboard/owner";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <main className="flex flex-col items-center gap-6 text-center max-w-sm">
        <DomioLogo className="h-12 w-auto mx-auto" />
        <p className="text-muted-foreground text-sm">
          Condo Management (HOA)
        </p>
        <div className="flex flex-col gap-3 w-full">
          {user ? (
            <>
              <Button asChild className="w-full">
                <Link href={dashboardHref}>Dashboard</Link>
              </Button>
              <form action="/api/auth/signout" method="post">
                <Button type="submit" variant="outline" className="w-full">
                  Sign out
                </Button>
              </form>
            </>
          ) : (
            <>
              <Button asChild className="w-full">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/signup">Sign up</Link>
              </Button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
