-- 1) Ensure is_manager() exists
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

-- 2) Update all manager RLS policies to use is_manager()
DROP POLICY IF EXISTS "buildings_insert_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_update_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_delete_manager" ON buildings;
CREATE POLICY "buildings_insert_manager" ON buildings FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "buildings_update_manager" ON buildings FOR UPDATE USING (public.is_manager());
CREATE POLICY "buildings_delete_manager" ON buildings FOR DELETE USING (public.is_manager());

DROP POLICY IF EXISTS "units_insert_manager" ON units;
DROP POLICY IF EXISTS "units_update_manager" ON units;
DROP POLICY IF EXISTS "units_delete_manager" ON units;
CREATE POLICY "units_insert_manager" ON units FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "units_update_manager" ON units FOR UPDATE USING (public.is_manager());
CREATE POLICY "units_delete_manager" ON units FOR DELETE USING (public.is_manager());

DROP POLICY IF EXISTS "services_insert_manager" ON services;
DROP POLICY IF EXISTS "services_update_manager" ON services;
DROP POLICY IF EXISTS "services_delete_manager" ON services;
CREATE POLICY "services_insert_manager" ON services FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "services_update_manager" ON services FOR UPDATE USING (public.is_manager());
CREATE POLICY "services_delete_manager" ON services FOR DELETE USING (public.is_manager());

DROP POLICY IF EXISTS "expenses_insert_manager" ON expenses;
DROP POLICY IF EXISTS "expenses_update_manager" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_manager" ON expenses;
CREATE POLICY "expenses_insert_manager" ON expenses FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "expenses_update_manager" ON expenses FOR UPDATE USING (public.is_manager());
CREATE POLICY "expenses_delete_manager" ON expenses FOR DELETE USING (public.is_manager());

-- 3) Create service_categories table
CREATE TABLE IF NOT EXISTS service_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE service_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_categories_select_authenticated" ON service_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "service_categories_insert_manager" ON service_categories FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "service_categories_update_manager" ON service_categories FOR UPDATE USING (public.is_manager());
CREATE POLICY "service_categories_delete_manager" ON service_categories FOR DELETE USING (public.is_manager());

-- 4) Create vendors table
CREATE TABLE IF NOT EXISTS vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendors_select_authenticated" ON vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "vendors_insert_manager" ON vendors FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "vendors_update_manager" ON vendors FOR UPDATE USING (public.is_manager());
CREATE POLICY "vendors_delete_manager" ON vendors FOR DELETE USING (public.is_manager());

-- 5) Add optional service_category_id and vendor_id to services/expenses
ALTER TABLE services ADD COLUMN IF NOT EXISTS service_category_id UUID REFERENCES service_categories(id) ON DELETE SET NULL;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES vendors(id) ON DELETE SET NULL;
