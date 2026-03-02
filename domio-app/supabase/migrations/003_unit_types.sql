-- Unit types table (create your own, not hardcoded enum)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS unit_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Change units.type and services.unit_type from enum to TEXT (store unit type name)
ALTER TABLE units ALTER COLUMN "type" TYPE TEXT USING "type"::text;
ALTER TABLE services ALTER COLUMN unit_type TYPE TEXT USING unit_type::text;

-- Seed default unit types (optional)
INSERT INTO unit_types (name) VALUES
  ('apartment'), ('villa'), ('parking'), ('garden'), ('patio')
ON CONFLICT (name) DO NOTHING;

-- RLS
ALTER TABLE unit_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "unit_types_select_authenticated" ON unit_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "unit_types_insert_manager" ON unit_types FOR INSERT WITH CHECK (public.is_manager());
CREATE POLICY "unit_types_update_manager" ON unit_types FOR UPDATE USING (public.is_manager());
CREATE POLICY "unit_types_delete_manager" ON unit_types FOR DELETE USING (public.is_manager());
