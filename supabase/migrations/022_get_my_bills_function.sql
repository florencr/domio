-- Function to get bills for the current user (owner or tenant)
-- Owners see bills for their units. Tenants see bills for units they're assigned to (payment responsible).
-- Run in Supabase SQL Editor if using hosted Supabase.

CREATE OR REPLACE FUNCTION public.get_my_bills(lim integer DEFAULT 200)
RETURNS SETOF bills
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  WITH my_units AS (
    SELECT unit_id FROM unit_owners WHERE owner_id = auth.uid()
    UNION
    SELECT unit_id FROM unit_tenant_assignments
    WHERE tenant_id = auth.uid() AND (is_payment_responsible = true OR is_payment_responsible IS NULL)
  )
  SELECT b.* FROM bills b
  WHERE b.unit_id IN (SELECT unit_id FROM my_units)
  ORDER BY b.period_year DESC, b.period_month DESC
  LIMIT lim;
$$;
