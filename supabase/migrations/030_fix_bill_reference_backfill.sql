-- Ensure reference_code is set for all bills (trigger + backfill)
-- Run this if bills show without reference in owner/tenant views

-- 1) Ensure column exists
ALTER TABLE bills ADD COLUMN IF NOT EXISTS reference_code TEXT;

-- 2) Ensure trigger function exists
CREATE OR REPLACE FUNCTION generate_bill_reference()
RETURNS TRIGGER AS $$
DECLARE
  v_unit_name TEXT;
  v_unit_code TEXT;
  v_mon TEXT;
  v_seq INT;
BEGIN
  IF NEW.reference_code IS NOT NULL AND NEW.reference_code != '' THEN
    RETURN NEW;
  END IF;
  SELECT unit_name INTO v_unit_name FROM units WHERE id = NEW.unit_id;
  v_unit_code := UPPER(REGEXP_REPLACE(COALESCE(v_unit_name, 'X'), '[^A-Za-z0-9]', '', 'g'));
  v_unit_code := SUBSTRING(v_unit_code FROM 1 FOR 4);
  IF v_unit_code = '' OR v_unit_code IS NULL THEN v_unit_code := 'X'; END IF;
  v_mon := UPPER(SUBSTRING(TO_CHAR(TO_DATE(NEW.period_month::text, 'MM'), 'Mon') FROM 1 FOR 3)) || LPAD((NEW.period_year % 100)::text, 2, '0');
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM bills WHERE unit_id = NEW.unit_id AND period_month = NEW.period_month AND period_year = NEW.period_year AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  NEW.reference_code := 'DOM-' || v_unit_code || '-' || v_mon || '-' || LPAD(v_seq::text, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3) Ensure trigger exists
DROP TRIGGER IF EXISTS trg_bill_reference ON bills;
CREATE TRIGGER trg_bill_reference BEFORE INSERT OR UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION generate_bill_reference();

-- 4) Backfill bills with null/empty reference_code
UPDATE bills b SET reference_code = 'DOM-' || UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(u.unit_name, 'X'), '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 4))
  || '-' || UPPER(SUBSTRING(TO_CHAR(TO_DATE(b.period_month::text, 'MM'), 'Mon') FROM 1 FOR 3)) || LPAD((b.period_year % 100)::text, 2, '0')
  || '-01'
FROM units u WHERE u.id = b.unit_id AND (b.reference_code IS NULL OR b.reference_code = '');

UPDATE bills SET reference_code = 'DOM-X-' || UPPER(SUBSTRING(TO_CHAR(TO_DATE(period_month::text, 'MM'), 'Mon') FROM 1 FOR 3)) || LPAD((period_year % 100)::text, 2, '0') || '-01'
WHERE reference_code IS NULL OR reference_code = '';
