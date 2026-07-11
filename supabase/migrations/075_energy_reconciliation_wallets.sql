-- Step 2: community meter constraints, reconciliation columns, virtual wallet ledger.
-- Run after 074 (enum value 'community' must be committed first).

ALTER TABLE energy_meters DROP CONSTRAINT IF EXISTS energy_meter_production_no_unit;
ALTER TABLE energy_meters ADD CONSTRAINT energy_meter_role_unit CHECK (
  (meter_role = 'production' AND unit_id IS NULL)
  OR (meter_role = 'community' AND unit_id IS NULL)
  OR (meter_role = 'consumption' AND unit_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS energy_meter_community_per_building
  ON energy_meters(building_id)
  WHERE meter_role = 'community';

ALTER TABLE energy_periods
  ADD COLUMN IF NOT EXISTS grid_import_kwh NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS grid_export_kwh NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS expected_grid_import_kwh NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS expected_grid_export_kwh NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS reconciliation_delta_kwh NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS reconciliation_ok BOOLEAN;

ALTER TABLE energy_allocations
  ADD COLUMN IF NOT EXISTS kwh_meter_consumption NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS kwh_from_solar NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS kwh_from_grid NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS kwh_supplier_net NUMERIC(14,3);

CREATE TABLE IF NOT EXISTS energy_wallet_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
  unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  period_id UUID REFERENCES energy_periods(id) ON DELETE SET NULL,
  period_month SMALLINT NOT NULL CHECK (period_month >= 1 AND period_month <= 12),
  period_year SMALLINT NOT NULL CHECK (period_year >= 2000 AND period_year <= 2100),
  kwh_meter_total NUMERIC(14,3) NOT NULL DEFAULT 0,
  kwh_from_solar NUMERIC(14,3) NOT NULL DEFAULT 0,
  kwh_from_grid NUMERIC(14,3) NOT NULL DEFAULT 0,
  credit_earned_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  credit_applied_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  wallet_balance_eur NUMERIC(12,2) NOT NULL DEFAULT 0,
  applied_bill_id UUID REFERENCES bills(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(building_id, unit_id, period_month, period_year)
);

CREATE INDEX IF NOT EXISTS idx_energy_wallet_ledger_unit ON energy_wallet_ledger(unit_id);
CREATE INDEX IF NOT EXISTS idx_energy_wallet_ledger_period ON energy_wallet_ledger(period_year, period_month);

ALTER TABLE energy_wallet_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY energy_wallet_ledger_select ON energy_wallet_ledger FOR SELECT
  USING (
    public.is_admin()
    OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id())
  );
CREATE POLICY energy_wallet_ledger_insert ON energy_wallet_ledger FOR INSERT
  WITH CHECK (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id());
CREATE POLICY energy_wallet_ledger_update ON energy_wallet_ledger FOR UPDATE
  USING (public.is_admin() OR (public.is_manager() AND energy_building_site_id(building_id) = public.my_site_id()));
