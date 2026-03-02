-- Helper: check if current user is manager (bypasses RLS recursion)
-- Run in Supabase SQL Editor

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

-- Update buildings insert policy to use the function
DROP POLICY IF EXISTS "buildings_insert_manager" ON buildings;
CREATE POLICY "buildings_insert_manager"
  ON buildings FOR INSERT
  WITH CHECK (public.is_manager());
