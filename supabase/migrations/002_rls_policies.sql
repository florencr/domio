-- RLS policies for Domio
-- Run after 001_initial_schema.sql

-- Profiles: users can read and update their own row; can insert their own row (for signup)
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- Managers see all profiles (for dropdowns, etc.)
CREATE POLICY "profiles_select_manager"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.role = 'manager'
    )
  );

-- Buildings: manager can do everything; owners/tenants can only read (for transparency)
CREATE POLICY "buildings_select_all"
  ON buildings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "buildings_insert_manager"
  ON buildings FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "buildings_update_manager"
  ON buildings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "buildings_delete_manager"
  ON buildings FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Units: manager full access; owner sees units they own; tenant sees units they are assigned to
CREATE POLICY "units_select_manager"
  ON units FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "units_select_owner"
  ON units FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM unit_owners WHERE unit_id = units.id AND owner_id = auth.uid())
  );

CREATE POLICY "units_select_tenant"
  ON units FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM unit_tenant_assignments WHERE unit_id = units.id AND tenant_id = auth.uid())
  );

CREATE POLICY "units_insert_manager"
  ON units FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "units_update_manager"
  ON units FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "units_delete_manager"
  ON units FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Unit owners: manager full; owner sees own assignments
CREATE POLICY "unit_owners_select_manager"
  ON unit_owners FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "unit_owners_select_owner"
  ON unit_owners FOR SELECT
  USING (owner_id = auth.uid());

CREATE POLICY "unit_owners_insert_manager"
  ON unit_owners FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "unit_owners_update_manager"
  ON unit_owners FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "unit_owners_delete_manager"
  ON unit_owners FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Unit tenant assignments: manager full; owner can manage for their units
CREATE POLICY "unit_tenant_assignments_select_manager"
  ON unit_tenant_assignments FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "unit_tenant_assignments_select_owner"
  ON unit_tenant_assignments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM unit_owners WHERE unit_id = unit_tenant_assignments.unit_id AND owner_id = auth.uid())
  );

CREATE POLICY "unit_tenant_assignments_select_tenant"
  ON unit_tenant_assignments FOR SELECT
  USING (tenant_id = auth.uid());

CREATE POLICY "unit_tenant_assignments_insert_manager"
  ON unit_tenant_assignments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "unit_tenant_assignments_insert_owner"
  ON unit_tenant_assignments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM unit_owners WHERE unit_id = unit_tenant_assignments.unit_id AND owner_id = auth.uid())
  );

CREATE POLICY "unit_tenant_assignments_update_manager"
  ON unit_tenant_assignments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "unit_tenant_assignments_update_owner"
  ON unit_tenant_assignments FOR UPDATE
  USING (
    EXISTS (SELECT 1 FROM unit_owners WHERE unit_id = unit_tenant_assignments.unit_id AND owner_id = auth.uid())
  );

CREATE POLICY "unit_tenant_assignments_delete_manager"
  ON unit_tenant_assignments FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "unit_tenant_assignments_delete_owner"
  ON unit_tenant_assignments FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM unit_owners WHERE unit_id = unit_tenant_assignments.unit_id AND owner_id = auth.uid())
  );

-- Services: manager manages; all authenticated read (for billing)
CREATE POLICY "services_select_authenticated"
  ON services FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "services_insert_manager"
  ON services FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "services_update_manager"
  ON services FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "services_delete_manager"
  ON services FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Expenses: manager manages; all authenticated read
CREATE POLICY "expenses_select_authenticated"
  ON expenses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "expenses_insert_manager"
  ON expenses FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "expenses_update_manager"
  ON expenses FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "expenses_delete_manager"
  ON expenses FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Bills: manager full; owner sees bills for their units; tenant sees bills for units they are payment responsible for
CREATE POLICY "bills_select_manager"
  ON bills FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "bills_select_owner"
  ON bills FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM unit_owners WHERE unit_id = bills.unit_id AND owner_id = auth.uid())
  );

CREATE POLICY "bills_select_tenant"
  ON bills FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM unit_tenant_assignments a
      WHERE a.unit_id = bills.unit_id AND a.tenant_id = auth.uid() AND a.is_payment_responsible = true
    )
  );

CREATE POLICY "bills_insert_manager"
  ON bills FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "bills_update_manager"
  ON bills FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "bills_delete_manager"
  ON bills FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Bill lines: same as bills (tied to bill)
CREATE POLICY "bill_lines_select_manager"
  ON bill_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN profiles p ON p.id = auth.uid() AND p.role = 'manager'
      WHERE b.id = bill_lines.bill_id
    )
  );

CREATE POLICY "bill_lines_select_owner"
  ON bill_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN unit_owners uo ON uo.unit_id = b.unit_id AND uo.owner_id = auth.uid()
      WHERE b.id = bill_lines.bill_id
    )
  );

CREATE POLICY "bill_lines_select_tenant"
  ON bill_lines FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM bills b
      JOIN unit_tenant_assignments a ON a.unit_id = b.unit_id AND a.tenant_id = auth.uid() AND a.is_payment_responsible = true
      WHERE b.id = bill_lines.bill_id
    )
  );

CREATE POLICY "bill_lines_insert_manager"
  ON bill_lines FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager')
  );

CREATE POLICY "bill_lines_update_manager"
  ON bill_lines FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "bill_lines_delete_manager"
  ON bill_lines FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

-- Payments: manager full; owner sees payments for their units; tenant sees for assigned units they are responsible for
CREATE POLICY "payments_select_manager"
  ON payments FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "payments_select_owner"
  ON payments FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM unit_owners WHERE unit_id = payments.unit_id AND owner_id = auth.uid())
  );

CREATE POLICY "payments_select_tenant"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM unit_tenant_assignments a
      WHERE a.unit_id = payments.unit_id AND a.tenant_id = auth.uid() AND a.is_payment_responsible = true
    )
  );

CREATE POLICY "payments_insert_manager"
  ON payments FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "payments_insert_owner"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM unit_owners WHERE unit_id = payments.unit_id AND owner_id = auth.uid())
  );

CREATE POLICY "payments_insert_tenant"
  ON payments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM unit_tenant_assignments a
      WHERE a.unit_id = payments.unit_id AND a.tenant_id = auth.uid() AND a.is_payment_responsible = true
    )
  );

CREATE POLICY "payments_update_manager"
  ON payments FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));

CREATE POLICY "payments_delete_manager"
  ON payments FOR DELETE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'manager'));
