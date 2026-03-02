-- Fix "infinite recursion in policy for relation profiles" + ensure entrance/floor on units
-- Run in Supabase SQL Editor.

-- 1) is_manager() - SECURITY DEFINER (bypasses RLS when reading profiles)
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

-- 2) FIX PROFILES: profiles_select_manager caused recursion (it queried profiles again)
--    Use is_manager() instead
DROP POLICY IF EXISTS "profiles_select_manager" ON profiles;
CREATE POLICY "profiles_select_manager" ON profiles FOR SELECT USING (public.is_manager());

-- 3) UNITS: use is_manager() for insert/update/delete (avoid profiles subquery)
DROP POLICY IF EXISTS "units_insert_manager" ON units;
DROP POLICY IF EXISTS "units_update_manager" ON units;
DROP POLICY IF EXISTS "units_delete_manager" ON units;
CREATE POLICY "units_insert_manager" ON units FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "units_update_manager" ON units FOR UPDATE USING (public.is_manager());
CREATE POLICY "units_delete_manager" ON units FOR DELETE USING (public.is_manager());

-- 4) Ensure units has entrance and floor columns
ALTER TABLE units ADD COLUMN IF NOT EXISTS entrance TEXT;
ALTER TABLE units ADD COLUMN IF NOT EXISTS floor TEXT;
