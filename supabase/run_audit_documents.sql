-- Run this in Supabase SQL Editor to add Audit Log and Documents
-- ========== 045: Audit log ==========
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
CREATE POLICY "audit_log_select_admin" ON audit_log FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "audit_log_select_manager_own_site" ON audit_log;
CREATE POLICY "audit_log_select_manager_own_site" ON audit_log FOR SELECT
  USING (public.is_manager() AND site_id = public.my_site_id());
DROP POLICY IF EXISTS "audit_log_insert_service" ON audit_log;
CREATE POLICY "audit_log_insert_service" ON audit_log FOR INSERT WITH CHECK (false);

-- ========== 046: Documents ==========
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  category TEXT DEFAULT 'other' CHECK (category IN ('contract', 'maintenance', 'other')),
  uploaded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_documents_building ON documents(building_id);
CREATE INDEX IF NOT EXISTS idx_documents_unit ON documents(unit_id);
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "documents_select_admin" ON documents;
CREATE POLICY "documents_select_admin" ON documents FOR SELECT USING (public.is_admin());
DROP POLICY IF EXISTS "documents_select_manager" ON documents;
CREATE POLICY "documents_select_manager" ON documents FOR SELECT
  USING (public.is_manager() AND (building_id IN (SELECT b.id FROM buildings b WHERE b.site_id = public.my_site_id())));
DROP POLICY IF EXISTS "documents_insert_manager" ON documents;
CREATE POLICY "documents_insert_manager" ON documents FOR INSERT
  WITH CHECK (public.is_manager() AND (building_id IN (SELECT b.id FROM buildings b WHERE b.site_id = public.my_site_id())));
DROP POLICY IF EXISTS "documents_delete_manager" ON documents;
CREATE POLICY "documents_delete_manager" ON documents FOR DELETE
  USING (public.is_manager() AND (building_id IN (SELECT b.id FROM buildings b WHERE b.site_id = public.my_site_id())));
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "documents_upload_authenticated" ON storage.objects;
CREATE POLICY "documents_upload_authenticated" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'documents');
DROP POLICY IF EXISTS "documents_select_authenticated" ON storage.objects;
CREATE POLICY "documents_select_authenticated" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'documents');
DROP POLICY IF EXISTS "documents_delete_authenticated" ON storage.objects;
CREATE POLICY "documents_delete_authenticated" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'documents');
