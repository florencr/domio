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
    const listAll = searchParams.get("listAll") === "1";

    if (listAll && siteId) {
      const { data: buildings } = await admin.from("buildings").select("id,name").eq("site_id", siteId);
      const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
      const buildingMap = new Map((buildings ?? []).map((b: { id: string; name: string }) => [b.id, b.name]));
      const { data: expenses } = await admin.from("expenses").select("id").eq("site_id", siteId);
      const expenseIds = (expenses ?? []).map((e: { id: string }) => e.id);
      const docsByBuilding = buildingIds.length > 0
        ? await admin.from("documents").select("id,name,path,mime_type,size_bytes,category,created_at,building_id,unit_id,expense_id").in("building_id", buildingIds).order("created_at", { ascending: false })
        : { data: [] };
      const docsByExpense = expenseIds.length > 0
        ? await admin.from("documents").select("id,name,path,mime_type,size_bytes,category,created_at,building_id,unit_id,expense_id").in("expense_id", expenseIds).order("created_at", { ascending: false })
        : { data: [] };
      const allDocs = [...(docsByBuilding.data ?? []), ...(docsByExpense.data ?? [])].sort((a, b) => new Date((b as { created_at: string }).created_at).getTime() - new Date((a as { created_at: string }).created_at).getTime());
      const unitIds = [...new Set(allDocs.map((d: { unit_id?: string | null }) => d.unit_id).filter(Boolean))] as string[];
      const { data: units } = unitIds.length > 0 ? await admin.from("units").select("id,unit_name,building_id").in("id", unitIds) : { data: [] };
      const unitMap = new Map((units ?? []).map((u: { id: string; unit_name: string; building_id: string }) => [u.id, { name: u.unit_name, buildingId: u.building_id }]));
      const docsWithNames = allDocs.map((d: { id: string; name: string; building_id?: string | null; unit_id?: string | null; expense_id?: string | null; [k: string]: unknown }) => {
        const bId = d.building_id;
        const uId = d.unit_id;
        const buildingName = bId ? buildingMap.get(bId) ?? "—" : (d.expense_id ? "Expense" : "—");
        const unitInfo = uId ? unitMap.get(uId) : null;
        const unitName = uId ? (unitInfo?.name ?? "—") : "—";
        return { ...d, building_name: buildingName, unit_name: unitName };
      });
      return NextResponse.json({ documents: docsWithNames });
    }

    if (expenseId) {
      const { data: expense } = await admin.from("expenses").select("site_id").eq("id", expenseId).single();
      if (!expense || (expense as { site_id: string | null }).site_id !== siteId) return NextResponse.json({ error: "Not authorized" }, { status: 403 });
      const { data, error } = await admin.from("documents").select("id,name,path,mime_type,size_bytes,category,created_at,unit_id,expense_id,building_id")
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
