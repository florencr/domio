-- Re-seed default unit types if table was cleared (bypasses RLS)
CREATE OR REPLACE FUNCTION seed_unit_types_if_empty()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO unit_types (name) VALUES
    ('apartment'), ('villa'), ('parking'), ('garden'), ('patio')
  ON CONFLICT (name) DO NOTHING;
END;
$$;
SELECT seed_unit_types_if_empty();
