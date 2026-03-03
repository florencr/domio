-- Ensure all bank-related columns exist on sites (fixes schema cache error)
-- Run this in Supabase SQL Editor if you get "bank_account column not found"
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS swift_code TEXT;
