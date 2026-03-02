-- Fix infinite recursion: use a small helper table instead of querying profiles
-- Run in Supabase SQL Editor. No RLS on manager_check table = no recursion.

-- 1) Small table: who is manager (no RLS = no recursion when we read it)
CREATE TABLE IF NOT EXISTS public.manager_check (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Allow anyone to read (we only check if current user is in the list)
ALTER TABLE public.manager_check ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "manager_check_select_own" ON public.manager_check;
CREATE POLICY "manager_check_select_own" ON public.manager_check
  FOR SELECT USING (auth.uid() = user_id);

-- 2) is_manager() reads from manager_check, NOT profiles (no recursion)
CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (SELECT 1 FROM public.manager_check WHERE user_id = auth.uid());
$$;

-- 3) Sync: add your manager user(s) to manager_check
-- Replace YOUR_MANAGER_USER_ID with your actual user UUID (from auth.users or profiles where role='manager')
-- Run this after the above, with your manager ID:
-- INSERT INTO public.manager_check (user_id) 
-- SELECT id FROM public.profiles WHERE role = 'manager'::app_role 
-- ON CONFLICT (user_id) DO NOTHING;

-- 4) One-time sync of existing managers into manager_check
INSERT INTO public.manager_check (user_id)
SELECT id FROM public.profiles WHERE role = 'manager'::app_role
ON CONFLICT (user_id) DO NOTHING;

-- 5) Trigger: keep manager_check in sync when profile role changes
CREATE OR REPLACE FUNCTION public.sync_manager_check()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role = 'manager'::app_role THEN
    INSERT INTO public.manager_check (user_id) VALUES (NEW.id) ON CONFLICT (user_id) DO NOTHING;
  ELSE
    DELETE FROM public.manager_check WHERE user_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS sync_manager_check_trigger ON public.profiles;
CREATE TRIGGER sync_manager_check_trigger
  AFTER INSERT OR UPDATE OF role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_manager_check();

-- 6) Replace profiles_select_manager (avoids recursion - but managers still need to read profiles)
-- We keep profiles_select_manager but use is_manager() which now reads manager_check, not profiles
DROP POLICY IF EXISTS "profiles_select_manager" ON profiles;
CREATE POLICY "profiles_select_manager" ON profiles FOR SELECT USING (public.is_manager());

-- 7) Units policies
DROP POLICY IF EXISTS "units_insert_manager" ON units;
DROP POLICY IF EXISTS "units_update_manager" ON units;
DROP POLICY IF EXISTS "units_delete_manager" ON units;
CREATE POLICY "units_insert_manager" ON units FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "units_update_manager" ON units FOR UPDATE USING (public.is_manager());
CREATE POLICY "units_delete_manager" ON units FOR DELETE USING (public.is_manager());
