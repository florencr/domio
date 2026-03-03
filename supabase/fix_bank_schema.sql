-- Run this in Supabase SQL Editor if you get "bank_account column not found"
-- Adds: bank_account (legacy), bank_name, iban, swift_code to sites table
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS swift_code TEXT;
