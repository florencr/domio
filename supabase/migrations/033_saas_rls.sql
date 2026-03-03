-- SaaS: Update RLS for site-scoped access
-- Run AFTER 032_saas_sites.sql

-- Helper: is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE result boolean;
BEGIN
  SET LOCAL row_security = off;
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO result;
  RETURN result;
END;
$$;

-- Helper: get current manager's site_id
CREATE OR REPLACE FUNCTION public.my_site_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT id FROM sites WHERE manager_id = auth.uid() LIMIT 1;
$$;

-- Sites RLS
ALTER TABLE sites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sites_select_manager_own" ON sites;
CREATE POLICY "sites_select_manager_own" ON sites FOR SELECT
  USING (manager_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "sites_select_admin_all" ON sites;
DROP POLICY IF EXISTS "sites_insert_admin" ON sites;
CREATE POLICY "sites_insert_admin" ON sites FOR INSERT
  WITH CHECK (public.is_admin());

-- Buildings: manager sees only their site's buildings
DROP POLICY IF EXISTS "buildings_select_authenticated" ON buildings;
DROP POLICY IF EXISTS "buildings_insert_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_update_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_delete_manager" ON buildings;

CREATE POLICY "buildings_select" ON buildings FOR SELECT
  USING (
    public.is_admin()
    OR (site_id IS NOT NULL AND site_id = public.my_site_id())
    OR (site_id IS NULL AND public.is_manager())
  );

CREATE POLICY "buildings_insert_manager" ON buildings FOR INSERT
  WITH CHECK (public.is_manager() AND (site_id = public.my_site_id() OR (site_id IS NULL AND public.my_site_id() IS NOT NULL)));

CREATE POLICY "buildings_update_manager" ON buildings FOR UPDATE
  USING (public.is_admin() OR (site_id = public.my_site_id()));

CREATE POLICY "buildings_delete_manager" ON buildings FOR DELETE
  USING (public.is_admin() OR (site_id = public.my_site_id()));

-- Trigger: auto-set site_id when manager creates building without it
CREATE OR REPLACE FUNCTION set_building_site_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.site_id IS NULL AND public.is_manager() THEN
    NEW.site_id := public.my_site_id();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
DROP TRIGGER IF EXISTS trg_building_site ON buildings;
CREATE TRIGGER trg_building_site BEFORE INSERT ON buildings
  FOR EACH ROW EXECUTE FUNCTION set_building_site_id();

-- Units: manager sees units in their site's buildings
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

-- Unit types, vendors, service_categories, services: site-scoped for managers
-- (Drop existing manager policies, create site-scoped ones. Select policies may differ.)
-- Keeping existing policies for now - they use is_manager(). We'll scope in app by filtering.
-- For full RLS scope, run 034_saas_rls_config.sql after verifying 032-033 work.
