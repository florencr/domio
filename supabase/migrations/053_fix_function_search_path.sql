-- Fix Supabase Advisor: set search_path on functions to prevent security warning

-- is_period_current
CREATE OR REPLACE FUNCTION is_period_current(p_month SMALLINT, p_year SMALLINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  cur_m SMALLINT := EXTRACT(MONTH FROM current_date)::SMALLINT;
  cur_y SMALLINT := EXTRACT(YEAR FROM current_date)::SMALLINT;
BEGIN
  IF p_month IS NULL OR p_year IS NULL THEN RETURN TRUE; END IF;
  RETURN (p_month = cur_m AND p_year = cur_y);
END;
$$;

-- is_period_editable
CREATE OR REPLACE FUNCTION is_period_editable(p_month SMALLINT, p_year SMALLINT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  cur_m SMALLINT := EXTRACT(MONTH FROM current_date)::SMALLINT;
  cur_y SMALLINT := EXTRACT(YEAR FROM current_date)::SMALLINT;
  prev_m SMALLINT;
  prev_y SMALLINT;
BEGIN
  IF p_month IS NULL OR p_year IS NULL THEN RETURN TRUE; END IF;
  prev_m := CASE WHEN cur_m = 1 THEN 12 ELSE cur_m - 1 END;
  prev_y := CASE WHEN cur_m = 1 THEN cur_y - 1 ELSE cur_y END;
  RETURN (p_month = cur_m AND p_year = cur_y) OR (p_month = prev_m AND p_year = prev_y);
END;
$$;

-- prevent_bill_delete_locked
CREATE OR REPLACE FUNCTION prevent_bill_delete_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NOT is_period_current(OLD.period_month, OLD.period_year) THEN
    RAISE EXCEPTION 'Bill generation cannot be deleted after current bill period.';
  END IF;
  RETURN OLD;
END;
$$;

-- prevent_bill_update_locked
CREATE OR REPLACE FUNCTION prevent_bill_update_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.total_amount IS DISTINCT FROM NEW.total_amount AND NOT is_period_current(OLD.period_month, OLD.period_year) THEN
    RAISE EXCEPTION 'Bill amount is locked for past periods.';
  END IF;
  RETURN NEW;
END;
$$;

-- prevent_bill_line_update_delete_locked
CREATE OR REPLACE FUNCTION prevent_bill_line_update_delete_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  b_month SMALLINT;
  b_year SMALLINT;
BEGIN
  SELECT period_month, period_year INTO b_month, b_year
  FROM bills WHERE id = COALESCE(OLD.bill_id, NEW.bill_id) LIMIT 1;
  IF NOT is_period_current(b_month, b_year) THEN
    RAISE EXCEPTION 'Bill lines are locked for past periods.';
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

-- prevent_expense_delete_locked
CREATE OR REPLACE FUNCTION prevent_expense_delete_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'Paid expenses cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$;

-- prevent_expense_update_locked
CREATE OR REPLACE FUNCTION prevent_expense_update_locked()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF OLD.paid_at IS NOT NULL AND (
    OLD.amount IS DISTINCT FROM NEW.amount OR
    OLD.category IS DISTINCT FROM NEW.category OR
    OLD.vendor IS DISTINCT FROM NEW.vendor OR
    OLD.title IS DISTINCT FROM NEW.title
  ) THEN
    RAISE EXCEPTION 'Paid expense amount cannot be changed.';
  END IF;
  RETURN NEW;
END;
$$;

-- generate_bill_reference
CREATE OR REPLACE FUNCTION generate_bill_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
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
$$;

-- get_next_invoice_number
CREATE OR REPLACE FUNCTION get_next_invoice_number(p_site_id UUID)
RETURNS INT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_next INT;
BEGIN
  INSERT INTO invoice_counters (site_id, last_number) VALUES (p_site_id, 1)
  ON CONFLICT (site_id) DO UPDATE SET last_number = invoice_counters.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END;
$$;
