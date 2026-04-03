-- Part 2 of 2: run ONLY after 068 (or after ALTER TYPE added 'resident').
-- If you see "invalid input value for enum app_role: resident", run this alone first, then re-run from UPDATE:
--   ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'resident';

UPDATE profiles SET role = 'resident'::app_role WHERE role::text IN ('owner', 'tenant');

INSERT INTO unit_memberships (unit_id, user_id, role, status, is_payment_responsible)
SELECT unit_id, owner_id, 'owner'::unit_membership_role, 'active'::unit_membership_status, false
FROM unit_owners
ON CONFLICT (unit_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  is_payment_responsible = false,
  updated_at = now();

INSERT INTO unit_memberships (unit_id, user_id, role, status, is_payment_responsible)
SELECT unit_id, tenant_id, 'tenant'::unit_membership_role, 'active'::unit_membership_status, COALESCE(is_payment_responsible, true)
FROM unit_tenant_assignments
ON CONFLICT (unit_id, user_id) DO UPDATE SET
  role = EXCLUDED.role,
  status = EXCLUDED.status,
  is_payment_responsible = EXCLUDED.is_payment_responsible,
  updated_at = now();

ALTER TABLE unit_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unit_memberships_select_self" ON unit_memberships;
CREATE POLICY "unit_memberships_select_self"
  ON unit_memberships FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
