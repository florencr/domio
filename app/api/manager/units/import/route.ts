import { NextResponse } from "next/server";
import { requireManagerSite } from "@/lib/polls/require-manager-site";
import { parseUnitsCsv } from "@/lib/units/csv";
import { replaceOwnerMembership, replaceTenantMembership } from "@/lib/unit-memberships";
import type { SupabaseClient } from "@supabase/supabase-js";

async function assignOwner(admin: SupabaseClient, unitId: string, ownerId: string | null) {
  if (ownerId) {
    const { data: existingOwner } = await admin.from("unit_owners").select("owner_id").eq("unit_id", unitId).maybeSingle();
    const currentOwnerId = (existingOwner as { owner_id: string } | null)?.owner_id;
    if (currentOwnerId && currentOwnerId !== ownerId) {
      await admin.from("unit_owners").delete().eq("unit_id", unitId);
    }
    if (!currentOwnerId || currentOwnerId !== ownerId) {
      const { error } = await admin.from("unit_owners").insert({ unit_id: unitId, owner_id: ownerId });
      if (error) throw error;
      await replaceOwnerMembership(admin, unitId, ownerId);
    }
  } else {
    await admin.from("unit_owners").delete().eq("unit_id", unitId);
    await replaceOwnerMembership(admin, unitId, null);
  }
}

async function assignTenant(admin: SupabaseClient, unitId: string, tenantId: string | null) {
  if (tenantId) {
    const { data: existingTenant } = await admin
      .from("unit_tenant_assignments")
      .select("tenant_id")
      .eq("unit_id", unitId)
      .maybeSingle();
    const currentTenantId = (existingTenant as { tenant_id: string } | null)?.tenant_id;
    if (currentTenantId && currentTenantId !== tenantId) {
      await admin.from("unit_tenant_assignments").delete().eq("unit_id", unitId);
    }
    if (!currentTenantId || currentTenantId !== tenantId) {
      const { error } = await admin.from("unit_tenant_assignments").insert({
        unit_id: unitId,
        tenant_id: tenantId,
        is_payment_responsible: true,
      });
      if (error) throw error;
      await replaceTenantMembership(admin, unitId, tenantId, true);
    }
  } else {
    await admin.from("unit_tenant_assignments").delete().eq("unit_id", unitId);
    await replaceTenantMembership(admin, unitId, null, false);
  }
}

export async function POST(request: Request) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;

    const body = await request.json();
    const csv = typeof body.csv === "string" ? body.csv : "";
    if (!csv.trim()) return NextResponse.json({ error: "csv text required" }, { status: 400 });

    let parsed;
    try {
      parsed = parseUnitsCsv(csv);
    } catch (e) {
      return NextResponse.json({ error: e instanceof Error ? e.message : "Invalid CSV" }, { status: 400 });
    }
    if (!parsed.length) return NextResponse.json({ error: "No data rows in CSV" }, { status: 400 });

    const { data: buildings } = await admin.from("buildings").select("id,name").eq("site_id", siteId);
    const buildingByName = new Map<string, string>();
    for (const b of buildings ?? []) {
      buildingByName.set((b as { name: string }).name.trim().toLowerCase(), (b as { id: string }).id);
    }

    const buildingIds = (buildings ?? []).map((b: { id: string }) => b.id);
    const { data: existingUnits } = buildingIds.length
      ? await admin
          .from("units")
          .select("id,unit_name,building_id")
          .in("building_id", buildingIds)
      : { data: [] };

    const unitById = new Map<string, { id: string; unit_name: string; building_id: string }>();
    const unitByBuildingAndName = new Map<string, string>();
    for (const u of existingUnits ?? []) {
      const row = u as { id: string; unit_name: string; building_id: string };
      unitById.set(row.id, row);
      unitByBuildingAndName.set(`${row.building_id}::${row.unit_name.trim().toLowerCase()}`, row.id);
    }

    const { data: allProfiles } = await admin.from("profiles").select("id,email,role");
    const profileByEmail = new Map<string, string>();
    for (const p of allProfiles ?? []) {
      const email = ((p as { email: string }).email ?? "").trim().toLowerCase();
      if (email) profileByEmail.set(email, (p as { id: string }).id);
    }

    let created = 0;
    let updated = 0;
    const skipped: string[] = [];
    const warnings: string[] = [];

    for (const row of parsed) {
      const label = `${row.building} / ${row.unit_name}`;
      const buildingId = buildingByName.get(row.building.trim().toLowerCase());
      if (!buildingId) {
        skipped.push(`${label} (building not found)`);
        continue;
      }

      const sizeM2 = row.size_m2 ? parseFloat(row.size_m2) : null;
      const unitPayload = {
        building_id: buildingId,
        unit_name: row.unit_name.trim(),
        type: row.type.trim(),
        size_m2: sizeM2 != null && !Number.isNaN(sizeM2) ? sizeM2 : null,
        block: row.block.trim() || null,
        entrance: row.entrance.trim() || null,
        floor: row.floor.trim() || null,
      };

      let unitId = row.unit_id.trim();
      if (unitId) {
        const existing = unitById.get(unitId);
        if (!existing || !buildingIds.includes(existing.building_id)) {
          skipped.push(`${label} (unit_id not found in your site)`);
          continue;
        }
        const { error } = await admin.from("units").update(unitPayload).eq("id", unitId);
        if (error) {
          skipped.push(`${label} (${error.message})`);
          continue;
        }
        updated++;
      } else {
        const existingId = unitByBuildingAndName.get(`${buildingId}::${row.unit_name.trim().toLowerCase()}`);
        if (existingId) {
          unitId = existingId;
          const { error } = await admin.from("units").update(unitPayload).eq("id", unitId);
          if (error) {
            skipped.push(`${label} (${error.message})`);
            continue;
          }
          updated++;
        } else {
          const { data: inserted, error } = await admin.from("units").insert(unitPayload).select("id").single();
          if (error || !inserted) {
            skipped.push(`${label} (${error?.message ?? "insert failed"})`);
            continue;
          }
          unitId = (inserted as { id: string }).id;
          unitById.set(unitId, { id: unitId, unit_name: unitPayload.unit_name, building_id: buildingId });
          unitByBuildingAndName.set(`${buildingId}::${row.unit_name.trim().toLowerCase()}`, unitId);
          created++;
        }
      }

      const ownerEmail = row.owner_email.trim().toLowerCase();
      if (ownerEmail) {
        const ownerId = profileByEmail.get(ownerEmail);
        if (!ownerId) {
          warnings.push(`${label}: owner email not found (${row.owner_email})`);
        } else {
          try {
            await assignOwner(admin, unitId, ownerId);
          } catch (e) {
            warnings.push(`${label}: owner assign failed (${e instanceof Error ? e.message : "error"})`);
          }
        }
      } else {
        try {
          await assignOwner(admin, unitId, null);
        } catch (e) {
          warnings.push(`${label}: clear owner failed (${e instanceof Error ? e.message : "error"})`);
        }
      }

      const tenantEmail = row.tenant_email.trim().toLowerCase();
      if (tenantEmail) {
        const tenantId = profileByEmail.get(tenantEmail);
        if (!tenantId) {
          warnings.push(`${label}: tenant email not found (${row.tenant_email})`);
        } else {
          try {
            await assignTenant(admin, unitId, tenantId);
          } catch (e) {
            warnings.push(`${label}: tenant assign failed (${e instanceof Error ? e.message : "error"})`);
          }
        }
      } else {
        try {
          await assignTenant(admin, unitId, null);
        } catch (e) {
          warnings.push(`${label}: clear tenant failed (${e instanceof Error ? e.message : "error"})`);
        }
      }
    }

    return NextResponse.json({
      created,
      updated,
      imported: created + updated,
      skipped,
      warnings,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
