-- Allow admin to insert/update/delete unit_types (was manager-only)
DROP POLICY IF EXISTS "unit_types_insert_manager" ON unit_types;
CREATE POLICY "unit_types_insert_manager" ON unit_types FOR INSERT
  WITH CHECK (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
