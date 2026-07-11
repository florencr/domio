-- Energy sharing (building-level solar, net billing): installations, meters, custom unit shares, readings.
-- Phase 1: manual / CSV import; schema ready for inverter / smart-meter API sync.

DO $$ BEGIN
  CREATE TYPE energy_installation_status AS ENUM ('active', 'inactive', 'pending');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE energy_meter_role AS ENUM ('production', 'consumption');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE energy_reading_source AS ENUM ('api', 'manual', 'import');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE energy_period_status AS ENUM ('open', 'closed', 'settled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- One shared solar installation per building (energy community).
CREATE TABLE IF NOT EXISTS energy_installations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL UNIQUE REFERENCES buildings(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Shared solar',
  capacity_kw NUMERIC(10,3),
  status energy_installation_status NOT NULL DEFAULT 'pending',
  inverter_api_provider TEXT,
  inverter_external_id TEXT,
  api_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS energy_meters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  installation_id UUID NOT NULL REFERENCES energy_installations(id) ON DELETE CASCADE,
  unit_id UUID REFERENCES units(id) ON DELETE CASCADE,
  meter_role energy_meter_role NOT NULL,
  label TEXT NOT NULL,
  external_device_id TEXT,
  api_provider TEXT,
  last_sync_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT energy_meter_production_no_unit CHECK (
    (meter_role = 'production' AND unit_id IS NULL)
    OR (meter_role = 'consumption' AND unit_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS energy_meter_production_per_installation
  ON energy_meters(installation_id)
  WHERE meter_role = 'production';

CREATE UNIQUE INDEX IF NOT EXISTS energy_meter_consumption_per_unit
  ON energy_meters(unit_id)
  WHERE meter_role = 'consumption' AND unit_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_energy_meters_building ON energy_meters(building_id);
CREATE INDEX IF NOT EXISTS idx_energy_meters_external ON energy_meters(external_device_id) WHERE external_device_id IS NOT NULL;

-- Custom surplus share % per unit (manager sets once; must sum to 100).
CREATE TABLE IF NOT EXISTS energy_unit_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  share_percent NUMERIC(5,2) NOT NULL
    CHECK (share_percent >= 0 AND share_percent <= 100),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(building_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_energy_unit_shares_building ON energy_unit_shares(building_id);

-- Monthly kWh readings (API, manual, or CSV import).
CREATE TABLE IF NOT EXISTS energy_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id UUID NOT NULL REFERENCES energy_meters(id) ON DELETE CASCADE,
  period_month SMALLINT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year SMALLINT NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  kwh_import NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (kwh_import >= 0),
  kwh_export NUMERIC(14,3) NOT NULL DEFAULT 0 CHECK (kwh_export >= 0),
  source energy_reading_source NOT NULL DEFAULT 'manual',
  raw_payload JSONB,
  notes TEXT,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(meter_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_energy_readings_period ON energy_readings(period_year, period_month);

-- Monthly settlement periods (Phase 2+); included now for schema completeness.
CREATE TABLE IF NOT EXISTS energy_periods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  period_month SMALLINT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year SMALLINT NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  status energy_period_status NOT NULL DEFAULT 'open',
  grid_tariff_eur_per_kwh NUMERIC(10,6),
  total_production_kwh NUMERIC(14,3),
  total_consumption_kwh NUMERIC(14,3),
  surplus_kwh NUMERIC(14,3),
  closed_at TIMESTAMPTZ,
  settled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(building_id, period_month, period_year)
);

CREATE TABLE IF NOT EXISTS energy_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id UUID NOT NULL REFERENCES energy_periods(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  share_percent NUMERIC(5,2) NOT NULL,
  kwh_allocated NUMERIC(14,3) NOT NULL DEFAULT 0,
  credit_amount_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  applied_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(period_id, unit_id)
);

CREATE INDEX IF NOT EXISTS idx_energy_allocations_period ON energy_allocations(period_id);
CREATE INDEX IF NOT EXISTS idx_energy_allocations_unit ON energy_allocations(unit_id);

-- Future bill integration: energy credit line type (Phase 3).
ALTER TABLE bill_lines DROP CONSTRAINT IF EXISTS bill_lines_line_type_check;
ALTER TABLE bill_lines ADD CONSTRAINT bill_lines_line_type_check
  CHECK (line_type IN ('service', 'expense', 'manual', 'energy_credit'));

-- RLS
ALTER TABLE energy_installations ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_meters ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_unit_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_readings ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE energy_allocations ENABLE ROW LEVEL SECURITY;

-- Helper: site for a building
CREATE OR REPLACE FUNCTION energy_building_site_id(p_building_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT site_id FROM buildings WHERE id = p_building_id LIMIT 1;
$$;

-- Manager / admin policies (building-scoped via site)
CREATE POLICY energy_installations_select ON energy_installations FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id())
  );
CREATE POLICY energy_installations_insert ON energy_installations FOR INSERT
  WITH CHECK (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id());
CREATE POLICY energy_installations_update ON energy_installations FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id()));
CREATE POLICY energy_installations_delete ON energy_installations FOR DELETE
  USING (public.is_admin() OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id()));

CREATE POLICY energy_meters_select ON energy_meters FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id())
  );
CREATE POLICY energy_meters_insert ON energy_meters FOR INSERT
  WITH CHECK (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id());
CREATE POLICY energy_meters_update ON energy_meters FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id()));
CREATE POLICY energy_meters_delete ON energy_meters FOR DELETE
  USING (public.is_admin() OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id()));

CREATE POLICY energy_unit_shares_select ON energy_unit_shares FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id())
  );
CREATE POLICY energy_unit_shares_insert ON energy_unit_shares FOR INSERT
  WITH CHECK (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id());
CREATE POLICY energy_unit_shares_update ON energy_unit_shares FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id()));
CREATE POLICY energy_unit_shares_delete ON energy_unit_shares FOR DELETE
  USING (public.is_admin() OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id()));

CREATE POLICY energy_readings_select ON energy_readings FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM energy_meters m
      WHERE m.id = energy_readings.meter_id
        AND energy_building_site_id(m.building_id) = public.my_site_id()
    ))
  );
CREATE POLICY energy_readings_insert ON energy_readings FOR INSERT
  WITH CHECK (
    public.is_manager() AND EXISTS (
      SELECT 1 FROM energy_meters m
      WHERE m.id = energy_readings.meter_id
        AND energy_building_site_id(m.building_id) = public.my_site_id()
    )
  );
CREATE POLICY energy_readings_update ON energy_readings FOR UPDATE
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM energy_meters m
      WHERE m.id = energy_readings.meter_id
        AND energy_building_site_id(m.building_id) = public.my_site_id()
    ))
  );
CREATE POLICY energy_readings_delete ON energy_readings FOR DELETE
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM energy_meters m
      WHERE m.id = energy_readings.meter_id
        AND energy_building_site_id(m.building_id) = public.my_site_id()
    ))
  );

CREATE POLICY energy_periods_select ON energy_periods FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id())
  );
CREATE POLICY energy_periods_insert ON energy_periods FOR INSERT
  WITH CHECK (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id());
CREATE POLICY energy_periods_update ON energy_periods FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id()));

CREATE POLICY energy_allocations_select ON energy_allocations FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_manager() AND EXISTS (
      SELECT 1 FROM energy_periods p
      WHERE p.id = energy_allocations.period_id
        AND energy_building_site_id(p.building_id) = public.my_site_id()
    ))
  );
