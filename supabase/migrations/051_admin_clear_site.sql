-- Admin: clear data for a single site (fixes "DELETE requires WHERE" and allows per-site clear)
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

  -- Disable delete locks for the duration
  ALTER TABLE bills DISABLE TRIGGER trg_prevent_bill_delete_locked;
  ALTER TABLE expenses DISABLE TRIGGER trg_prevent_expense_delete_locked;
  BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_update_locked; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE bill_lines DISABLE TRIGGER trg_prevent_bill_line_delete_locked; EXCEPTION WHEN OTHERS THEN NULL; END;

  -- Delete in dependency order, all with WHERE clauses
  DELETE FROM audit_log WHERE site_id = p_site_id;
  DELETE FROM documents
    WHERE building_id IN (SELECT id FROM buildings WHERE site_id = p_site_id);
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

  -- Re-enable delete locks
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
