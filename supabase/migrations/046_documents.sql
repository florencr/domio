-- Documents: contracts, maintenance docs per building or unit
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

-- Admin sees all
DROP POLICY IF EXISTS "documents_select_admin" ON documents;
CREATE POLICY "documents_select_admin" ON documents FOR SELECT USING (public.is_admin());

-- Manager sees docs for their site's buildings/units
DROP POLICY IF EXISTS "documents_select_manager" ON documents;
CREATE POLICY "documents_select_manager" ON documents FOR SELECT
  USING (public.is_manager() AND (
    building_id IN (SELECT b.id FROM buildings b WHERE b.site_id = public.my_site_id())
  ));

-- Manager can insert for their site's buildings
DROP POLICY IF EXISTS "documents_insert_manager" ON documents;
CREATE POLICY "documents_insert_manager" ON documents FOR INSERT
  WITH CHECK (public.is_manager() AND (
    building_id IN (SELECT b.id FROM buildings b WHERE b.site_id = public.my_site_id())
  ));

-- Manager can delete their site's docs
DROP POLICY IF EXISTS "documents_delete_manager" ON documents;
CREATE POLICY "documents_delete_manager" ON documents FOR DELETE
  USING (public.is_manager() AND (
    building_id IN (SELECT b.id FROM buildings b WHERE b.site_id = public.my_site_id())
  ));

-- Storage bucket for documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('documents', 'documents', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: authenticated can upload/read documents (path checked by app)
DROP POLICY IF EXISTS "documents_upload_authenticated" ON storage.objects;
CREATE POLICY "documents_upload_authenticated" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_select_authenticated" ON storage.objects;
CREATE POLICY "documents_select_authenticated" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'documents');

DROP POLICY IF EXISTS "documents_delete_authenticated" ON storage.objects;
CREATE POLICY "documents_delete_authenticated" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'documents');
