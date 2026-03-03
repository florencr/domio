-- Move address from building level to site level

-- 1) Add address to sites
ALTER TABLE sites ADD COLUMN IF NOT EXISTS address TEXT;

-- 2) Backfill: copy address from first building in each site to the site
UPDATE sites s SET address = (
  SELECT b.address FROM buildings b WHERE b.site_id = s.id AND b.address IS NOT NULL AND b.address != '' LIMIT 1
) WHERE s.address IS NULL OR s.address = '';

-- 3) For sites with no buildings, set empty string
UPDATE sites SET address = '' WHERE address IS NULL;

-- 4) Make address NOT NULL with default (for new sites)
ALTER TABLE sites ALTER COLUMN address SET DEFAULT '';
ALTER TABLE sites ALTER COLUMN address SET NOT NULL;

-- 5) Drop address from buildings
ALTER TABLE buildings DROP COLUMN IF EXISTS address;
