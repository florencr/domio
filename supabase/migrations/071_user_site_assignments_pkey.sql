-- Fix DBs where user_site_assignments exists without PRIMARY KEY (upsert ON CONFLICT failed).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'user_site_assignments'
      AND n.nspname = 'public'
  ) THEN
    RETURN;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = rel.relnamespace
    WHERE rel.relname = 'user_site_assignments'
      AND n.nspname = 'public'
      AND con.contype = 'p'
  ) THEN
    RETURN;
  END IF;

  DELETE FROM user_site_assignments u
  WHERE u.ctid <> (
    SELECT MIN(u2.ctid) FROM user_site_assignments u2 WHERE u2.user_id = u.user_id
  );

  ALTER TABLE user_site_assignments ADD PRIMARY KEY (user_id);
END $$;
