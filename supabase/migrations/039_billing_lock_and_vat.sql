-- 1) Add VAT account to sites (for PDF bill generation)
ALTER TABLE sites ADD COLUMN IF NOT EXISTS vat_account TEXT;

-- 2) Lock billing/expenses edit and delete: only current month and previous month allowed
-- Helper: true if period is editable (current or previous month)
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

-- Block DELETE on bills when period is locked
CREATE OR REPLACE FUNCTION prevent_bill_delete_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_period_editable(OLD.period_month, OLD.period_year) THEN
    RAISE EXCEPTION 'Billing period is locked. Only current month and previous month can be deleted.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_bill_delete_locked ON bills;
CREATE TRIGGER trg_prevent_bill_delete_locked
  BEFORE DELETE ON bills FOR EACH ROW EXECUTE FUNCTION prevent_bill_delete_locked();

-- Block DELETE on expenses when period is locked
CREATE OR REPLACE FUNCTION prevent_expense_delete_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT is_period_editable(OLD.period_month, OLD.period_year) THEN
    RAISE EXCEPTION 'Expense period is locked. Only current month and previous month can be deleted.';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_expense_delete_locked ON expenses;
CREATE TRIGGER trg_prevent_expense_delete_locked
  BEFORE DELETE ON expenses FOR EACH ROW EXECUTE FUNCTION prevent_expense_delete_locked();

-- Block UPDATE (paid_at) on expenses when period is locked (defense if API bypassed)
CREATE OR REPLACE FUNCTION prevent_expense_update_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.paid_at IS DISTINCT FROM NEW.paid_at AND NOT is_period_editable(OLD.period_month, OLD.period_year) THEN
    RAISE EXCEPTION 'Expense period is locked. Only current month and previous month can be edited.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_expense_update_locked ON expenses;
CREATE TRIGGER trg_prevent_expense_update_locked
  BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION prevent_expense_update_locked();

-- Block UPDATE (paid_at, status) on bills when period is locked
CREATE OR REPLACE FUNCTION prevent_bill_update_locked()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.paid_at IS DISTINCT FROM NEW.paid_at OR OLD.status IS DISTINCT FROM NEW.status) AND NOT is_period_editable(OLD.period_month, OLD.period_year) THEN
    RAISE EXCEPTION 'Billing period is locked. Only current month and previous month can be edited.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_prevent_bill_update_locked ON bills;
CREATE TRIGGER trg_prevent_bill_update_locked
  BEFORE UPDATE ON bills FOR EACH ROW EXECUTE FUNCTION prevent_bill_update_locked();
