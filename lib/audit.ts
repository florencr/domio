import { createClient } from "@supabase/supabase-js";

let _admin: ReturnType<typeof createClient> | null = null;

function admin() {
  if (!_admin) {
    _admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
  }
  return _admin;
}

export type AuditEntry = {
  user_id?: string;
  user_email?: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  entity_label?: string;
  site_id?: string;
  old_values?: Record<string, unknown>;
  new_values?: Record<string, unknown>;
  meta?: Record<string, unknown>;
};

export async function logAudit(entry: AuditEntry): Promise<void> {
  try {
    await admin().from("audit_log").insert({
      user_id: entry.user_id ?? null,
      user_email: entry.user_email ?? null,
      action: entry.action,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id ?? null,
      entity_label: entry.entity_label ?? null,
      site_id: entry.site_id ?? null,
      old_values: entry.old_values ?? null,
      new_values: entry.new_values ?? null,
      meta: entry.meta ?? null,
    } as never);
  } catch (e) {
    console.error("Audit log failed:", e);
  }
}
