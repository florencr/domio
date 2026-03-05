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
    const { name, unit_type: unitType, category, pricing_model: pricing, price_value: price, frequency: freq } = body;
    if (!name?.trim() || !unitType?.trim()) return NextResponse.json({ error: "name and unit_type required" }, { status: 400 });

    const insert: Record<string, unknown> = {
      name: name.trim(),
      unit_type: unitType.trim(),
      category: category?.trim() || null,
      pricing_model: pricing || "fixed_per_unit",
      price_value: typeof price === "number" ? price : parseFloat(String(price)) || 0,
      frequency: freq || "recurrent",
    };
    if (siteId) insert.site_id = siteId;

    const { data, error } = await admin.from("services").insert(insert).select("id").single();
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
    const { id, name, unit_type: unitType, category, pricing_model: pricing, price_value: price, frequency: freq } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const { data: existing } = await admin.from("services").select("site_id").eq("id", id).single();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (siteId && (existing as { site_id?: string }).site_id && (existing as { site_id: string }).site_id !== siteId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = name.trim();
    if (unitType !== undefined) update.unit_type = unitType.trim();
    if (category !== undefined) update.category = category?.trim() || null;
    if (pricing !== undefined) update.pricing_model = pricing;
    if (price !== undefined) update.price_value = typeof price === "number" ? price : parseFloat(String(price)) || 0;
    if (freq !== undefined) update.frequency = freq;

    const { error } = await admin.from("services").update(update).eq("id", id);
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

    const { data: existing } = await admin.from("services").select("site_id").eq("id", id).single();
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (siteId && (existing as { site_id?: string }).site_id && (existing as { site_id: string }).site_id !== siteId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { error } = await admin.from("services").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
