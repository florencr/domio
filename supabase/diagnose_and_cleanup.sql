-- Run in Supabase SQL Editor to diagnose and clean up leftover data
-- Run each section separately if needed (comment out others)

-- ========== 1) DIAGNOSE: List all sites ==========
SELECT id, name, manager_id, created_at FROM sites ORDER BY name;

-- ========== 2) DIAGNOSE: Orphaned expenses (site_id points to deleted site) ==========
SELECT e.id, e.title, e.amount, e.site_id, e.created_at
FROM expenses e
LEFT JOIN sites s ON s.id = e.site_id
WHERE s.id IS NULL AND e.site_id IS NOT NULL;

-- ========== 3) DIAGNOSE: All expenses with site name ==========
SELECT e.id, e.title, e.amount, e.paid_at, s.name AS site_name, e.site_id
FROM expenses e
LEFT JOIN sites s ON s.id = e.site_id
ORDER BY s.name NULLS FIRST, e.created_at DESC;

-- ========== 4) CLEANUP: Delete orphaned expenses ==========
-- Run this to remove expenses whose site was deleted
DELETE FROM expenses
WHERE site_id IS NOT NULL
  AND site_id NOT IN (SELECT id FROM sites);

-- ========== 5) CLEANUP: Delete expenses for "sofia" or "Sofia" by name ==========
-- Run if you have expenses still linked to a sofia site_id
UPDATE expenses SET paid_at = NULL WHERE site_id IN (SELECT id FROM sites WHERE name ILIKE '%sofia%');
DELETE FROM expenses WHERE site_id IN (SELECT id FROM sites WHERE name ILIKE '%sofia%');

-- ========== 6) CLEANUP: Remove halisof site (and cascade) ==========
-- Uncomment and run to delete halisof site completely
-- DELETE FROM sites WHERE name ILIKE '%halisof%';
