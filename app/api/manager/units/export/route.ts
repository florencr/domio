import { NextResponse } from "next/server";
import { requireManagerSite } from "@/lib/polls/require-manager-site";
import { unitsToCsv } from "@/lib/units/csv";

type ProfileRow = {
  id: string;
  name: string;
  surname: string;
  email: string;
  phone: string | null;
  contact_email: string | null;
};

function profileFields(p: ProfileRow | null | undefined) {
  if (!p) {
    return {
      email: "",
      name: "",
      surname: "",
      phone: "",
      contact_email: "",
    };
  }
  return {
    email: p.email ?? "",
    name: p.name ?? "",
    surname: p.surname ?? "",
    phone: p.phone ?? "",
    contact_email: p.contact_email ?? "",
  };
}

export async function GET(request: Request) {
  try {
    const r = await requireManagerSite();
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status });
    const { admin, siteId } = r;

    const { searchParams } = new URL(request.url);
    const buildingFilter = searchParams.get("building_id")?.trim() ?? "";

    const { data: buildings } = await admin.from("buildings").select("id,name").eq("site_id", siteId);
    const buildingList = buildings ?? [];
    const buildingMap = new Map(buildingList.map((b: { id: string; name: string }) => [b.id, b.name]));
    const buildingIds = buildingFilter
      ? buildingMap.has(buildingFilter)
        ? [buildingFilter]
        : []
      : buildingList.map((b: { id: string }) => b.id);

    if (!buildingIds.length) {
      const csv = "\uFEFF" + unitsToCsv([]);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="units-export.csv"',
        },
      });
    }

    const { data: units } = await admin
      .from("units")
      .select("id,unit_name,type,size_m2,block,entrance,floor,building_id")
      .in("building_id", buildingIds)
      .order("unit_name");

    const unitIds = (units ?? []).map((u: { id: string }) => u.id);
    const ownerByUnit = new Map<string, string>();
    const tenantByUnit = new Map<string, string>();
    const profileIds = new Set<string>();

    if (unitIds.length) {
      const [{ data: unitOwners }, { data: unitTenants }] = await Promise.all([
        admin.from("unit_owners").select("unit_id,owner_id").in("unit_id", unitIds),
        admin.from("unit_tenant_assignments").select("unit_id,tenant_id").in("unit_id", unitIds),
      ]);
      for (const o of unitOwners ?? []) {
        ownerByUnit.set((o as { unit_id: string }).unit_id, (o as { owner_id: string }).owner_id);
        profileIds.add((o as { owner_id: string }).owner_id);
      }
      for (const t of unitTenants ?? []) {
        tenantByUnit.set((t as { unit_id: string }).unit_id, (t as { tenant_id: string }).tenant_id);
        profileIds.add((t as { tenant_id: string }).tenant_id);
      }
    }

    const profileMap = new Map<string, ProfileRow>();
    if (profileIds.size) {
      const { data: profiles } = await admin
        .from("profiles")
        .select("id,name,surname,email,phone,contact_email")
        .in("id", [...profileIds]);
      for (const p of profiles ?? []) {
        profileMap.set((p as ProfileRow).id, p as ProfileRow);
      }
    }

    const rows = (units ?? []).map((u: {
      id: string;
      unit_name: string;
      type: string;
      size_m2: number | null;
      block: string | null;
      entrance: string | null;
      floor: string | null;
      building_id: string;
    }) => {
      const owner = profileFields(profileMap.get(ownerByUnit.get(u.id) ?? ""));
      const tenant = profileFields(profileMap.get(tenantByUnit.get(u.id) ?? ""));
      return {
        building: buildingMap.get(u.building_id) ?? "",
        unit_name: u.unit_name,
        type: u.type,
        size_m2: u.size_m2 != null ? String(u.size_m2) : "",
        block: u.block ?? "",
        entrance: u.entrance ?? "",
        floor: u.floor ?? "",
        owner_email: owner.email,
        owner_name: owner.name,
        owner_surname: owner.surname,
        owner_phone: owner.phone,
        owner_contact_email: owner.contact_email,
        tenant_email: tenant.email,
        tenant_name: tenant.name,
        tenant_surname: tenant.surname,
        tenant_phone: tenant.phone,
        tenant_contact_email: tenant.contact_email,
      };
    });

    const date = new Date().toISOString().slice(0, 10);
    const csv = "\uFEFF" + unitsToCsv(rows);
    return new NextResponse(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="units-export-${date}.csv"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
