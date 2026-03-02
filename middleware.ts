import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const authRoutes = ["/login", "/signup"];

export async function middleware(request: NextRequest) {
  try {
  // #region agent log
  try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'middleware.ts:entry',message:'middleware entered',data:{path:request.nextUrl.pathname},timestamp:Date.now(),hypothesisId:'M1'})}).catch(()=>{}); } catch {}
  // #endregion
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Use getSession() - reads from cookies, NO network call, never hangs
  // #region agent log
  try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'middleware.ts:beforeGetSession',message:'before getSession',data:{},timestamp:Date.now(),hypothesisId:'M2'})}).catch(()=>{}); } catch {}
  // #endregion
  const { data: { session } } = await supabase.auth.getSession();
  const user = session?.user ?? null;
  // #region agent log
  try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'middleware.ts:afterGetSession',message:'getSession ok',data:{hasUser:!!user},timestamp:Date.now(),hypothesisId:'M3'})}).catch(()=>{}); } catch {}
  // #endregion

  const path = request.nextUrl.pathname;
  const isAuthRoute = authRoutes.some((r) => path.startsWith(r));

  if (user && isAuthRoute) return NextResponse.redirect(new URL("/", request.url));
  if (!user && !isAuthRoute && path !== "/") return NextResponse.redirect(new URL("/login", request.url));

  return response;
  } catch (e) {
  // #region agent log
  try { fetch('http://127.0.0.1:7501/ingest/1fdb80d6-7452-4691-8afc-44262107b98e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1e53a2'},body:JSON.stringify({sessionId:'1e53a2',location:'middleware.ts:catch',message:'middleware threw',data:{err:String(e),msg:e instanceof Error?e.message:'?'},timestamp:Date.now(),hypothesisId:'M4'})}).catch(()=>{}); } catch {}
  // #endregion
  throw e;
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
