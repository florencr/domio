-- Ensure all site columns exist (fixes "tax_amount column not found" schema cache error)
-- Run in Supabase SQL Editor if you get column not found errors
ALTER TABLE sites ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS vat_account TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS swift_code TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(5,2);
