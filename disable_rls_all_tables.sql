-- DISABLE RLS ON ALL TABLES TO UNBLOCK DEVELOPMENT
-- Run this in Supabase SQL Editor

ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE buildings DISABLE ROW LEVEL SECURITY;
ALTER TABLE units DISABLE ROW LEVEL SECURITY;
ALTER TABLE unit_owners DISABLE ROW LEVEL SECURITY;
ALTER TABLE unit_tenant_assignments DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE bills DISABLE ROW LEVEL SECURITY;
ALTER TABLE bill_lines DISABLE ROW LEVEL SECURITY;
ALTER TABLE payments DISABLE ROW LEVEL SECURITY;
ALTER TABLE unit_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE service_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE vendors DISABLE ROW LEVEL SECURITY;

-- Also drop all existing policies to clean up
DROP POLICY IF EXISTS "profiles_select_manager" ON profiles;
DROP POLICY IF EXISTS "Manager full access" ON profiles;
DROP POLICY IF EXISTS "Self profile access" ON profiles;
DROP POLICY IF EXISTS "Manager full access" ON buildings;
DROP POLICY IF EXISTS "Manager full access" ON units;
DROP POLICY IF EXISTS "Manager full access" ON services;
DROP POLICY IF EXISTS "Manager full access" ON expenses;
DROP POLICY IF EXISTS "Manager full access" ON unit_types;
DROP POLICY IF EXISTS "Manager full access" ON service_categories;
DROP POLICY IF EXISTS "Manager full access" ON vendors;
DROP POLICY IF EXISTS "Manager full access" ON bills;
DROP POLICY IF EXISTS "Manager full access" ON bill_lines;
DROP POLICY IF EXISTS "Manager full access" ON payments;
DROP POLICY IF EXISTS "Manager full access" ON unit_owners;
DROP POLICY IF EXISTS "Manager full access" ON unit_tenant_assignments;
