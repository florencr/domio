import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Manager only" }, { status: 403 });

    const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
    const siteId = site?.id ?? null;

    const { data: unitTypes, error } = await admin.from("unit_types").select("id,name,site_id");
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const filtered = (unitTypes ?? []).filter(
      (ut: { site_id?: string | null }) => !ut.site_id || ut.site_id === siteId
    );
    return NextResponse.json(filtered);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured. Add it to .env.local (Supabase Dashboard > Settings > API)" }, { status: 500 });
    }
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Manager only" }, { status: 403 });

    const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
    const siteId = site?.id ?? null;

    const { name } = await request.json();
    if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

    const { data, error } = await admin.from("unit_types").insert({
      name: name.trim(),
      site_id: siteId,
    }).select("id,name,site_id").single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Manager only" }, { status: 403 });

    const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
    const siteId = site?.id ?? null;

    const { id, name } = await request.json();
    if (!id || !name?.trim()) return NextResponse.json({ error: "id and name required" }, { status: 400 });

    const { data: existing } = await admin.from("unit_types").select("site_id").eq("id", id).single();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.site_id && existing.site_id !== siteId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { data, error } = await admin.from("unit_types").update({ name: name.trim() }).eq("id", id).select("id,name,site_id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const sb = await createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const admin = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Manager only" }, { status: 403 });

    const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
    const siteId = site?.id ?? null;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data: existing } = await admin.from("unit_types").select("site_id").eq("id", id).single();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (existing.site_id && existing.site_id !== siteId) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { error } = await admin.from("unit_types").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
