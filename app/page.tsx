"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { OAuthButtons } from "@/components/OAuthButtons";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function HomePage() {
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
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
        let role: string | null = null;
        try {
          const apiRes = await fetch("/api/profile");
          if (apiRes.ok) {
            const p = await apiRes.json();
            role = p?.role ?? null;
          }
        } catch {}
        if (role == null) {
          const { data: profile } = await supabase.from("profiles").select("role").eq("id", session.user.id).single();
          role = profile?.role ?? null;
        }
        setRole(role);
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
    let profile: { role?: string } | null = null;
    try {
      const apiRes = await fetch("/api/profile");
      if (apiRes.ok) profile = await apiRes.json();
    } catch {}
    if (!profile) {
      const res = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
      profile = res.data;
    }
    const r = profile?.role;
    const dashboard = r === "admin" ? "/dashboard/admin" : r === "manager" ? "/dashboard/manager" : r === "tenant" ? "/dashboard/tenant" : "/dashboard/owner";
    setLoginLoading(false);
    window.location.href = dashboard;
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-muted-foreground">Loading...</p></div>;

  const dashboardHref = role === "admin" ? "/dashboard/admin" : role === "manager" ? "/dashboard/manager" : role === "tenant" ? "/dashboard/tenant" : "/dashboard/owner";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <div className="fixed top-4 right-4">
        <ThemeToggle />
      </div>
      <main className="flex flex-col items-center gap-6 text-center max-w-sm w-full">
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
            <CardHeader className="pb-2">
              <div className="flex flex-col items-center gap-1.5 mb-6">
                <Image src="/domio-icon.webp" alt="Domio" width={120} height={120} className="mx-auto bg-transparent dark:invert dark:opacity-95" priority />
                <span className="font-bold text-foreground">Condo Management (HOA)</span>
              </div>
              <CardDescription className="text-center -mt-4 mb-1">Sign in to your account</CardDescription>
            </CardHeader>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4 pt-0">
                <OAuthButtons />
                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
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
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="current-password"
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute right-0 top-0 h-9 w-9 shrink-0"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <Label htmlFor="remember" className="text-sm font-normal cursor-pointer">Save password</Label>
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
