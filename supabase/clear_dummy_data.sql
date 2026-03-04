-- Clear all dummy/test data. Keeps: profiles (users).
-- You can run this from Admin Dashboard > Maintenance tab, or run manually here.
-- For manual run: Admin Dashboard > Maintenance > Disable delete locks first, then run this.
-- Order matters: delete from child tables first.

-- 1) Notification-related
DELETE FROM notification_recipients;
DELETE FROM notifications;

-- 2) Push device tokens
DELETE FROM device_tokens;

-- 3) Audit log
DELETE FROM audit_log;

-- 4) Documents (files metadata; storage objects cleared below)
DELETE FROM documents;

-- 5) Invoice reference tracking
DELETE FROM invoice_references;
DELETE FROM invoice_counters;

-- 6) Bills and payments
DELETE FROM bill_lines;
DELETE FROM bills;
DELETE FROM payments;

-- 7) Unit assignments
DELETE FROM unit_tenant_assignments;
DELETE FROM unit_owners;

-- 8) Expenses (templates and records)
DELETE FROM expenses;

-- 9) Services
DELETE FROM services;

-- 10) Units (depends on buildings)
DELETE FROM units;

-- 11) Buildings (depends on sites)
DELETE FROM buildings;

-- 12) Sites (depends on profiles – manager_id)
DELETE FROM sites;

-- 13) Config tables (unit types, vendors, categories)
DELETE FROM unit_types;
DELETE FROM vendors;
DELETE FROM service_categories;

-- 14) Storage: delete document files (optional – uncomment if you want)
-- DELETE FROM storage.objects WHERE bucket_id = 'documents';
