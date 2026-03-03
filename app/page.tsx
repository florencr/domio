"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

export default function HomePage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

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

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setLoginLoading(false);
      setLoginError(err.message);
      return;
    }
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
    const r = profile?.role;
    const dashboard = r === "admin" ? "/dashboard/admin" : r === "manager" ? "/dashboard/manager" : r === "tenant" ? "/dashboard/tenant" : "/dashboard/owner";
    setLoginLoading(false);
    window.location.href = dashboard;
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  const dashboardHref = role === "admin" ? "/dashboard/admin" : role === "manager" ? "/dashboard/manager" : role === "tenant" ? "/dashboard/tenant" : "/dashboard/owner";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <main className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
        <Image src="/domio-icon.png" alt="Domio" width={160} height={160} className="mx-auto" priority />
        <p className="text-muted-foreground text-sm">
          Condo Management (HOA)
        </p>
        {user ? (
          <div className="flex flex-col gap-3 w-full">
            <Button asChild className="w-full">
              <Link href={dashboardHref}>Dashboard</Link>
            </Button>
            <form action="/api/auth/signout" method="post">
              <Button type="submit" variant="outline" className="w-full">
                Sign out
              </Button>
            </form>
          </div>
        ) : (
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex justify-center">
                <Image src="/domio-icon.png" alt="Domio" width={120} height={120} className="mx-auto" priority />
              </CardTitle>
              <CardDescription>Sign in to your account</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4">
                {loginError && (
                  <p className="text-sm text-destructive" role="alert">{loginError}</p>
                )}
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3 pt-4">
                <Button type="submit" className="w-full" disabled={loginLoading}>
                  {loginLoading ? "Signing in…" : "Sign in"}
                </Button>
                <Link href="/signup" className="text-sm text-muted-foreground">
                  Don't have an account? Sign up
                </Link>
              </CardFooter>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}
