-- Simplified lock logic per user requirements:
-- Bills: delete only current period; status/paid_at change anytime; amount locked for past periods
-- Expenses: lock when paid (can't delete or change amount); paid_at change anytime
-- Bill lines: locked when bill period is past (amount can't change)

-- Helper: current month only (for bill delete and amount lock)
CREATE OR REPLACE FUNCTION is_period_current(p_month SMALLINT, p_year SMALLINT)
RETURNS BOOLEAN AS $$
DECLARE
  cur_m SMALLINT := EXTRACT(MONTH FROM current_date)::SMALLINT;
  cur_y SMALLINT := EXTRACT(YEAR FROM current_date)::SMALLINT;
BEGIN
  IF p_month IS NULL OR p_year IS NULL THEN RETURN TRUE; END IF;
  RETURN (p_month = cur_m AND p_year = cur_y);
END;
$$ LANGUAGE plpgsql;

-- Keep is_period_editable for backward compat (current+previous) - used by UI
CREATE OR REPLACE FUNCTION is_period_editable(p_month SMALLINT, p_year SMALLINT)
RETURNS BOOLEAN AS $$
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
$$ LANGUAGE plpgsql IMMUTABLE;

-- Bills: block DELETE only when period is not current (can delete current period's generation only)
CREATE OR REPLACE FUNCTION prevent_bill_delete_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_period_current(OLD.period_month, OLD.period_year) THEN
    RAISE EXCEPTION 'Bill generation cannot be deleted after current bill period.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_bill_delete_locked ON bills;
CREATE TRIGGER trg_prevent_bill_delete_locked
  BEFORE DELETE ON bills FOR EACH ROW EXECUTE FUNCTION prevent_bill_delete_locked();

-- Bills: block UPDATE only when changing amount (total_amount); status and paid_at can change anytime
CREATE OR REPLACE FUNCTION prevent_bill_update_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.total_amount IS DISTINCT FROM NEW.total_amount AND NOT is_period_current(OLD.period_month, OLD.period_year) THEN
    RAISE EXCEPTION 'Bill amount is locked for past periods.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_bill_update_locked ON bills;
CREATE TRIGGER trg_prevent_bill_update_locked
  BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION prevent_bill_update_locked();

-- Bill lines: block UPDATE/DELETE when parent bill period is past (amount locked)
CREATE OR REPLACE FUNCTION prevent_bill_line_update_delete_locked()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_bill_line_update_locked ON bill_lines;
DROP TRIGGER IF EXISTS trg_prevent_bill_line_delete_locked ON bill_lines;
CREATE TRIGGER trg_prevent_bill_line_update_locked
  BEFORE UPDATE ON bill_lines FOR EACH ROW EXECUTE FUNCTION prevent_bill_line_update_delete_locked();
CREATE TRIGGER trg_prevent_bill_line_delete_locked
  BEFORE DELETE ON bill_lines FOR EACH ROW EXECUTE FUNCTION prevent_bill_line_update_delete_locked();

-- Expenses: block DELETE only when paid (unpaid can always be deleted)
CREATE OR REPLACE FUNCTION prevent_expense_delete_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.paid_at IS NOT NULL THEN
    RAISE EXCEPTION 'Paid expenses cannot be deleted.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_expense_delete_locked ON expenses;
CREATE TRIGGER trg_prevent_expense_delete_locked
  BEFORE DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION prevent_expense_delete_locked();

-- Expenses: paid_at can change anytime; block amount/category/vendor change when paid
CREATE OR REPLACE FUNCTION prevent_expense_update_locked()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_expense_update_locked ON expenses;
CREATE TRIGGER trg_prevent_expense_update_locked
  BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION prevent_expense_update_locked();
