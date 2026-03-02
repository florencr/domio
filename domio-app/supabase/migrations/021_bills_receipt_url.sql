-- Add receipt_url, receipt_filename, receipt_path to bills for owner payment slip uploads
ALTER TABLE bills ADD COLUMN IF NOT EXISTS receipt_url TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS receipt_filename TEXT;
ALTER TABLE bills ADD COLUMN IF NOT EXISTS receipt_path TEXT;
