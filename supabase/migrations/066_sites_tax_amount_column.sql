-- Ensure tax_amount column exists on sites (fixes schema cache error)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(5,2);
