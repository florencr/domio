import { NextResponse } from "next/server";
import { requireManagerBuilding } from "@/lib/energy/require-manager-building";
import { logAudit } from "@/lib/audit";

type ShareInput = { unit_id: string; share_percent: number };

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const buildingId = typeof body.building_id === "string" ? body.building_id : "";
    const r = await requireManagerBuilding(buildingId);
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, user, siteId, buildingId: bid } = r;

    const shares = Array.isArray(body.shares) ? (body.shares as ShareInput[]) : [];
    if (!shares.length) return NextResponse.json({ error: "shares array required" }, { status: 400 });

    const { data: buildingUnits } = await admin.from("units").select("id").eq("building_id", bid);
    const unitIds = new Set((buildingUnits ?? []).map((u: { id: string }) => u.id));

    let total = 0;
    const rows: { building_id: string; unit_id: string; share_percent: number }[] = [];
    const seen = new Set<string>();

    for (const s of shares) {
      const uid = typeof s.unit_id === "string" ? s.unit_id : "";
      const pct = Number(s.share_percent);
      if (!uid || !unitIds.has(uid)) {
        return NextResponse.json({ error: "Invalid unit in shares" }, { status: 400 });
      }
      if (seen.has(uid)) return NextResponse.json({ error: "Duplicate unit in shares" }, { status: 400 });
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) {
        return NextResponse.json({ error: "share_percent must be 0–100" }, { status: 400 });
      }
      seen.add(uid);
      total += pct;
      rows.push({ building_id: bid, unit_id: uid, share_percent: Math.round(pct * 100) / 100 });
    }

    const totalRounded = Math.round(total * 100) / 100;
    if (totalRounded !== 100) {
      return NextResponse.json(
        { error: `Shares must sum to 100% (currently ${totalRounded}%)` },
        { status: 400 }
      );
    }

    const { error: delErr } = await admin.from("energy_unit_shares").delete().eq("building_id", bid);
    if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 });

    const { data: inserted, error: insErr } = await admin
      .from("energy_unit_shares")
      .insert(rows)
      .select("id,building_id,unit_id,share_percent");
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 });

    await logAudit({
      user_id: user.id,
      user_email: user.email ?? undefined,
      action: "update",
      entity_type: "energy_unit_shares",
      entity_label: `Building ${bid}`,
      site_id: siteId,
      new_values: { shares: rows },
    });

    return NextResponse.json({ shares: inserted ?? [], shareTotalPercent: 100 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
