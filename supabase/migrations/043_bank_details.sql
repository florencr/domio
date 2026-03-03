-- Bank details for sites: bank_account (legacy), bank_name, iban, swift_code
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bank_account TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS iban TEXT;
ALTER TABLE sites ADD COLUMN IF NOT EXISTS swift_code TEXT;
