-- Fix buildings RLS (run in Supabase SQL Editor if buildings fail but services work)
-- Ensures buildings use is_manager() like services.

-- 1) is_manager() if missing
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

-- 2) Buildings: ensure SELECT (for reading list)
DROP POLICY IF EXISTS "buildings_select_all" ON buildings;
DROP POLICY IF EXISTS "buildings_select_authenticated" ON buildings;
CREATE POLICY "buildings_select_authenticated" ON buildings FOR SELECT TO authenticated USING (true);

-- 3) Buildings: manager insert/update/delete
DROP POLICY IF EXISTS "buildings_insert_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_update_manager" ON buildings;
DROP POLICY IF EXISTS "buildings_delete_manager" ON buildings;
CREATE POLICY "buildings_insert_manager" ON buildings FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "buildings_update_manager" ON buildings FOR UPDATE USING (public.is_manager());
CREATE POLICY "buildings_delete_manager" ON buildings FOR DELETE USING (public.is_manager());
