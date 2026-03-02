-- Update services RLS to use is_manager() (same fix as buildings)
-- Run in Supabase SQL Editor

DROP POLICY IF EXISTS "services_insert_manager" ON services;
DROP POLICY IF EXISTS "services_update_manager" ON services;
DROP POLICY IF EXISTS "services_delete_manager" ON services;

CREATE POLICY "services_insert_manager"
  ON services FOR INSERT
  WITH CHECK (public.is_manager());

CREATE POLICY "services_update_manager"
  ON services FOR UPDATE
  USING (public.is_manager());

CREATE POLICY "services_delete_manager"
  ON services FOR DELETE
  USING (public.is_manager());
