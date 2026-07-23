import { NextResponse } from "next/server";
import { requireManagerSite } from "@/lib/polls/require-manager-site";
import { parseUnitsCsv } from "@/lib/units/csv";
import { findOrCreateSiteOwner, loadProfileImportContext } from "@/lib/units/resolve-profile";
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

function normBuildingName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

async function ensureBuilding(
  admin: SupabaseClient,
  siteId: string,
  buildingName: string,
  buildingByName: Map<string, string>
): Promise<string | null> {
  const key = normBuildingName(buildingName);
  const existing = buildingByName.get(key);
  if (existing) return existing;

  const { data: site } = await admin.from("sites").select("address").eq("id", siteId).maybeSingle();
  const address = ((site as { address?: string } | null)?.address ?? buildingName.trim()) || buildingName.trim();

  const { data: inserted, error } = await admin
    .from("buildings")
    .insert({ name: buildingName.trim(), site_id: siteId, address })
    .select("id")
    .single();

  if (error || !inserted) return null;
  const id = (inserted as { id: string }).id;
  buildingByName.set(key, id);
  return id;
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
    if (!parsed.length) {
      return NextResponse.json({ error: "No data rows in CSV. Check building, unit_name and type columns." }, { status: 400 });
    }

    const profileCtx = await loadProfileImportContext(admin, siteId);
    const ownerCache = new Map<string, string>();

    const { data: buildings } = await admin.from("buildings").select("id,name").eq("site_id", siteId);
    const buildingByName = new Map<string, string>();
    for (const b of buildings ?? []) {
      buildingByName.set(normBuildingName((b as { name: string }).name), (b as { id: string }).id);
    }

    const buildingIds = [...buildingByName.values()];
    const { data: existingUnits } = buildingIds.length
      ? await admin.from("units").select("id,unit_name,building_id").in("building_id", buildingIds)
      : { data: [] };

    const unitByBuildingAndName = new Map<string, string>();
    for (const u of existingUnits ?? []) {
      const row = u as { id: string; unit_name: string; building_id: string };
      unitByBuildingAndName.set(`${row.building_id}::${row.unit_name.trim().toLowerCase()}`, row.id);
    }

    let created = 0;
    let updated = 0;
    let ownersCreated = 0;
    let buildingsCreated = 0;
    const skipped: string[] = [];
    const warnings: string[] = [];

    for (let rowIndex = 0; rowIndex < parsed.length; rowIndex++) {
      const row = parsed[rowIndex];
      const label = `${row.building} / ${row.unit_name}`;
      let buildingId = buildingByName.get(normBuildingName(row.building));
      if (!buildingId) {
        buildingId = (await ensureBuilding(admin, siteId, row.building, buildingByName)) ?? undefined;
        if (buildingId) buildingsCreated++;
      }
      if (!buildingId) {
        skipped.push(`${label} (building not found: ${row.building})`);
        continue;
      }

      const sizeM2 = row.size_m2 ? parseFloat(String(row.size_m2).replace(",", ".")) : null;
      const unitPayload = {
        building_id: buildingId,
        unit_name: row.unit_name.trim(),
        type: row.type.trim(),
        size_m2: sizeM2 != null && !Number.isNaN(sizeM2) ? sizeM2 : null,
        block: row.block.trim() || null,
        entrance: row.entrance.trim() || null,
        floor: row.floor.trim() || null,
      };

      let unitId = unitByBuildingAndName.get(`${buildingId}::${row.unit_name.trim().toLowerCase()}`);
      if (unitId) {
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
        unitByBuildingAndName.set(`${buildingId}::${row.unit_name.trim().toLowerCase()}`, unitId);
        created++;
      }

      const ownerEmail = row.owner_email.trim().toLowerCase();
      const ownerName = row.owner_name.trim();
      const ownerSurname = row.owner_surname.trim();
      const ownerPhone = row.owner_phone.trim();
      const hasOwnerInfo = !!(ownerEmail || ownerName || ownerSurname || ownerPhone);

      if (hasOwnerInfo) {
        const resolved = await findOrCreateSiteOwner(
          admin,
          siteId,
          { email: ownerEmail, name: ownerName, surname: ownerSurname, phone: ownerPhone },
          ownerCache,
          profileCtx,
          String(rowIndex + 1)
        );
        if (!resolved.ok) {
          warnings.push(`${label}: ${resolved.error}`);
        } else {
          if (resolved.created) ownersCreated++;
          try {
            await assignOwner(admin, unitId, resolved.userId);
          } catch (e) {
            warnings.push(`${label}: owner assign failed (${e instanceof Error ? e.message : "error"})`);
          }
        }
      }

      const tenantEmail = row.tenant_email.trim().toLowerCase();
      if (tenantEmail) {
        const tenantId = profileCtx.byEmail.get(tenantEmail)?.id;
        if (!tenantId) {
          warnings.push(`${label}: tenant email not found (${row.tenant_email})`);
        } else {
          try {
            await assignTenant(admin, unitId, tenantId);
          } catch (e) {
            warnings.push(`${label}: tenant assign failed (${e instanceof Error ? e.message : "error"})`);
          }
        }
      }
    }

    if (created + updated === 0) {
      return NextResponse.json(
        {
          error: skipped.length
            ? `No units imported. First issues: ${skipped.slice(0, 3).join("; ")}`
            : "No units imported.",
          skipped,
          warnings,
        },
        { status: 400 }
      );
    }

    return NextResponse.json({
      created,
      updated,
      imported: created + updated,
      ownersCreated,
      buildingsCreated,
      skipped,
      warnings,
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
