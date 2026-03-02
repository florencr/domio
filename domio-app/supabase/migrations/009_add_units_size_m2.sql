-- Add size_m2 to units if missing (run in Supabase SQL Editor)
ALTER TABLE units ADD COLUMN IF NOT EXISTS size_m2 NUMERIC(10,2);
