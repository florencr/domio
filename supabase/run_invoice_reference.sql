-- Run in Supabase SQL Editor to add unique invoice references (site + sequential number)
-- Format: INV-SITECODE-May26-0001

CREATE TABLE IF NOT EXISTS invoice_counters (
  site_id UUID PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE,
  last_number INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoice_references (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,
  period_month INT NOT NULL,
  period_year INT NOT NULL,
  payment_responsible_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reference_code TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(site_id, period_month, period_year, payment_responsible_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_refs_lookup ON invoice_references(site_id, period_month, period_year, payment_responsible_id);

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_site_id UUID)
RETURNS INT LANGUAGE plpgsql AS $$
DECLARE v_next INT;
BEGIN
  INSERT INTO invoice_counters (site_id, last_number) VALUES (p_site_id, 1)
  ON CONFLICT (site_id) DO UPDATE SET last_number = invoice_counters.last_number + 1
  RETURNING last_number INTO v_next;
  RETURN v_next;
END;
$$;

ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_references ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "invoice_counters_service" ON invoice_counters;
DROP POLICY IF EXISTS "invoice_references_select_admin" ON invoice_references;
DROP POLICY IF EXISTS "invoice_references_select_manager" ON invoice_references;
DROP POLICY IF EXISTS "invoice_references_insert_service" ON invoice_references;
CREATE POLICY "invoice_counters_service" ON invoice_counters FOR ALL USING (false);
CREATE POLICY "invoice_references_select_admin" ON invoice_references FOR SELECT USING (public.is_admin());
CREATE POLICY "invoice_references_select_manager" ON invoice_references FOR SELECT USING (site_id = public.my_site_id());
CREATE POLICY "invoice_references_insert_service" ON invoice_references FOR INSERT WITH CHECK (false);
