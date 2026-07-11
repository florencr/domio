-- SaaS addon: energy sharing module enabled per site (customer / residential complex).

ALTER TABLE sites ADD COLUMN IF NOT EXISTS energy_addon_enabled BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_sites_energy_addon ON sites(energy_addon_enabled) WHERE energy_addon_enabled = true;

COMMENT ON COLUMN sites.energy_addon_enabled IS 'When true, manager and residents for this site see the Energy module.';
