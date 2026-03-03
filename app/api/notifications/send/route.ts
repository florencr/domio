import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getFcmMessaging } from "@/lib/firebase-admin";

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

    // Get manager's site and units in that site
    const { data: site } = await admin.from("sites").select("id").eq("manager_id", user.id).maybeSingle();
    const siteId = site?.id ?? null;
    let siteUnitIds = new Set<string>();
    if (siteId) {
      const { data: siteBuildings } = await admin.from("buildings").select("id").eq("site_id", siteId);
      const buildingIds = new Set((siteBuildings ?? []).map((b: { id: string }) => b.id));
      const { data: siteUnits } = await admin.from("units").select("id").in("building_id", [...buildingIds]);
      (siteUnits ?? []).forEach((u: { id: string }) => siteUnitIds.add(u.id));
    }

    // Compute recipient user IDs - only from this manager's site
    let userIds = new Set<string>();

    if (audience === "owners" || audience === "both") {
      if (siteUnitIds.size > 0) {
        const { data: owners } = await admin.from("unit_owners").select("owner_id, unit_id").in("unit_id", [...siteUnitIds]);
        (owners ?? []).forEach((r: { owner_id: string }) => userIds.add(r.owner_id));
      }
    }
    if (audience === "tenants" || audience === "both") {
      if (siteUnitIds.size > 0) {
        const { data: tenants } = await admin.from("unit_tenant_assignments").select("tenant_id, unit_id").in("unit_id", [...siteUnitIds]);
        (tenants ?? []).forEach((r: { tenant_id: string }) => userIds.add(r.tenant_id));
      }
    }

    if (unitTypes && unitTypes.length > 0 && siteUnitIds.size > 0) {
      const { data: unitsByType } = await admin.from("units").select("id").in("id", [...siteUnitIds]).in("type", unitTypes);
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

    if (unpaid && siteUnitIds.size > 0) {
      const { data: bills } = await admin.from("bills").select("unit_id").in("unit_id", [...siteUnitIds]).is("paid_at", null);
      const unpaidUnitIds = new Set((bills ?? []).map((b: { unit_id: string }) => b.unit_id));
      const unpaidUserIds = new Set<string>();
      for (const uid of userIds) {
        const { data: ownerUnits } = await admin.from("unit_owners").select("unit_id").eq("owner_id", uid).in("unit_id", [...siteUnitIds]);
        const { data: tenantUnits } = await admin.from("unit_tenant_assignments").select("unit_id").eq("tenant_id", uid).in("unit_id", [...siteUnitIds]);
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

    // Send push notifications to registered devices (requires FIREBASE_SERVICE_ACCOUNT_JSON)
    const fcm = getFcmMessaging();
    if (fcm && userIds.size > 0) {
      const { data: tokens } = await admin.from("device_tokens").select("token").in("user_id", [...userIds]);
      if (tokens && tokens.length > 0) {
        const sendPromises = (tokens as { token: string }[]).map(({ token }) =>
          fcm.send({
            token,
            notification: { title, body: msgBody ?? undefined },
            data: { notificationId: notif.id },
          }).catch(() => null)
        );
        await Promise.allSettled(sendPromises);
      }
    }

    return NextResponse.json({ success: true, recipients: recipientRows.length });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Unknown error" }, { status: 500 });
  }
}
