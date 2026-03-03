-- SaaS: Add sites table and scope data per manager
-- Phase 1: Schema + backfill. Run in Supabase SQL Editor.

-- 1) Add 'admin' to app_role enum
DO $$ BEGIN
  ALTER TYPE app_role ADD VALUE 'admin';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2) Create sites table (one site per manager)
CREATE TABLE IF NOT EXISTS sites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  manager_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(manager_id)
);

CREATE INDEX IF NOT EXISTS idx_sites_manager ON sites(manager_id);

-- 3) Add site_id to buildings
ALTER TABLE buildings ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;

-- 4) Add site_id to config tables (unit_types, vendors, service_categories, services, expenses)
ALTER TABLE unit_types ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE service_categories ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE services ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;
ALTER TABLE expenses ADD COLUMN IF NOT EXISTS site_id UUID REFERENCES sites(id) ON DELETE CASCADE;

-- 5) Backfill: create default site for first manager, link all data to it
DO $$
DECLARE
  v_site_id UUID;
  v_manager_id UUID;
BEGIN
  -- Get first manager
  SELECT id INTO v_manager_id FROM profiles WHERE role = 'manager' LIMIT 1;
  IF v_manager_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Create site for that manager
  INSERT INTO sites (name, manager_id) VALUES ('Default Site', v_manager_id)
  ON CONFLICT (manager_id) DO NOTHING;
  SELECT id INTO v_site_id FROM sites WHERE manager_id = v_manager_id LIMIT 1;
  IF v_site_id IS NULL THEN RETURN; END IF;
  
  -- Link buildings (all existing buildings get this site)
  UPDATE buildings SET site_id = v_site_id WHERE site_id IS NULL;
  
  -- Link config tables
  UPDATE unit_types SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE vendors SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE service_categories SET site_id = v_site_id WHERE site_id IS NULL;
  UPDATE services SET site_id = v_site_id WHERE site_id IS NULL;
  
  -- Expenses: link to site (via first building if has building_id, else default site)
  UPDATE expenses e SET site_id = COALESCE(
    (SELECT b.site_id FROM buildings b WHERE b.id = e.building_id LIMIT 1),
    v_site_id
  ) WHERE e.site_id IS NULL;
  UPDATE expenses SET site_id = v_site_id WHERE site_id IS NULL;
END $$;

-- 6) Create sites for any other managers who don't have one yet
INSERT INTO sites (name, manager_id)
SELECT 'Site: ' || p.name || ' ' || p.surname, p.id
FROM profiles p
WHERE p.role = 'manager'
  AND NOT EXISTS (SELECT 1 FROM sites s WHERE s.manager_id = p.id);
