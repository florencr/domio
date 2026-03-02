-- Create payment-slips bucket for owner/tenant slip uploads
-- If this fails, create manually in Supabase Dashboard: Storage → New bucket → name: payment-slips

INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-slips', 'payment-slips', false)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload and read slips
DROP POLICY IF EXISTS "payment_slips_upload_authenticated" ON storage.objects;
CREATE POLICY "payment_slips_upload_authenticated"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'payment-slips');

DROP POLICY IF EXISTS "payment_slips_select_authenticated" ON storage.objects;
CREATE POLICY "payment_slips_select_authenticated"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'payment-slips');
