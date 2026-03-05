-- Admin maintenance: trigger toggle and clear dummy data
-- Only callable by admin (checked in API using service role + admin profile)

-- Get delete lock state (true = triggers enabled, false = disabled)
CREATE OR REPLACE FUNCTION admin_get_delete_lock_state()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  bills_enabled BOOLEAN;
  expenses_enabled BOOLEAN;
BEGIN
  SELECT (t.tgenabled <> 'D') INTO bills_enabled
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname = 'bills' AND t.tgname = 'trg_prevent_bill_delete_locked'
  LIMIT 1;
  IF bills_enabled IS NULL THEN bills_enabled := true; END IF;

  SELECT (t.tgenabled <> 'D') INTO expenses_enabled
  FROM pg_trigger t
  JOIN pg_class c ON t.tgrelid = c.oid
  WHERE c.relname = 'expenses' AND t.tgname = 'trg_prevent_expense_delete_locked'
  LIMIT 1;
  IF expenses_enabled IS NULL THEN expenses_enabled := true; END IF;

  RETURN jsonb_build_object('enabled', COALESCE(bills_enabled AND expenses_enabled, true));
END;
$$;

-- Set delete locks on or off (bills, bill_lines, expenses)
CREATE OR REPLACE FUNCTION admin_set_delete_locks(p_enabled BOOLEAN)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_enabled THEN
    ALTER TABLE bills ENABLE TRIGGER trg_prevent_bill_delete_locked;
    ALTER TABLE expenses ENABLE TRIGGER trg_prevent_expense_delete_locked;
    BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN jsonb_build_object('success', true, 'enabled', true);
  ELSE
    ALTER TABLE bills DISABLE TRIGGER trg_prevent_bill_delete_locked;
    ALTER TABLE expenses DISABLE TRIGGER trg_prevent_expense_delete_locked;
    BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
    BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
    RETURN jsonb_build_object('success', true, 'enabled', false);
  END IF;
END;
$$;

-- Clear all dummy data (keeps profiles). Disables triggers, deletes, re-enables.
CREATE OR REPLACE FUNCTION admin_clear_dummy_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Disable delete locks
  ALTER TABLE bills DISABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses DISABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Delete in dependency order
  DELETE FROM notification_recipients;
  DELETE FROM notifications;
  DELETE FROM device_tokens;
  DELETE FROM audit_log;
  DELETE FROM documents;
  DELETE FROM invoice_references;
  DELETE FROM invoice_counters;
  DELETE FROM bill_lines;
  DELETE FROM bills;
  DELETE FROM payments;
  DELETE FROM unit_tenant_assignments;
  DELETE FROM unit_owners;
  DELETE FROM expenses;
  DELETE FROM services;
  DELETE FROM units;
  DELETE FROM buildings;
  DELETE FROM sites;
  DELETE FROM unit_types;
  DELETE FROM vendors;
  DELETE FROM service_categories;

  -- Re-seed default unit types so managers always have options
  INSERT INTO unit_types (name) VALUES
    ('apartment'), ('villa'), ('parking'), ('garden'), ('patio')
  ON CONFLICT (name) DO NOTHING;

  -- Re-enable delete locks
  ALTER TABLE bills ENABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses ENABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  -- Re-enable on error
  ALTER TABLE bills ENABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses ENABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END;
$$;
