-- Part 1 of 2: schema + add enum value 'resident'.
-- Part 2 is 069_unit_memberships_backfill.sql (must run after this is committed).

DO $$ BEGIN
  CREATE TYPE unit_membership_role AS ENUM ('owner', 'tenant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE unit_membership_status AS ENUM ('active', 'pending', 'former');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS unit_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role unit_membership_role NOT NULL,
  status unit_membership_status NOT NULL DEFAULT 'active',
  is_payment_responsible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT unit_memberships_unit_user_key UNIQUE (unit_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_unit_memberships_user ON unit_memberships(user_id);
CREATE INDEX IF NOT EXISTS idx_unit_memberships_unit ON unit_memberships(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_memberships_unit_role ON unit_memberships(unit_id, role) WHERE status = 'active';

-- Add enum label in its own statement (must commit before 069 uses it).
-- Prefer IF NOT EXISTS on Postgres 15+; otherwise use: ALTER TYPE app_role ADD VALUE 'resident';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'resident';
