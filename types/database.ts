/**
 * Domio HOA – database types (match Supabase schema)
 */

export type AppRole = "admin" | "manager" | "owner" | "tenant";

export type UnitType = "apartment" | "villa" | "parking" | "garden" | "patio";

export type PricingModel = "per_m2" | "fixed_per_unit";

export type ServiceFrequency = "recurrent" | "one_time" | "ad_hoc";

export type ExpenseFrequency = "recurrent" | "ad_hoc";

export type BillStatus = "draft" | "published" | "reversed";

export type BillLineType = "service" | "expense" | "manual";

export interface Profile {
  id: string;
  name: string;
  surname: string;
  phone: string | null;
  email: string;
  role: AppRole;
  created_at: string;
  updated_at: string;
}

export interface Site {
  id: string;
  name: string;
  address: string;
  manager_id: string;
  created_at: string;
}

export interface Building {
  id: string;
  name: string;
  site_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Unit {
  id: string;
  building_id: string;
  unit_name: string;
  type: UnitType;
  size_m2: number | null;
  block: string | null;
  entrance: string | null;
  floor: string | null;
  created_at: string;
  updated_at: string;
}

export interface UnitOwner {
  id: string;
  unit_id: string;
  owner_id: string;
  created_at: string;
}

export interface UnitTenantAssignment {
  id: string;
  unit_id: string;
  tenant_id: string;
  is_payment_responsible: boolean;
  created_at: string;
  updated_at: string;
}

export interface Service {
  id: string;
  name: string;
  unit_type: UnitType;
  pricing_model: PricingModel;
  price_value: number;
  frequency: ServiceFrequency;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  category: string;
  vendor: string;
  amount: number;
  frequency: ExpenseFrequency;
  building_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface Bill {
  id: string;
  unit_id: string;
  period_month: number;
  period_year: number;
  total_amount: number;
  status: BillStatus;
  generated_at: string | null;
  reversed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillLine {
  id: string;
  bill_id: string;
  line_type: BillLineType;
  reference_id: string | null;
  description: string;
  amount: number;
  created_at: string;
}

export interface Payment {
  id: string;
  unit_id: string;
  amount: number;
  paid_at: string;
  period_month: number | null;
  period_year: number | null;
  proof_file_url: string | null;
  proof_storage_path: string | null;
  recorded_by: string | null;
  created_at: string;
  updated_at: string;
}

/** Extended types with relations (for UI) */
export interface UnitWithBuilding extends Unit {
  building?: Building;
}

export interface UnitWithOwnerAndTenant extends Unit {
  owner?: Profile;
  tenant_assignment?: UnitTenantAssignment & { tenant?: Profile };
}

export interface BillWithLines extends Bill {
  bill_lines?: BillLine[];
}

export interface BillWithUnit extends Bill {
  unit?: Unit;
}
