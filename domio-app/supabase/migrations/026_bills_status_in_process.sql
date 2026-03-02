-- Add 'in_process' status for when slip is uploaded (awaiting payment confirmation)
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_status_check;
ALTER TABLE bills ADD CONSTRAINT bills_status_check CHECK (status IN ('draft', 'published', 'paid', 'reversed', 'in_process'));
