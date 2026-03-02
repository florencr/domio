-- DOMIO: Full Configuration Fix
-- Run this entire file in Supabase SQL Editor ONCE.
-- Fixes RLS so buildings, units, services, etc. work like unit_types.

-- 1) is_manager() helper (bypasses RLS recursion)
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager'
  );
$$;

-- 2) BUILDINGS - use is_manager()
DROP POLICY IF EXISTS "buildings_insert_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_update_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_delete_manager" ON buildings;
CREATE POLICY "buildings_insert_manager" ON buildings FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "buildings_update_manager" ON buildings FOR UPDATE USING (public.is_manager());
CREATE POLICY "buildings_delete_manager" ON buildings FOR DELETE USING (public.is_manager());

-- 3) UNITS - use is_manager()
DROP POLICY IF EXISTS "units_insert_manager" ON units;
DROP POLICY IF EXISTS "units_update_manager" ON units;
DROP POLICY IF EXISTS "units_delete_manager" ON units;
CREATE POLICY "units_insert_manager" ON units FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "units_update_manager" ON units FOR UPDATE USING (public.is_manager());
CREATE POLICY "units_delete_manager" ON units FOR DELETE USING (public.is_manager());

-- 4) SERVICES - use is_manager()
DROP POLICY IF EXISTS "services_insert_manager" ON services;
DROP POLICY IF EXISTS "services_update_manager" ON services;
DROP POLICY IF EXISTS "services_delete_manager" ON services;
CREATE POLICY "services_insert_manager" ON services FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "services_update_manager" ON services FOR UPDATE USING (public.is_manager());
CREATE POLICY "services_delete_manager" ON services FOR DELETE USING (public.is_manager());

-- 5) EXPENSES - use is_manager()
DROP POLICY IF EXISTS "expenses_insert_manager" ON expenses;
DROP POLICY IF EXISTS "expenses_update_manager" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_manager" ON expenses;
CREATE POLICY "expenses_insert_manager" ON expenses FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "expenses_update_manager" ON expenses FOR UPDATE USING (public.is_manager());
CREATE POLICY "expenses_delete_manager" ON expenses FOR DELETE USING (public.is_manager());

-- 6) UNIT_TYPES - use is_manager()
DROP POLICY IF EXISTS "unit_types_insert_manager" ON unit_types;
DROP POLICY IF EXISTS "unit_types_update_manager" ON unit_types;
DROP POLICY IF EXISTS "unit_types_delete_manager" ON unit_types;
CREATE POLICY "unit_types_insert_manager" ON unit_types FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "unit_types_update_manager" ON unit_types FOR UPDATE USING (public.is_manager());
CREATE POLICY "unit_types_delete_manager" ON unit_types FOR DELETE USING (public.is_manager());

-- 7) SERVICE_CATEGORIES table + RLS
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_categories_select_authenticated" ON service_categories;
DROP POLICY IF EXISTS "service_categories_insert_manager" ON service_categories;
DROP POLICY IF EXISTS "service_categories_update_manager" ON service_categories;
DROP POLICY IF EXISTS "service_categories_delete_manager" ON service_categories;
CREATE POLICY "service_categories_select_authenticated" ON service_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_categories_insert_manager" ON service_categories FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "service_categories_update_manager" ON service_categories FOR UPDATE USING (public.is_manager());
CREATE POLICY "service_categories_delete_manager" ON service_categories FOR DELETE USING (public.is_manager());

-- 8) VENDORS table + RLS
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vendors_select_authenticated" ON vendors;
DROP POLICY IF EXISTS "vendors_insert_manager" ON vendors;
DROP POLICY IF EXISTS "vendors_update_manager" ON vendors;
DROP POLICY IF EXISTS "vendors_delete_manager" ON vendors;
CREATE POLICY "vendors_select_authenticated" ON vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendors_insert_manager" ON vendors FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "vendors_update_manager" ON vendors FOR UPDATE USING (public.is_manager());
CREATE POLICY "vendors_delete_manager" ON vendors FOR DELETE USING (public.is_manager());
