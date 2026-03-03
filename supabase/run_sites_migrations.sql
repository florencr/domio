-- Run this entire file in Supabase SQL Editor (one click)
-- Creates sites for all managers and sets up site-scoped access

-- ========== 032: Sites table + backfill ==========
DO $$ BEGIN
  ALTER TYPE app_role ADD VALUE 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(manager_id)
);
CREATE INDEX IF NOT EXISTS idx_sites_manager ON sites(manager_id);

ALTER TABLE buildings ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE unit_types ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;

DO $$
DECLARE v_site_id UUID; v_manager_id UUID;
BEGIN
  SELECT id INTO v_manager_id FROM profiles WHERE role = 'manager' LIMIT 1;
  IF v_manager_id IS NULL THEN RETURN; END IF;
  INSERT INTO sites (name, manager_id) VALUES ('Default Site', v_manager_id)
  ON CONFLICT (manager_id) DO NOTHING;
  SELECT id INTO v_site_id FROM sites WHERE manager_id = v_manager_id LIMIT 1;
  IF v_site_id IS NULL THEN RETURN; END IF;
  UPDATE buildings SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE unit_types SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE vendors SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE service_categories SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE services SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE expenses e SET site_id = COALESCE((SELECT b.site_id FROM buildings b WHERE b.id = e.building_id LIMIT 1), v_site_id) WHERE e.site_id IS NULL;
  UPDATE expenses SET site_id = v_site_id WHERE site_id IS NULL;
END $$;

INSERT INTO sites (name, manager_id)
SELECT 'Site: ' || p.name || ' ' || p.surname, p.id
FROM profiles p
WHERE p.role = 'manager'
  AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.manager_id = p.id);

-- ========== 033: RLS for sites ==========
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public STABLE AS $$
DECLARE result boolean;
BEGIN SET LOCAL row_security = off;
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.my_site_id()
RETURNS UUID LANGUAGE sql SECURITY DEFINER SET search_path = public STABLE AS $$
  SELECT id FROM sites WHERE manager_id = auth.uid() LIMIT 1;
$$;

ALTER TABLE sites ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sites_select_manager_own" ON sites;
DROP POLICY IF EXISTS "sites_update_admin" ON sites;
CREATE POLICY "sites_select_manager_own" ON sites FOR SELECT USING (manager_id = auth.uid() OR public.is_admin());
DROP POLICY IF EXISTS "sites_insert_admin" ON sites;
CREATE POLICY "sites_insert_admin" ON sites FOR INSERT WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "buildings_select_authenticated" ON buildings;
DROP POLICY IF EXISTS "buildings_select" ON buildings;
DROP POLICY IF EXISTS "buildings_insert_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_update_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_delete_manager" ON buildings;
CREATE POLICY "buildings_select" ON buildings FOR SELECT USING (
  public.is_admin()
  OR (site_id IS NOT NULL AND site_id = public.my_site_id())
  OR (site_id IS NULL AND public.is_manager())
);
CREATE POLICY "buildings_insert_manager" ON buildings FOR INSERT
  WITH CHECK (public.is_manager() AND (site_id = public.my_site_id() OR (site_id IS NULL AND public.my_site_id() IS NOT NULL)));
CREATE POLICY "buildings_update_manager" ON buildings FOR UPDATE USING (public.is_admin() OR (site_id = public.my_site_id()));
CREATE POLICY "buildings_delete_manager" ON buildings FOR DELETE USING (public.is_admin() OR (site_id = public.my_site_id()));

CREATE OR REPLACE FUNCTION set_building_site_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.site_id IS NULL AND public.is_manager() THEN NEW.site_id := public.my_site_id(); END IF;
  RETURN NEW;
END $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP TRIGGER IF EXISTS trg_building_site ON buildings;
CREATE TRIGGER trg_building_site BEFORE INSERT ON buildings FOR EACH ROW EXECUTE FUNCTION set_building_site_id();

DROP POLICY IF EXISTS "units_select_manager" ON units;
DROP POLICY IF EXISTS "units_insert_manager" ON units;
DROP POLICY IF EXISTS "units_update_manager" ON units;
DROP POLICY IF EXISTS "units_delete_manager" ON units;
CREATE POLICY "units_select_manager" ON units FOR SELECT
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM buildings b WHERE b.id = units.building_id AND (b.site_id = public.my_site_id() OR (b.site_id IS NULL AND public.is_manager()))));
CREATE POLICY "units_insert_manager" ON units FOR INSERT
  WITH CHECK (public.is_manager() AND EXISTS (SELECT 1 FROM buildings b WHERE b.id = units.building_id AND (b.site_id = public.my_site_id() OR b.site_id IS NULL)));
CREATE POLICY "units_update_manager" ON units FOR UPDATE
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM buildings b WHERE b.id = units.building_id AND b.site_id = public.my_site_id()));
CREATE POLICY "units_delete_manager" ON units FOR DELETE
  USING (public.is_admin() OR EXISTS (SELECT 1 FROM buildings b WHERE b.id = units.building_id AND b.site_id = public.my_site_id()));

-- ========== 034: Admin profiles ==========
DROP POLICY IF EXISTS "profiles_select_manager" ON profiles;
CREATE POLICY "profiles_select_manager" ON profiles FOR SELECT USING (public.is_manager() OR public.is_admin());

-- ========== 036: Sites complete ==========
DROP POLICY IF EXISTS "sites_update_admin" ON sites;
CREATE POLICY "sites_update_admin" ON sites FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "buildings_insert_admin" ON buildings;
CREATE POLICY "buildings_insert_admin" ON buildings FOR INSERT WITH CHECK (public.is_admin());

-- Bills: site-scoped for managers
DROP POLICY IF EXISTS "bills_select_manager" ON bills;
DROP POLICY IF EXISTS "bills_insert_manager" ON bills;
DROP POLICY IF EXISTS "bills_update_manager" ON bills;
DROP POLICY IF EXISTS "bills_delete_manager" ON bills;
CREATE POLICY "bills_select_manager" ON bills FOR SELECT USING (
  public.is_admin() OR (public.is_manager() AND EXISTS (
    SELECT 1 FROM units u JOIN buildings b ON b.id = u.building_id
    WHERE u.id = bills.unit_id AND (b.site_id = public.my_site_id() OR (b.site_id IS NULL AND public.my_site_id() IS NOT NULL))
  ))
);
CREATE POLICY "bills_insert_manager" ON bills FOR INSERT WITH CHECK (
  public.is_admin() OR (public.is_manager() AND EXISTS (
    SELECT 1 FROM units u JOIN buildings b ON b.id = u.building_id
    WHERE u.id = bills.unit_id AND (b.site_id = public.my_site_id() OR b.site_id IS NULL)
  ))
);
CREATE POLICY "bills_update_manager" ON bills FOR UPDATE USING (
  public.is_admin() OR (public.is_manager() AND EXISTS (
    SELECT 1 FROM units u JOIN buildings b ON b.id = u.building_id
    WHERE u.id = bills.unit_id AND b.site_id = public.my_site_id()
  ))
);
CREATE POLICY "bills_delete_manager" ON bills FOR DELETE USING (
  public.is_admin() OR (public.is_manager() AND EXISTS (
    SELECT 1 FROM units u JOIN buildings b ON b.id = u.building_id
    WHERE u.id = bills.unit_id AND b.site_id = public.my_site_id()
  ))
);

-- Bill lines: site-scoped via bill
DROP POLICY IF EXISTS "bill_lines_select_manager" ON bill_lines;
DROP POLICY IF EXISTS "bill_lines_insert_manager" ON bill_lines;
DROP POLICY IF EXISTS "bill_lines_update_manager" ON bill_lines;
DROP POLICY IF EXISTS "bill_lines_delete_manager" ON bill_lines;
CREATE POLICY "bill_lines_select_manager" ON bill_lines FOR SELECT USING (
  public.is_admin() OR (public.is_manager() AND EXISTS (
    SELECT 1 FROM bills bl JOIN units u ON u.id = bl.unit_id JOIN buildings b ON b.id = u.building_id
    WHERE bl.id = bill_lines.bill_id AND (b.site_id = public.my_site_id() OR (b.site_id IS NULL AND public.my_site_id() IS NOT NULL))
  ))
);
CREATE POLICY "bill_lines_insert_manager" ON bill_lines FOR INSERT WITH CHECK (
  public.is_admin() OR (public.is_manager() AND EXISTS (
    SELECT 1 FROM bills bl JOIN units u ON u.id = bl.unit_id JOIN buildings b ON b.id = u.building_id
    WHERE bl.id = bill_lines.bill_id AND (b.site_id = public.my_site_id() OR b.site_id IS NULL)
  ))
);
CREATE POLICY "bill_lines_update_manager" ON bill_lines FOR UPDATE USING (
  public.is_admin() OR (public.is_manager() AND EXISTS (
    SELECT 1 FROM bills bl JOIN units u ON u.id = bl.unit_id JOIN buildings b ON b.id = u.building_id
    WHERE bl.id = bill_lines.bill_id AND b.site_id = public.my_site_id()
  ))
);
CREATE POLICY "bill_lines_delete_manager" ON bill_lines FOR DELETE USING (
  public.is_admin() OR (public.is_manager() AND EXISTS (
    SELECT 1 FROM bills bl JOIN units u ON u.id = bl.unit_id JOIN buildings b ON b.id = u.building_id
    WHERE bl.id = bill_lines.bill_id AND b.site_id = public.my_site_id()
  ))
);

-- ========== 037: Notifications fix ==========
DROP POLICY IF EXISTS "notifications_select_recipient" ON notifications;
CREATE POLICY "notifications_select_recipient" ON notifications
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM notification_recipients nr WHERE nr.notification_id = notifications.id AND nr.user_id = auth.uid())
  );
DROP POLICY IF EXISTS "notifications_all_manager" ON notifications;
CREATE POLICY "notifications_all_manager" ON notifications FOR ALL USING (public.is_manager());

-- ========== 038: Manager site isolation ==========
DROP POLICY IF EXISTS "buildings_select" ON buildings;
CREATE POLICY "buildings_select" ON buildings FOR SELECT
  USING (public.is_admin() OR (site_id IS NOT NULL AND site_id = public.my_site_id()));

DROP POLICY IF EXISTS "unit_types_select_authenticated" ON unit_types;
CREATE POLICY "unit_types_select" ON unit_types FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
DROP POLICY IF EXISTS "vendors_select_authenticated" ON vendors;
CREATE POLICY "vendors_select" ON vendors FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
DROP POLICY IF EXISTS "service_categories_select_authenticated" ON service_categories;
CREATE POLICY "service_categories_select" ON service_categories FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
DROP POLICY IF EXISTS "services_select_authenticated" ON services;
CREATE POLICY "services_select" ON services FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
DROP POLICY IF EXISTS "expenses_select_authenticated" ON expenses;
CREATE POLICY "expenses_select" ON expenses FOR SELECT
  USING (public.is_admin() OR (public.is_manager() AND (site_id = public.my_site_id() OR site_id IS NULL)));
