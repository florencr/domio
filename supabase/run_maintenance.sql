-- Admin maintenance functions (trigger toggle, clear data)
-- Run in Supabase SQL Editor. Required for Admin > Maintenance tab.

-- Get delete lock state
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

-- Clear all dummy data (keeps profiles)
CREATE OR REPLACE FUNCTION admin_clear_dummy_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  ALTER TABLE bills DISABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses DISABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;

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

  ALTER TABLE bills ENABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses ENABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE bills ENABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses ENABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END;
$$;

-- Clear data for a single site (per-site clear, uses WHERE clauses)
CREATE OR REPLACE FUNCTION admin_clear_site_data(p_site_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_site_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Site ID required');
  END IF;

  ALTER TABLE bills DISABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses DISABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;

  DELETE FROM audit_log WHERE site_id = p_site_id;
  DELETE FROM documents
    WHERE building_id IN (SELECT id FROM buildings WHERE site_id = p_site_id)
       OR expense_id IN (SELECT id FROM expenses WHERE site_id = p_site_id);
  DELETE FROM invoice_references WHERE site_id = p_site_id;
  DELETE FROM invoice_counters WHERE site_id = p_site_id;
  DELETE FROM bill_lines WHERE bill_id IN (
    SELECT b.id FROM bills b
    JOIN units u ON u.id = b.unit_id
    JOIN buildings bg ON bg.id = u.building_id
    WHERE bg.site_id = p_site_id
  );
  DELETE FROM bills WHERE unit_id IN (
    SELECT u.id FROM units u
    JOIN buildings b ON b.id = u.building_id
    WHERE b.site_id = p_site_id
  );
  DELETE FROM payments WHERE unit_id IN (
    SELECT u.id FROM units u
    JOIN buildings b ON b.id = u.building_id
    WHERE b.site_id = p_site_id
  );
  DELETE FROM unit_tenant_assignments WHERE unit_id IN (
    SELECT u.id FROM units u
    JOIN buildings b ON b.id = u.building_id
    WHERE b.site_id = p_site_id
  );
  DELETE FROM unit_owners WHERE unit_id IN (
    SELECT u.id FROM units u
    JOIN buildings b ON b.id = u.building_id
    WHERE b.site_id = p_site_id
  );
  DELETE FROM expenses WHERE site_id = p_site_id;
  DELETE FROM services WHERE site_id = p_site_id;
  DELETE FROM units WHERE building_id IN (SELECT id FROM buildings WHERE site_id = p_site_id);
  DELETE FROM buildings WHERE site_id = p_site_id;
  DELETE FROM unit_types WHERE site_id = p_site_id;
  DELETE FROM vendors WHERE site_id = p_site_id;
  DELETE FROM service_categories WHERE site_id = p_site_id;
  DELETE FROM sites WHERE id = p_site_id;

  ALTER TABLE bills ENABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses ENABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('success', true);
EXCEPTION WHEN OTHERS THEN
  ALTER TABLE bills ENABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses ENABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines ENABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  RAISE;
END;
$$;
