import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone, phonesMatch } from "@/lib/units/normalize-phone";

type ProfileRow = {
  id: string;
  email: string;
  name: string;
  surname: string;
  phone: string | null;
  role: string;
};

function normText(s: string) {
  return s.trim().replace(/\s+/g, " ").toLowerCase();
}

function importEmail(phone: string, name: string, surname: string): string {
  if (phone) return `${phone}@residents.import`;
  const base = `${normText(name).replace(/[^a-z0-9]/g, "")}.${normText(surname || "user").replace(/[^a-z0-9]/g, "")}`;
  return `${base || "owner"}.${Date.now().toString(36)}@residents.import`;
}

export type ResolveProfileInput = {
  email?: string;
  name?: string;
  surname?: string;
  phone?: string;
};

async function linkUserToSite(admin: SupabaseClient, userId: string, siteId: string) {
  await admin.from("user_site_assignments").delete().eq("user_id", userId);
  await admin.from("user_site_assignments").insert({ user_id: userId, site_id: siteId });
}

export type ResolveProfileResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: string };

export async function findOrCreateSiteOwner(
  admin: SupabaseClient,
  siteId: string,
  input: ResolveProfileInput,
  cache: Map<string, string>
): Promise<ResolveProfileResult> {
  const email = (input.email ?? "").trim().toLowerCase();
  const name = (input.name ?? "").trim().replace(/\s+/g, " ");
  const surname = (input.surname ?? "").trim().replace(/\s+/g, " ");
  const phone = normalizePhone(input.phone);

  if (!email && !phone && !name) {
    return { ok: false, error: "no owner details" };
  }

  const cacheKey = email || (phone ? `p:${phone}` : `n:${normText(name)}::${normText(surname)}`);
  const cached = cache.get(cacheKey);
  if (cached) return { ok: true, userId: cached, created: false };

  const { data: siteUsers } = await admin.from("user_site_assignments").select("user_id").eq("site_id", siteId);
  const siteUserIds = new Set((siteUsers ?? []).map((r: { user_id: string }) => r.user_id));

  const { data: buildingRows } = await admin.from("buildings").select("id").eq("site_id", siteId);
  const buildingIds = (buildingRows ?? []).map((b: { id: string }) => b.id);
  let unitLinkedIds = new Set<string>();
  if (buildingIds.length) {
    const { data: units } = await admin.from("units").select("id").in("building_id", buildingIds);
    const unitIds = (units ?? []).map((u: { id: string }) => u.id);
    if (unitIds.length) {
      const [{ data: owners }, { data: tenants }] = await Promise.all([
        admin.from("unit_owners").select("owner_id").in("unit_id", unitIds),
        admin.from("unit_tenant_assignments").select("tenant_id").in("unit_id", unitIds),
      ]);
      (owners ?? []).forEach((r: { owner_id: string }) => unitLinkedIds.add(r.owner_id));
      (tenants ?? []).forEach((r: { tenant_id: string }) => unitLinkedIds.add(r.tenant_id));
    }
  }

  const candidateIds = [...new Set([...siteUserIds, ...unitLinkedIds])];
  let profiles: ProfileRow[] = [];
  if (candidateIds.length) {
    const { data } = await admin
      .from("profiles")
      .select("id,email,name,surname,phone,role")
      .in("id", candidateIds);
    profiles = (data ?? []) as ProfileRow[];
  }

  if (email) {
    const byEmail = profiles.find((p) => p.email.trim().toLowerCase() === email);
    if (byEmail) {
      cache.set(cacheKey, byEmail.id);
      return { ok: true, userId: byEmail.id, created: false };
    }
    const { data: global } = await admin.from("profiles").select("id,email,name,surname,phone,role").eq("email", email).maybeSingle();
    if (global?.id) {
      cache.set(cacheKey, global.id);
      await linkUserToSite(admin, global.id, siteId);
      return { ok: true, userId: global.id, created: false };
    }
  }

  if (phone) {
    const byPhone = profiles.find((p) => phonesMatch(p.phone, phone));
    if (byPhone) {
      cache.set(cacheKey, byPhone.id);
      return { ok: true, userId: byPhone.id, created: false };
    }
    const { data: globalPhoneProfiles } = await admin
      .from("profiles")
      .select("id,email,name,surname,phone,role")
      .not("phone", "is", null);
    const globalByPhone = (globalPhoneProfiles ?? []).find((p) =>
      phonesMatch((p as ProfileRow).phone, phone)
    ) as ProfileRow | undefined;
    if (globalByPhone?.id) {
      cache.set(cacheKey, globalByPhone.id);
      await linkUserToSite(admin, globalByPhone.id, siteId);
      return { ok: true, userId: globalByPhone.id, created: false };
    }
  }

  if (name) {
    const byName = profiles.find(
      (p) => normText(p.name) === normText(name) && (!surname || normText(p.surname) === normText(surname))
    );
    if (byName) {
      cache.set(cacheKey, byName.id);
      return { ok: true, userId: byName.id, created: false };
    }
  }

  if (!name) {
    return { ok: false, error: "owner name required to create account" };
  }

  const createEmail = email || importEmail(phone, name, surname);
  const password = `Import${Math.random().toString(36).slice(2, 10)}!9`;

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: createEmail,
    password,
    email_confirm: true,
  });

  if (authError?.message?.toLowerCase().includes("already") && createEmail) {
    const { data: existing } = await admin.from("profiles").select("id").eq("email", createEmail).maybeSingle();
    if (existing?.id) {
      cache.set(cacheKey, existing.id);
      await linkUserToSite(admin, existing.id, siteId);
      return { ok: true, userId: existing.id, created: false };
    }
  }

  if (authError || !authData.user) {
    return { ok: false, error: authError?.message ?? "failed to create owner account" };
  }

  const userId = authData.user.id;
  const { error: profileError } = await admin.from("profiles").insert({
    id: userId,
    email: createEmail,
    name,
    surname: surname || "",
    phone: input.phone?.trim() || phone || null,
    role: "resident",
  });
  if (profileError) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    return { ok: false, error: profileError.message };
  }

  await linkUserToSite(admin, userId, siteId);
  cache.set(cacheKey, userId);
  return { ok: true, userId, created: true };
}
