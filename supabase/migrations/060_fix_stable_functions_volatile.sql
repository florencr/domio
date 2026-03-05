-- Fix "SET is not allowed in a non-volatile function"
-- is_manager() and is_admin() use SET LOCAL row_security = off but were marked STABLE.
-- They must be VOLATILE to use SET commands.

CREATE OR REPLACE FUNCTION public.is_manager()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE result boolean;
BEGIN
  SET LOCAL row_security = off;
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager') INTO result;
  RETURN result;
END;
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
VOLATILE
AS $$
DECLARE result boolean;
BEGIN
  SET LOCAL row_security = off;
  SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin') INTO result;
  RETURN result;
END;
$$;
