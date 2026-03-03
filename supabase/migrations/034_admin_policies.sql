-- Admin can read all profiles (for listing users when creating managers)
DROP POLICY IF EXISTS "profiles_select_manager" ON profiles;
CREATE POLICY "profiles_select_manager" ON profiles FOR SELECT
  USING (public.is_manager() OR public.is_admin());
