-- Sites DB: complete RLS and site-scoping
-- Run AFTER 032, 033, 034. Ensures full sites support.

-- 1) Sites: admin can UPDATE (edit site name)
DROP POLICY IF EXISTS "sites_update_admin" ON sites;
CREATE POLICY "sites_update_admin" ON sites FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 2) Bills: manager sees only bills for units in their site's buildings
DROP POLICY IF EXISTS "bills_select_manager" ON bills;
DROP POLICY IF EXISTS "bills_insert_manager" ON bills;
DROP POLICY IF EXISTS "bills_update_manager" ON bills;
DROP POLICY IF EXISTS "bills_delete_manager" ON bills;

CREATE POLICY "bills_select_manager" ON bills FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM units u
      JOIN buildings b ON b.id = u.building_id
      WHERE u.id = bills.unit_id
        AND (b.site_id = public.my_site_id() OR (b.site_id IS NULL AND public.my_site_id() IS NOT NULL))
    ))
  );

CREATE POLICY "bills_insert_manager" ON bills FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM units u
      JOIN buildings b ON b.id = u.building_id
      WHERE u.id = bills.unit_id
        AND (b.site_id = public.my_site_id() OR b.site_id IS NULL)
    ))
  );

CREATE POLICY "bills_update_manager" ON bills FOR UPDATE
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM units u
      JOIN buildings b ON b.id = u.building_id
      WHERE u.id = bills.unit_id AND b.site_id = public.my_site_id()
    ))
  );

CREATE POLICY "bills_delete_manager" ON bills FOR DELETE
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM units u
      JOIN buildings b ON b.id = u.building_id
      WHERE u.id = bills.unit_id AND b.site_id = public.my_site_id()
    ))
  );

-- 3) Bill lines: scoped via parent bill
DROP POLICY IF EXISTS "bill_lines_select_manager" ON bill_lines;
DROP POLICY IF EXISTS "bill_lines_insert_manager" ON bill_lines;
DROP POLICY IF EXISTS "bill_lines_update_manager" ON bill_lines;
DROP POLICY IF EXISTS "bill_lines_delete_manager" ON bill_lines;

CREATE POLICY "bill_lines_select_manager" ON bill_lines FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM bills bl
      JOIN units u ON u.id = bl.unit_id
      JOIN buildings b ON b.id = u.building_id
      WHERE bl.id = bill_lines.bill_id
        AND (b.site_id = public.my_site_id() OR (b.site_id IS NULL AND public.my_site_id() IS NOT NULL))
    ))
  );

CREATE POLICY "bill_lines_insert_manager" ON bill_lines FOR INSERT
  WITH CHECK (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM bills bl
      JOIN units u ON u.id = bl.unit_id
      JOIN buildings b ON b.id = u.building_id
      WHERE bl.id = bill_lines.bill_id
        AND (b.site_id = public.my_site_id() OR b.site_id IS NULL)
    ))
  );

CREATE POLICY "bill_lines_update_manager" ON bill_lines FOR UPDATE
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM bills bl
      JOIN units u ON u.id = bl.unit_id
      JOIN buildings b ON b.id = u.building_id
      WHERE bl.id = bill_lines.bill_id AND b.site_id = public.my_site_id()
    ))
  );

CREATE POLICY "bill_lines_delete_manager" ON bill_lines FOR DELETE
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM bills bl
      JOIN units u ON u.id = bl.unit_id
      JOIN buildings b ON b.id = u.building_id
      WHERE bl.id = bill_lines.bill_id AND b.site_id = public.my_site_id()
    ))
  );

-- 4) Buildings: admin can INSERT (create buildings for any site)
DROP POLICY IF EXISTS "buildings_insert_admin" ON buildings;
CREATE POLICY "buildings_insert_admin" ON buildings FOR INSERT
  WITH CHECK (public.is_admin());
