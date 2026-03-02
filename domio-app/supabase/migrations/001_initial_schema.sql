-- Domio HOA: initial schema (idempotent – safe to run more than once)
-- Run this in Supabase SQL Editor or via supabase db push

-- Types: create only if they don't exist
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('manager', 'owner', 'tenant');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE unit_type AS ENUM ('apartment', 'villa', 'parking', 'garden', 'patio');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE pricing_model AS ENUM ('per_m2', 'fixed_per_unit');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_frequency AS ENUM ('recurrent', 'one_time', 'ad_hoc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE expense_frequency AS ENUM ('recurrent', 'ad_hoc');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Profiles: extends auth.users with name, surname, phone, role
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  surname TEXT NOT NULL,
  phone TEXT,
  email TEXT NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Buildings
CREATE TABLE IF NOT EXISTS buildings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Units: belong to a building
CREATE TABLE IF NOT EXISTS units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  unit_name TEXT NOT NULL,
  type unit_type NOT NULL,
  size_m2 NUMERIC(10,2),
  block TEXT,
  entrance TEXT,
  floor TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Unit owner: each unit has one owner
CREATE TABLE IF NOT EXISTS unit_owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id)
);

-- Tenant assignment: owner assigns a tenant to a unit; is_payment_responsible flag
CREATE TABLE IF NOT EXISTS unit_tenant_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_payment_responsible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id)
);

-- Services: linked to unit type; pricing and frequency
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  unit_type unit_type NOT NULL,
  pricing_model pricing_model NOT NULL,
  price_value NUMERIC(12,2) NOT NULL,
  frequency service_frequency NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Expenses: category, vendor, frequency
CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  vendor TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  frequency expense_frequency NOT NULL,
  building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Bills: one per unit per period (month/year)
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  period_month SMALLINT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year SMALLINT NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'reversed')),
  generated_at TIMESTAMPTZ DEFAULT now(),
  reversed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unit_id, period_month, period_year)
);

-- Bill lines: services/expenses/manual overrides per bill
CREATE TABLE IF NOT EXISTS bill_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id UUID NOT NULL REFERENCES bills(id) ON DELETE CASCADE,
  line_type TEXT NOT NULL CHECK (line_type IN ('service', 'expense', 'manual')),
  reference_id UUID,
  description TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Payments: recorded per unit (with optional period); proof for top-up flow
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  paid_at DATE NOT NULL,
  period_month SMALLINT CHECK (period_month >= 1 AND period_month <= 12),
  period_year SMALLINT,
  proof_file_url TEXT,
  proof_storage_path TEXT,
  recorded_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- RLS: enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_owners ENABLE ROW LEVEL SECURITY;
ALTER TABLE unit_tenant_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE bill_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Fix: add columns if tables existed from an older run without them
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS name TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS surname TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS role app_role NOT NULL DEFAULT 'owner'::app_role;
ALTER TABLE units ADD COLUMN IF NOT EXISTS "type" unit_type NOT NULL DEFAULT 'apartment'::unit_type;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS frequency expense_frequency NOT NULL DEFAULT 'recurrent'::expense_frequency;
ALTER TABLE services ADD COLUMN IF NOT EXISTS frequency service_frequency NOT NULL DEFAULT 'recurrent'::service_frequency;
ALTER TABLE services ADD COLUMN IF NOT EXISTS unit_type unit_type NOT NULL DEFAULT 'apartment'::unit_type;
ALTER TABLE services ADD COLUMN IF NOT EXISTS pricing_model pricing_model NOT NULL DEFAULT 'fixed_per_unit'::pricing_model;
ALTER TABLE services ADD COLUMN IF NOT EXISTS price_value NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_units_building ON units(building_id);
CREATE INDEX IF NOT EXISTS idx_units_type ON units("type");
CREATE INDEX IF NOT EXISTS idx_unit_owners_owner ON unit_owners(owner_id);
CREATE INDEX IF NOT EXISTS idx_unit_tenant_assignments_tenant ON unit_tenant_assignments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bills_unit_period ON bills(unit_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_bills_period ON bills(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_payments_unit ON payments(unit_id);
CREATE INDEX IF NOT EXISTS idx_payments_paid_at ON payments(paid_at);
CREATE INDEX IF NOT EXISTS idx_expenses_frequency ON expenses(frequency);
CREATE INDEX IF NOT EXISTS idx_services_unit_type ON services(unit_type);
