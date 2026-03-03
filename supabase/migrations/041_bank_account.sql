-- Add bank_account to sites (for invoice PDF and payment info in owner/tenant dashboards)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS bank_account TEXT;
