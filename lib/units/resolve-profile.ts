import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePhone, phonesMatch } from "@/lib/units/normalize-phone";

export type ProfileRow = {
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

function importEmail(phone: string, name: string, surname: string, suffix: string): string {
  if (phone) return `u${phone}@import.domio`;
  const base = `${normText(name).replace(/[^a-z0-9]/g, "")}.${normText(surname || "user").replace(/[^a-z0-9]/g, "")}`;
  return `${base || "owner"}.${suffix}@import.domio`;
}

export type ProfileImportContext = {
  byEmail: Map<string, ProfileRow>;
  byPhone: Map<string, ProfileRow>;
  byName: Map<string, ProfileRow>;
};

export async function loadProfileImportContext(
  admin: SupabaseClient,
  siteId: string
): Promise<ProfileImportContext> {
  const byEmail = new Map<string, ProfileRow>();
  const byPhone = new Map<string, ProfileRow>();
  const byName = new Map<string, ProfileRow>();

  const { data: allProfiles } = await admin.from("profiles").select("id,email,name,surname,phone,role");
  for (const raw of allProfiles ?? []) {
    const p = raw as ProfileRow;
    const email = p.email.trim().toLowerCase();
    if (email) byEmail.set(email, p);
    const phone = normalizePhone(p.phone);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, p);
    const nameKey = `${normText(p.name)}::${normText(p.surname)}`;
    if (!byName.has(nameKey)) byName.set(nameKey, p);
  }

  void siteId;
  return { byEmail, byPhone, byName };
}

export type ResolveProfileInput = {
  email?: string;
  name?: string;
  surname?: string;
  phone?: string;
};

export type ResolveProfileResult =
  | { ok: true; userId: string; created: boolean }
  | { ok: false; error: string };

async function linkUserToSite(admin: SupabaseClient, userId: string, siteId: string) {
  await admin.from("user_site_assignments").delete().eq("user_id", userId);
  await admin.from("user_site_assignments").insert({ user_id: userId, site_id: siteId });
}

async function findAuthUserIdByEmail(admin: SupabaseClient, email: string): Promise<string | null> {
  let page = 1;
  while (page <= 10) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error || !data.users.length) return null;
    const found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (found?.id) return found.id;
    if (data.users.length < 200) break;
    page++;
  }
  return null;
}

export async function findOrCreateSiteOwner(
  admin: SupabaseClient,
  siteId: string,
  input: ResolveProfileInput,
  cache: Map<string, string>,
  ctx: ProfileImportContext,
  rowSuffix: string
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

  if (email && ctx.byEmail.has(email)) {
    const p = ctx.byEmail.get(email)!;
    cache.set(cacheKey, p.id);
    await linkUserToSite(admin, p.id, siteId);
    return { ok: true, userId: p.id, created: false };
  }

  if (phone && ctx.byPhone.has(phone)) {
    const p = ctx.byPhone.get(phone)!;
    cache.set(cacheKey, p.id);
    await linkUserToSite(admin, p.id, siteId);
    return { ok: true, userId: p.id, created: false };
  }

  if (name) {
    const nameKey = `${normText(name)}::${normText(surname)}`;
    const p = ctx.byName.get(nameKey);
    if (p) {
      cache.set(cacheKey, p.id);
      await linkUserToSite(admin, p.id, siteId);
      return { ok: true, userId: p.id, created: false };
    }
  }

  if (!name) {
    return { ok: false, error: "owner name required to create account" };
  }

  const createEmail = email || importEmail(phone, name, surname, rowSuffix);
  const password = `Import${Math.random().toString(36).slice(2, 10)}!9`;

  let userId: string | null = null;
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email: createEmail,
    password,
    email_confirm: true,
  });

  if (authError || !authData.user) {
    const msg = authError?.message?.toLowerCase() ?? "";
    if (msg.includes("already") || msg.includes("registered") || msg.includes("exists")) {
      const existing = ctx.byEmail.get(createEmail);
      if (existing?.id) {
        userId = existing.id;
      } else {
        userId = await findAuthUserIdByEmail(admin, createEmail);
      }
    }
    if (!userId) {
      return { ok: false, error: authError?.message ?? "failed to create owner account" };
    }
  } else {
    userId = authData.user.id;
  }

  const { data: existingProfile } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!existingProfile?.id) {
    const { error: profileError } = await admin.from("profiles").insert({
      id: userId,
      email: createEmail,
      name,
      surname: surname || "",
      phone: input.phone?.trim() || phone || null,
      role: "resident",
    });
    if (profileError) {
      return { ok: false, error: profileError.message };
    }
  }

  const profileRow: ProfileRow = {
    id: userId,
    email: createEmail,
    name,
    surname: surname || "",
    phone: input.phone?.trim() || phone || null,
    role: "resident",
  };
  ctx.byEmail.set(createEmail, profileRow);
  if (phone) ctx.byPhone.set(phone, profileRow);
  ctx.byName.set(`${normText(name)}::${normText(surname)}`, profileRow);

  await linkUserToSite(admin, userId, siteId);
  cache.set(cacheKey, userId);
  return { ok: true, userId, created: !existingProfile?.id };
}
