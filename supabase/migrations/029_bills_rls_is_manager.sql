-- Fix bills RLS: use is_manager() instead of direct profiles subquery
-- Fixes manager not seeing bills after generation (INSERT works, SELECT returned empty)

DROP POLICY IF EXISTS "bills_select_manager" ON bills;
DROP POLICY IF EXISTS "bills_insert_manager" ON bills;
DROP POLICY IF EXISTS "bills_update_manager" ON bills;
DROP POLICY IF EXISTS "bills_delete_manager" ON bills;

CREATE POLICY "bills_select_manager"
  ON bills FOR SELECT
  USING (public.is_manager());

CREATE POLICY "bills_insert_manager"
  ON bills FOR INSERT
  WITH CHECK (public.is_manager());

CREATE POLICY "bills_update_manager"
  ON bills FOR UPDATE
  USING (public.is_manager());

CREATE POLICY "bills_delete_manager"
  ON bills FOR DELETE
  USING (public.is_manager());
