-- Fix infinite recursion: disable RLS inside is_manager() when reading profiles
-- Run in Supabase SQL Editor.

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
  -- Disable RLS for this query (avoids recursion when reading profiles)
  SET LOCAL row_security = off;
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'manager'::app_role
  ) INTO result;
  RETURN result;
END;
$$;

DROP POLICY IF EXISTS "profiles_select_manager" ON profiles;
CREATE POLICY "profiles_select_manager" ON profiles FOR SELECT USING (public.is_manager());

DROP POLICY IF EXISTS "units_insert_manager" ON units;
DROP POLICY IF EXISTS "units_update_manager" ON units;
DROP POLICY IF EXISTS "units_delete_manager" ON units;
CREATE POLICY "units_insert_manager" ON units FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "units_update_manager" ON units FOR UPDATE USING (public.is_manager());
CREATE POLICY "units_delete_manager" ON units FOR DELETE USING (public.is_manager());
