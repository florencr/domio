-- Create missing tables for unit ownership and tenant assignments

-- Unit owners table (many-to-many: units can have multiple owners)
CREATE TABLE IF NOT EXISTS unit_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(unit_id, owner_id)
);

CREATE INDEX IF NOT EXISTS idx_unit_owners_unit ON unit_owners(unit_id);
CREATE INDEX IF NOT EXISTS idx_unit_owners_owner ON unit_owners(owner_id);

-- Unit tenant assignments table
CREATE TABLE IF NOT EXISTS unit_tenant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_payment_responsible BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(unit_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_tenant_assignments_unit ON unit_tenant_assignments(unit_id);
CREATE INDEX IF NOT EXISTS idx_tenant_assignments_tenant ON unit_tenant_assignments(tenant_id);

-- Payments table (already exists but let's ensure it has all columns)
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  period_month INTEGER,
  period_year INTEGER,
  proof_file_url TEXT,
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_unit ON payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_payments_period ON payments(period_year, period_month);

-- Disable RLS on these tables
ALTER TABLE unit_owners DISABLE ROW LEVEL SECURITY;
ALTER TABLE unit_tenant_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
