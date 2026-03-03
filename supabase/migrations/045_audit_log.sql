-- Audit log: who did what and when
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  entity_label TEXT,
  site_id UUID REFERENCES sites(id) ON DELETE SET NULL,
  old_values JSONB,
  new_values JSONB,
  meta JSONB
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_site ON audit_log(site_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_log_select_admin" ON audit_log;
CREATE POLICY "audit_log_select_admin" ON audit_log FOR SELECT
  USING (public.is_admin());

DROP POLICY IF EXISTS "audit_log_select_manager_own_site" ON audit_log;
CREATE POLICY "audit_log_select_manager_own_site" ON audit_log FOR SELECT
  USING (public.is_manager() AND site_id = public.my_site_id());

-- Insert only via service role (APIs); clients cannot insert
DROP POLICY IF EXISTS "audit_log_insert_service" ON audit_log;
CREATE POLICY "audit_log_insert_service" ON audit_log FOR INSERT
  WITH CHECK (false);
