-- Expense reference: unique suffix (-1, -2, ...) per (category, period)
-- Uses max existing suffix + 1 to avoid duplicates when regenerating

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
    v_mon := UPPER(SUBSTRING(TO_CHAR(CURRENT_DATE, 'Mon') FROM 1 FOR 3)) || LPAD((EXTRACT(YEAR FROM CURRENT_DATE) % 100)::text, 2, '0');
  END IF;
  v_prefix := 'EXP-' || v_cat_code || '-' || v_mon || '-';
  SELECT COALESCE(MAX(
    NULLIF(SUBSTRING(reference_code FROM '([0-9]+)$')::int, 0)
  ), 0) + 1 INTO v_seq
  FROM expenses
  WHERE category = NEW.category
    AND (period_month IS NOT DISTINCT FROM NEW.period_month)
    AND (period_year IS NOT DISTINCT FROM NEW.period_year)
    AND reference_code LIKE v_prefix || '%'
    AND id IS DISTINCT FROM NEW.id;
  NEW.reference_code := v_prefix || v_seq::text;
  RETURN NEW;
END;
$$;
