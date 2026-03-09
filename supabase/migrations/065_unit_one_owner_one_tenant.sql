-- Enforce one owner and one tenant per unit.
-- If duplicates exist, keep the first (by id) and delete others.
-- Then ensure UNIQUE(unit_id) constraint.

-- unit_owners: keep one row per unit_id (smallest id wins)
DELETE FROM unit_owners a
USING unit_owners b
WHERE a.unit_id = b.unit_id AND a.id > b.id;

-- unit_tenant_assignments: keep one row per unit_id
DELETE FROM unit_tenant_assignments a
USING unit_tenant_assignments b
WHERE a.unit_id = b.unit_id AND a.id > b.id;

-- Drop UNIQUE(unit_id, owner_id) if it exists (allows multiple owners per unit)
ALTER TABLE unit_owners DROP CONSTRAINT IF EXISTS unit_owners_unit_id_owner_id_key;

-- Add UNIQUE(unit_id) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unit_owners_unit_id_key' AND conrelid = 'unit_owners'::regclass
  ) THEN
    ALTER TABLE unit_owners ADD CONSTRAINT unit_owners_unit_id_key UNIQUE (unit_id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'unit_owners constraint may already exist or table structure differs: %', SQLERRM;
END $$;

-- Drop UNIQUE(unit_id, tenant_id) if it exists
ALTER TABLE unit_tenant_assignments DROP CONSTRAINT IF EXISTS unit_tenant_assignments_unit_id_tenant_id_key;

-- Add UNIQUE(unit_id) if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unit_tenant_assignments_unit_id_key' AND conrelid = 'unit_tenant_assignments'::regclass
  ) THEN
    ALTER TABLE unit_tenant_assignments ADD CONSTRAINT unit_tenant_assignments_unit_id_key UNIQUE (unit_id);
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'unit_tenant_assignments constraint may already exist or table structure differs: %', SQLERRM;
END $$;
