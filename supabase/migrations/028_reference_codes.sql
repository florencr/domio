-- Add reference_code to bills and expenses
-- Format: DOM-{unit}-{MONYY}-{seq} for bills, EXP-{category}-{MONYY}-{seq} for expenses

ALTER TABLE bills ADD COLUMN IF NOT EXISTS reference_code TEXT;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS reference_code TEXT;

CREATE INDEX IF NOT EXISTS idx_bills_reference ON bills(reference_code);
CREATE INDEX IF NOT EXISTS idx_expenses_reference ON expenses(reference_code);

-- Function to generate bill reference: DOM-A101-MAR26-01
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

-- Function to generate expense reference: EXP-SEC-MAR26-01
CREATE OR REPLACE FUNCTION generate_expense_reference()
RETURNS TRIGGER AS $$
DECLARE
  v_cat_code TEXT;
  v_mon TEXT;
  v_seq INT;
BEGIN
  IF NEW.reference_code IS NOT NULL AND NEW.reference_code != '' THEN
    RETURN NEW;
  END IF;
  v_cat_code := UPPER(REGEXP_REPLACE(COALESCE(NEW.category, 'X'), '[^A-Za-z0-9]', '', 'g'));
  v_cat_code := SUBSTRING(v_cat_code FROM 1 FOR 3);
  IF v_cat_code = '' OR v_cat_code IS NULL THEN v_cat_code := 'EXP'; END IF;
  IF NEW.period_month IS NOT NULL AND NEW.period_year IS NOT NULL THEN
    v_mon := UPPER(SUBSTRING(TO_CHAR(TO_DATE(NEW.period_month::text, 'MM'), 'Mon') FROM 1 FOR 3)) || LPAD((NEW.period_year % 100)::text, 2, '0');
  ELSE
    v_mon := UPPER(SUBSTRING(TO_CHAR(CURRENT_DATE, 'Mon') FROM 1 FOR 3)) || LPAD((EXTRACT(YEAR FROM CURRENT_DATE) % 100)::text, 2, '0');
  END IF;
  SELECT COALESCE(COUNT(*), 0) + 1 INTO v_seq
  FROM expenses
  WHERE category = NEW.category
    AND (period_month IS NOT DISTINCT FROM NEW.period_month)
    AND (period_year IS NOT DISTINCT FROM NEW.period_year)
    AND id IS DISTINCT FROM NEW.id;
  NEW.reference_code := 'EXP-' || v_cat_code || '-' || v_mon || '-' || LPAD(v_seq::text, 2, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_bill_reference ON bills;
CREATE TRIGGER trg_bill_reference BEFORE INSERT OR UPDATE ON bills
  FOR EACH ROW EXECUTE FUNCTION generate_bill_reference();

DROP TRIGGER IF EXISTS trg_expense_reference ON expenses;
CREATE TRIGGER trg_expense_reference BEFORE INSERT OR UPDATE ON expenses
  FOR EACH ROW EXECUTE FUNCTION generate_expense_reference();

-- Backfill existing bills
UPDATE bills b SET reference_code = 'DOM-' || UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(u.unit_name, 'X'), '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 4))
  || '-' || UPPER(SUBSTRING(TO_CHAR(TO_DATE(b.period_month::text, 'MM'), 'Mon') FROM 1 FOR 3)) || LPAD((b.period_year % 100)::text, 2, '0')
  || '-01'
FROM units u WHERE u.id = b.unit_id AND (b.reference_code IS NULL OR b.reference_code = '');
UPDATE bills SET reference_code = 'DOM-X-' || UPPER(SUBSTRING(TO_CHAR(TO_DATE(period_month::text, 'MM'), 'Mon') FROM 1 FOR 3)) || LPAD((period_year % 100)::text, 2, '0') || '-01'
WHERE reference_code IS NULL OR reference_code = '';

-- Backfill existing expenses (with period)
WITH ranked AS (
  SELECT id,
    UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(category, 'X'), '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 3)) as cat_code,
    UPPER(SUBSTRING(TO_CHAR(TO_DATE(period_month::text, 'MM'), 'Mon') FROM 1 FOR 3)) || LPAD((period_year % 100)::text, 2, '0') as mon,
    ROW_NUMBER() OVER (PARTITION BY category, period_month, period_year ORDER BY created_at NULLS LAST, id) as rn
  FROM expenses
  WHERE period_month IS NOT NULL AND period_year IS NOT NULL AND (reference_code IS NULL OR reference_code = '')
)
UPDATE expenses e SET reference_code = 'EXP-' || r.cat_code || '-' || r.mon || '-' || LPAD(r.rn::text, 2, '0')
FROM ranked r WHERE e.id = r.id;

-- Backfill expenses without period (templates) - use generic code
UPDATE expenses SET reference_code = 'EXP-' || UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(category, 'X'), '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 3))
  || '-TMP-01'
WHERE (reference_code IS NULL OR reference_code = '') AND period_month IS NULL AND period_year IS NULL;
