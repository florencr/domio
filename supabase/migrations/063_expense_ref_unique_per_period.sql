-- Expense reference: unique -1, -2 suffix per (site_id, period)
-- Rule: reference_code must always be unique

-- 1) Update trigger function: scope by site_id + period, suffix -1, -2, -3...
CREATE OR REPLACE FUNCTION generate_expense_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_cat_code TEXT;
  v_mon TEXT;
  v_seq INT;
  v_prefix TEXT;
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
    v_mon := 'TMP';
  END IF;
  v_prefix := 'EXP-' || v_cat_code || '-' || v_mon || '-';
  SELECT COALESCE(MAX(
    NULLIF(SUBSTRING(reference_code FROM '([0-9]+)$')::int, 0)
  ), 0) + 1 INTO v_seq
  FROM expenses
  WHERE (site_id IS NOT DISTINCT FROM NEW.site_id)
    AND (period_month IS NOT DISTINCT FROM NEW.period_month)
    AND (period_year IS NOT DISTINCT FROM NEW.period_year)
    AND category = NEW.category
    AND reference_code IS NOT NULL
    AND reference_code LIKE v_prefix || '%'
    AND id IS DISTINCT FROM NEW.id;
  NEW.reference_code := v_prefix || v_seq::text;
  RETURN NEW;
END;
$$;

-- 2) Backfill null/empty reference_codes with unique values
WITH ranked AS (
  SELECT id, site_id, period_month, period_year, category,
    ROW_NUMBER() OVER (
      PARTITION BY site_id, period_month, period_year, category
      ORDER BY created_at NULLS LAST, id
    ) as rn
  FROM expenses
  WHERE reference_code IS NULL OR reference_code = ''
),
prefixed AS (
  SELECT r.id,
    'EXP-' || UPPER(SUBSTRING(REGEXP_REPLACE(COALESCE(r.category, 'X'), '[^A-Za-z0-9]', '', 'g') FROM 1 FOR 3))
    || '-' || CASE WHEN r.period_month IS NOT NULL AND r.period_year IS NOT NULL
      THEN UPPER(SUBSTRING(TO_CHAR(TO_DATE(r.period_month::text, 'MM'), 'Mon') FROM 1 FOR 3)) || LPAD((r.period_year % 100)::text, 2, '0')
      ELSE 'TMP' END
    || '-' || r.rn::text as ref
  FROM ranked r
)
UPDATE expenses e SET reference_code = p.ref
FROM prefixed p WHERE e.id = p.id;

-- 3) Fix any duplicates (same ref) by renumbering -1, -2, -3
WITH dups AS (
  SELECT id, reference_code,
    ROW_NUMBER() OVER (PARTITION BY reference_code ORDER BY created_at NULLS LAST, id) as rn
  FROM expenses
  WHERE reference_code IN (
    SELECT reference_code FROM expenses WHERE reference_code IS NOT NULL
    GROUP BY reference_code HAVING COUNT(*) > 1
  )
)
UPDATE expenses e SET reference_code = regexp_replace(d.reference_code, '-[0-9]+$', '-' || d.rn::text)
FROM dups d WHERE e.id = d.id;

-- 4) Add UNIQUE constraint on reference_code
DROP INDEX IF EXISTS idx_expenses_reference;
CREATE UNIQUE INDEX idx_expenses_reference_unique ON expenses(reference_code) WHERE reference_code IS NOT NULL AND reference_code != '';
