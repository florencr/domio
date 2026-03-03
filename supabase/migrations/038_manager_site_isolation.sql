-- Manager site isolation: managers see only their site's data
-- Fixes new managers seeing other managers' data (services, unit_types, etc. were not site-scoped)

-- 1) Buildings: remove the (site_id IS NULL AND is_manager()) loophole so managers with no site see nothing
DROP POLICY IF EXISTS "buildings_select" ON buildings;
CREATE POLICY "buildings_select" ON buildings FOR SELECT
  USING (
    public.is_admin()
    OR (site_id IS NOT NULL AND site_id = public.my_site_id())
  );

-- 2) Unit types: site-scoped for managers
DROP POLICY IF EXISTS "unit_types_select" ON unit_types;
DROP POLICY IF EXISTS "unit_types_select_authenticated" ON unit_types;
DROP POLICY IF EXISTS "unit_types_insert_manager" ON unit_types;
DROP POLICY IF EXISTS "unit_types_update_manager" ON unit_types;
DROP POLICY IF EXISTS "unit_types_delete_manager" ON unit_types;

CREATE POLICY "unit_types_select" ON unit_types FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
CREATE POLICY "unit_types_insert_manager" ON unit_types FOR INSERT
  WITH CHECK (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL));
CREATE POLICY "unit_types_update_manager" ON unit_types FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));
CREATE POLICY "unit_types_delete_manager" ON unit_types FOR DELETE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));

-- 3) Vendors: site-scoped
DROP POLICY IF EXISTS "vendors_select" ON vendors;
DROP POLICY IF EXISTS "vendors_select_authenticated" ON vendors;
DROP POLICY IF EXISTS "vendors_insert_manager" ON vendors;
DROP POLICY IF EXISTS "vendors_update_manager" ON vendors;
DROP POLICY IF EXISTS "vendors_delete_manager" ON vendors;

CREATE POLICY "vendors_select" ON vendors FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
CREATE POLICY "vendors_insert_manager" ON vendors FOR INSERT
  WITH CHECK (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL));
CREATE POLICY "vendors_update_manager" ON vendors FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));
CREATE POLICY "vendors_delete_manager" ON vendors FOR DELETE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));

-- 4) Service categories: site-scoped
DROP POLICY IF EXISTS "service_categories_select" ON service_categories;
DROP POLICY IF EXISTS "service_categories_select_authenticated" ON service_categories;
DROP POLICY IF EXISTS "service_categories_insert_manager" ON service_categories;
DROP POLICY IF EXISTS "service_categories_update_manager" ON service_categories;
DROP POLICY IF EXISTS "service_categories_delete_manager" ON service_categories;

CREATE POLICY "service_categories_select" ON service_categories FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
CREATE POLICY "service_categories_insert_manager" ON service_categories FOR INSERT
  WITH CHECK (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL));
CREATE POLICY "service_categories_update_manager" ON service_categories FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));
CREATE POLICY "service_categories_delete_manager" ON service_categories FOR DELETE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));

-- 5) Services: site-scoped
DROP POLICY IF EXISTS "services_select" ON services;
DROP POLICY IF EXISTS "services_select_authenticated" ON services;
DROP POLICY IF EXISTS "services_insert_manager" ON services;
DROP POLICY IF EXISTS "services_update_manager" ON services;
DROP POLICY IF EXISTS "services_delete_manager" ON services;

CREATE POLICY "services_select" ON services FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
CREATE POLICY "services_insert_manager" ON services FOR INSERT
  WITH CHECK (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL));
CREATE POLICY "services_update_manager" ON services FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));
CREATE POLICY "services_delete_manager" ON services FOR DELETE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));

-- 6) Expenses: site-scoped
DROP POLICY IF EXISTS "expenses_select" ON expenses;
DROP POLICY IF EXISTS "expenses_select_authenticated" ON expenses;
DROP POLICY IF EXISTS "expenses_insert_manager" ON expenses;
DROP POLICY IF EXISTS "expenses_update_manager" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_manager" ON expenses;

CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
CREATE POLICY "expenses_insert_manager" ON expenses FOR INSERT
  WITH CHECK (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL));
CREATE POLICY "expenses_update_manager" ON expenses FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));
CREATE POLICY "expenses_delete_manager" ON expenses FOR DELETE
  USING (public.is_admin() OR (public.is_manager() AND site_id = public.my_site_id()));
