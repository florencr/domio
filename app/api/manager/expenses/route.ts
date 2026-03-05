import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function requireManager() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "manager") return { ok: false as const, status: 403, error: "Manager only" };
  const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
  const siteId = site?.id ?? null;
  return { ok: true as const, admin, siteId };
}

export async function POST(request: Request) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;

    const body = await request.json();
    const { title, category, vendor, amount, frequency: freq } = body;
    if (!title?.trim() || !category?.trim() || !vendor?.trim()) return NextResponse.json({ error: "title, category, vendor required" }, { status: 400 });

    const insert: Record<string, unknown> = {
      title: title.trim(),
      category: category.trim(),
      vendor: vendor.trim(),
      amount: typeof amount === "number" ? amount : parseFloat(String(amount)) || 0,
      frequency: freq || "recurrent",
    };
    if (siteId) insert.site_id = siteId;

    const { data, error } = await admin.from("expenses").insert(insert).select("id").single();
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;

    const body = await request.json();
    const { id, title, category, vendor, amount, frequency: freq } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data: existing } = await admin.from("expenses").select("site_id").eq("id", id).single();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (siteId && (existing as { site_id?: string }).site_id && (existing as { site_id: string }).site_id !== siteId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const update: Record<string, unknown> = {};
    if (title !== undefined) update.title = title.trim();
    if (category !== undefined) update.category = category.trim();
    if (vendor !== undefined) update.vendor = vendor.trim();
    if (amount !== undefined) update.amount = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0;
    if (freq !== undefined) update.frequency = freq;

    const { error } = await admin.from("expenses").update(update).eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data: existing } = await admin.from("expenses").select("site_id").eq("id", id).single();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (siteId && (existing as { site_id?: string }).site_id && (existing as { site_id: string }).site_id !== siteId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await admin.from("expenses").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
