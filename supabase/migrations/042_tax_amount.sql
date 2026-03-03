-- Add tax_amount to sites (percentage used for bill calculation, e.g. 20 for 20%)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(5,2);
