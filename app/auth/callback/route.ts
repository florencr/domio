import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

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
    const { data: profile } = await supabase.from("profiles").select("id").eq("id", user.id).single();
    if (!profile) {
      const meta = user.user_metadata ?? {};
      const fullName = meta.full_name ?? meta.name ?? meta.email ?? "User";
      const parts = String(fullName).trim().split(/\s+/);
      const name = parts[0] ?? "User";
      const surname = parts.slice(1).join(" ") || name;
      const email = user.email ?? meta.email ?? `${user.id}@oauth.user`;
      await supabase.from("profiles").insert({
        id: user.id,
        name,
        surname,
        email,
        role: "resident",
      });
    }
  }

  const path = next.startsWith("/") ? next : "/";
  return NextResponse.redirect(`${origin}${path}`);
}
