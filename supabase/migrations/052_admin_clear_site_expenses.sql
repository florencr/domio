-- Admin: clear expenses only for a site (keeps bills, buildings, units, etc.)
-- Set paid_at to NULL first so the delete trigger allows it, then delete
CREATE OR REPLACE FUNCTION admin_clear_site_expenses(p_site_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_site_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Site ID required');
  END IF;

  UPDATE expenses SET paid_at = NULL WHERE site_id = p_site_id;
  DELETE FROM expenses WHERE site_id = p_site_id;

  RETURN jsonb_build_object('success', true);
END;
$$;
