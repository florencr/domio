import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-muted/30">
      <main className="flex flex-col items-center gap-6 text-center max-w-sm">
        <h1 className="text-2xl font-semibold">Domio</h1>
        <p className="text-muted-foreground text-sm">
          Condo Management (HOA)
        </p>
        <div className="flex flex-col gap-3 w-full">
          {user ? (
            <>
              <Button asChild className="w-full">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <Button asChild variant="outline" className="w-full">
                <Link href="/dashboard/manager">Manager dashboard</Link>
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
