-- Add expense_id to documents: link contracts/invoices to expenses
ALTER TABLE documents ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_documents_expense ON documents(expense_id);

-- Add "invoice" category
ALTER TABLE documents DROP CONSTRAINT IF EXISTS documents_category_check;
ALTER TABLE documents ADD CONSTRAINT documents_category_check
  CHECK (category IN ('contract', 'maintenance', 'invoice', 'other'));

-- Update RLS: manager can access documents by building OR by expense (expense must belong to their site)
DROP POLICY IF EXISTS "documents_select_manager" ON documents;
CREATE POLICY "documents_select_manager" ON documents FOR SELECT
  USING (public.is_manager() AND (
    (building_id IS NOT NULL AND building_id IN (SELECT b.id FROM buildings b WHERE b.site_id = public.my_site_id()))
    OR (expense_id IS NOT NULL AND expense_id IN (SELECT e.id FROM expenses e WHERE e.site_id = public.my_site_id()))
  ));

DROP POLICY IF EXISTS "documents_insert_manager" ON documents;
CREATE POLICY "documents_insert_manager" ON documents FOR INSERT
  WITH CHECK (public.is_manager() AND (
    (building_id IS NOT NULL AND building_id IN (SELECT b.id FROM buildings b WHERE b.site_id = public.my_site_id()))
    OR (expense_id IS NOT NULL AND expense_id IN (SELECT e.id FROM expenses e WHERE e.site_id = public.my_site_id()))
  ));

DROP POLICY IF EXISTS "documents_delete_manager" ON documents;
CREATE POLICY "documents_delete_manager" ON documents FOR DELETE
  USING (public.is_manager() AND (
    (building_id IS NOT NULL AND building_id IN (SELECT b.id FROM buildings b WHERE b.site_id = public.my_site_id()))
    OR (expense_id IS NOT NULL AND expense_id IN (SELECT e.id FROM expenses e WHERE e.site_id = public.my_site_id()))
  ));
