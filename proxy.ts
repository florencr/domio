import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/** Refreshes Supabase auth cookies so Route Handlers (e.g. polls API) see the session. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!url || !anon) return response;

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

/** Only paths that need a refreshed auth cookie. Skips `/`, assets, manifest — avoids a Supabase round-trip on every unrelated request (faster clicks / navigations in dev). */
export const config = {
  matcher: [
    "/dashboard",
    "/dashboard/:path*",
    "/api/:path*",
    "/auth/:path*",
    "/login",
    "/signup",
  ],
};
