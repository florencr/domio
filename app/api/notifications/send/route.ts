import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// POST /api/notifications/send - manager sends notification to targeted users
export async function POST(request: Request) {
  try {
    const sb = await createServerClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const admin = adminClient();
    const { data: profile } = await admin.from("profiles").select("role").eq("id", user.id).single();
    if (profile?.role !== "manager") return NextResponse.json({ error: "Managers only" }, { status: 403 });

    const body = await request.json();
    const { title, body: msgBody, targetAudience, targetUnitTypes, unpaidOnly } = body;
    if (!title || !targetAudience) return NextResponse.json({ error: "Missing title or targetAudience" }, { status: 400 });

    const audience = targetAudience as "owners" | "tenants" | "both";
    const unitTypes = Array.isArray(targetUnitTypes) ? targetUnitTypes as string[] : null;
    const unpaid = !!unpaidOnly;

    // Compute recipient user IDs
    let userIds = new Set<string>();

    if (audience === "owners" || audience === "both") {
      const { data: owners } = await admin.from("unit_owners").select("owner_id");
      (owners ?? []).forEach((r: { owner_id: string }) => userIds.add(r.owner_id));
      if (userIds.size === 0) {
        const { data: ownerProfiles } = await admin.from("profiles").select("id").eq("role", "owner");
        (ownerProfiles ?? []).forEach((p: { id: string }) => userIds.add(p.id));
      }
    }
    if (audience === "tenants" || audience === "both") {
      const { data: tenants } = await admin.from("unit_tenant_assignments").select("tenant_id");
      (tenants ?? []).forEach((r: { tenant_id: string }) => userIds.add(r.tenant_id));
      const hadTenantsFromAssignments = tenants && tenants.length > 0;
      if (!hadTenantsFromAssignments) {
        const { data: tenantProfiles } = await admin.from("profiles").select("id").eq("role", "tenant");
        (tenantProfiles ?? []).forEach((p: { id: string }) => userIds.add(p.id));
      }
    }

    if (unitTypes && unitTypes.length > 0) {
      const { data: unitsByType } = await admin.from("units").select("id").in("type", unitTypes);
      const unitIdSet = new Set((unitsByType ?? []).map((u: { id: string }) => u.id));
      const filtered = new Set<string>();
      for (const uid of userIds) {
        const { data: ownerRows } = await admin.from("unit_owners").select("unit_id").eq("owner_id", uid);
        const { data: tenantRows } = await admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", uid);
        const userUnitIds = [...(ownerRows ?? []).map((r: { unit_id: string }) => r.unit_id), ...(tenantRows ?? []).map((r: { unit_id: string }) => r.unit_id)];
        if (userUnitIds.some(uId => unitIdSet.has(uId))) filtered.add(uid);
      }
      userIds = filtered;
    }

    if (unpaid) {
      const { data: bills } = await admin.from("bills").select("unit_id").is("paid_at", null);
      const unpaidUnitIds = new Set((bills ?? []).map((b: { unit_id: string }) => b.unit_id));
      const unpaidUserIds = new Set<string>();
      for (const uid of userIds) {
        const { data: ownerUnits } = await admin.from("unit_owners").select("unit_id").eq("owner_id", uid);
        const { data: tenantUnits } = await admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", uid);
        const units = new Set([...(ownerUnits ?? []).map((r: { unit_id: string }) => r.unit_id), ...(tenantUnits ?? []).map((r: { unit_id: string }) => r.unit_id)]);
        if ([...units].some(u => unpaidUnitIds.has(u))) unpaidUserIds.add(uid);
      }
      userIds = unpaidUserIds;
    }

    const { data: notif, error: insErr } = await admin.from("notifications").insert({
      title,
      body: msgBody ?? null,
      created_by: user.id,
      target_audience: audience,
      target_unit_types: unitTypes,
      unpaid_only: unpaid,
    }).select("id").single();

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    if (!notif?.id) return NextResponse.json({ error: "Failed to create notification" }, { status: 500 });

    const recipientRows = [...userIds].map(uid => ({ notification_id: notif.id, user_id: uid }));
    if (recipientRows.length > 0) {
      const { error: recErr } = await admin.from("notification_recipients").insert(recipientRows);
      if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, recipients: recipientRows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
