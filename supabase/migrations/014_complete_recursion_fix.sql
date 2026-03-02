-- COMPLETE FIX: Remove all recursive policies and set up correct ones
-- Run this in Supabase SQL Editor to fix infinite recursion once and for all

-- STEP 1: Drop ALL existing RLS policies that could cause recursion
DROP POLICY IF EXISTS "profiles_select_manager" ON profiles;
DROP POLICY IF EXISTS "buildings_insert_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_update_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_delete_manager" ON buildings;
DROP POLICY IF EXISTS "units_select_manager" ON units;
DROP POLICY IF EXISTS "units_insert_manager" ON units;
DROP POLICY IF EXISTS "units_update_manager" ON units;
DROP POLICY IF EXISTS "units_delete_manager" ON units;
DROP POLICY IF EXISTS "services_insert_manager" ON services;
DROP POLICY IF EXISTS "services_update_manager" ON services;
DROP POLICY IF EXISTS "services_delete_manager" ON services;
DROP POLICY IF EXISTS "expenses_insert_manager" ON expenses;
DROP POLICY IF EXISTS "expenses_update_manager" ON expenses;
DROP POLICY IF EXISTS "expenses_delete_manager" ON expenses;

-- STEP 2: Create is_manager() function with row_security OFF
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  result boolean;
BEGIN
  -- Turn off RLS to prevent recursion when checking profiles
  SET LOCAL row_security = off;
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND "role" = 'manager'::app_role
  ) INTO result;
  RETURN result;
END;
$$;

-- STEP 3: Create NON-RECURSIVE policies using is_manager()
-- Profiles
CREATE POLICY "profiles_select_manager" ON profiles 
  FOR SELECT USING (public.is_manager());

-- Buildings
CREATE POLICY "buildings_insert_manager" ON buildings 
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "buildings_update_manager" ON buildings 
  FOR UPDATE USING (public.is_manager());
CREATE POLICY "buildings_delete_manager" ON buildings 
  FOR DELETE USING (public.is_manager());

-- Units
CREATE POLICY "units_select_manager" ON units 
  FOR SELECT USING (public.is_manager());
CREATE POLICY "units_insert_manager" ON units 
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "units_update_manager" ON units 
  FOR UPDATE USING (public.is_manager());
CREATE POLICY "units_delete_manager" ON units 
  FOR DELETE USING (public.is_manager());

-- Services
CREATE POLICY "services_insert_manager" ON services 
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "services_update_manager" ON services 
  FOR UPDATE USING (public.is_manager());
CREATE POLICY "services_delete_manager" ON services 
  FOR DELETE USING (public.is_manager());

-- Expenses
CREATE POLICY "expenses_insert_manager" ON expenses 
  FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "expenses_update_manager" ON expenses 
  FOR UPDATE USING (public.is_manager());
CREATE POLICY "expenses_delete_manager" ON expenses 
  FOR DELETE USING (public.is_manager());

-- STEP 4: Ensure units has all columns
ALTER TABLE units ADD COLUMN IF NOT EXISTS size_m2 NUMERIC(10,2);
ALTER TABLE units ADD COLUMN IF NOT EXISTS entrance TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS floor TEXT;
