import { NextResponse } from "next/server";
import { requireManagerSite } from "@/lib/polls/require-manager-site";

export async function GET() {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;

    const { data: buildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
    const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
    if (!buildingIds.length) return NextResponse.json([]);

    const allUnits: Record<string, unknown>[] = [];
    const pageSize = 500;
    let from = 0;
    while (true) {
      const { data, error } = await admin
        .from("units")
        .select("id,unit_name,type,size_m2,building_id,entrance,floor,block")
        .in("building_id", buildingIds)
        .order("unit_name")
        .range(from, from + pageSize - 1);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const batch = data ?? [];
      allUnits.push(...batch);
      if (batch.length < pageSize) break;
      from += pageSize;
    }

    return NextResponse.json(allUnits);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
