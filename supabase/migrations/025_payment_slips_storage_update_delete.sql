-- Upsert needs UPDATE and DELETE (upload uses upsert: true)
DROP POLICY IF EXISTS "payment_slips_update_authenticated" ON storage.objects;
CREATE POLICY "payment_slips_update_authenticated"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'payment-slips');

DROP POLICY IF EXISTS "payment_slips_delete_authenticated" ON storage.objects;
CREATE POLICY "payment_slips_delete_authenticated"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'payment-slips');
