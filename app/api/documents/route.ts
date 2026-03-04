import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

async function requireManager() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: "Not authenticated" };
  const { data: profile } = await sb.from("profiles").select("role").eq("id", user.id).single();
  if ((profile as { role?: string } | null)?.role !== "manager") return { ok: false as const, status: 403, error: "Manager only" };
  const admin = createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
  const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).single();
  const siteId = (site as { id: string } | null)?.id ?? null;
  return { ok: true as const, admin, user, siteId };
}

export async function GET(request: Request) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;
    const { searchParams } = new URL(request.url);
    const buildingId = searchParams.get("buildingId");
    const unitId = searchParams.get("unitId");
    const expenseId = searchParams.get("expenseId");

    if (expenseId) {
      const { data: expense } = await admin.from("expenses").select("site_id").eq("id", expenseId).single();
      if (!expense || (expense as { site_id: string | null }).site_id !== siteId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      const { data, error } = await admin.from("documents").select("id,name,path,mime_type,size_bytes,category,created_at,unit_id,expense_id")
        .eq("expense_id", expenseId).order("created_at", { ascending: false });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ documents: data ?? [] });
    }

    if (!buildingId) return NextResponse.json({ error: "buildingId or expenseId required" }, { status: 400 });
    const { data: building } = await admin.from("buildings").select("site_id").eq("id", buildingId).single();
    if (!building || (building as { site_id: string }).site_id !== siteId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    let query = admin.from("documents").select("id,name,path,mime_type,size_bytes,category,created_at,unit_id,expense_id").eq("building_id", buildingId);
    if (unitId) query = query.eq("unit_id", unitId);
    else query = query.is("unit_id", null);
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ documents: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const r = await requireManager();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, siteId } = r;
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const buildingId = formData.get("buildingId") as string | null;
    const unitId = (formData.get("unitId") as string) || null;
    const expenseId = formData.get("expenseId") as string | null;
    const category = (formData.get("category") as string) || "other";

    const validCategories = ["contract", "maintenance", "invoice", "other"];
    const cat = validCategories.includes(category) ? category : "other";

    if (!file) return NextResponse.json({ error: "file required" }, { status: 400 });

    if (expenseId) {
      const { data: expense } = await admin.from("expenses").select("site_id").eq("id", expenseId).single();
      if (!expense || (expense as { site_id: string | null }).site_id !== siteId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      const path = `${siteId}/expense/${expenseId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
      const { error: upErr } = await admin.storage.from("documents").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });
      const { data: doc, error: insErr } = await admin.from("documents").insert({
        building_id: null,
        unit_id: null,
        expense_id: expenseId,
        name: file.name,
        path,
        mime_type: file.type || null,
        size_bytes: file.size,
        category: cat,
        uploaded_by: user.id,
      }).select("id,name,path,category,created_at").single();
      if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
      return NextResponse.json({ document: doc });
    }

    if (!buildingId) return NextResponse.json({ error: "buildingId or expenseId required" }, { status: 400 });
    const { data: building } = await admin.from("buildings").select("site_id").eq("id", buildingId).single();
    if (!building || (building as { site_id: string }).site_id !== siteId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

    const path = `${siteId}/${buildingId}/${unitId || "building"}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
    const { error: upErr } = await admin.storage.from("documents").upload(path, await file.arrayBuffer(), { contentType: file.type, upsert: false });
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 400 });

    const { data: doc, error: insErr } = await admin.from("documents").insert({
      building_id: buildingId,
      unit_id: unitId || null,
      expense_id: null,
      name: file.name,
      path,
      mime_type: file.type || null,
      size_bytes: file.size,
      category: cat,
      uploaded_by: user.id,
    }).select("id,name,path,category,created_at").single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });
    return NextResponse.json({ document: doc });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Unknown error" }, { status: 500 });
  }
}
