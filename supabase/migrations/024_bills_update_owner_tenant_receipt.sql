-- Allow owners to update receipt fields on bills for their units
CREATE POLICY "bills_update_owner"
  ON bills FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM unit_owners WHERE unit_id = bills.unit_id AND owner_id = auth.uid())
  );

-- Allow tenants to update receipt fields on bills for units they're payment responsible for
CREATE POLICY "bills_update_tenant"
  ON bills FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM unit_tenant_assignments a
      WHERE a.unit_id = bills.unit_id AND a.tenant_id = auth.uid() AND a.is_payment_responsible = true
    )
  );
