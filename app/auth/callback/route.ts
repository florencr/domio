import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error`);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/auth/auth-code-error?message=${encodeURIComponent(error.message)}`);
  }

  const user = data.user;
  if (user) {
    const { data: existing } = await supabase.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (!existing) {
      const meta = user.user_metadata ?? {};
      const fullName = meta.full_name ?? meta.name ?? meta.email ?? "User";
      const parts = String(fullName).trim().split(/\s+/);
      const name = parts[0] ?? "User";
      const surname = parts.slice(1).join(" ") || name;
      const email = user.email ?? meta.email ?? `${user.id}@oauth.user`;

      const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      if (serviceKey && url) {
        const admin = createAdminClient(url, serviceKey, {
          auth: { autoRefreshToken: false, persistSession: false },
        });
        const { error: insErr } = await admin.from("profiles").insert({
          id: user.id,
          name,
          surname,
          email,
          role: "resident",
        });
        if (insErr) {
          const { error: fallbackErr } = await admin.from("profiles").insert({
            id: user.id,
            name,
            surname,
            email,
            role: "owner",
          });
          if (fallbackErr) {
            console.error("OAuth profile insert failed:", insErr.message, fallbackErr.message);
          }
        }
      } else {
        await supabase.from("profiles").insert({
          id: user.id,
          name,
          surname,
          email,
          role: "resident",
        });
      }
    }
  }

  const path = next.startsWith("/") ? next : "/dashboard";
  return NextResponse.redirect(`${origin}${path}`);
}
