-- Add 'paid' to bills status check constraint
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_status_check;
ALTER TABLE bills ADD CONSTRAINT bills_status_check CHECK (status IN ('draft', 'published', 'paid', 'reversed'));
