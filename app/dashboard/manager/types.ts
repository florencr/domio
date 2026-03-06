export type Profile = { id: string; name: string; surname: string; email: string; role: string; phone?: string | null; avatar_url?: string | null };
export type Building = { id: string; name: string; site_id?: string | null };
export type Site = { id: string; name: string; address?: string };
export type Unit = { id: string; unit_name: string; type: string; size_m2: number | null; building_id: string; entrance: string | null; floor: string | null };
export type Service = { id: string; name: string; unit_type: string; pricing_model: string; price_value: number; frequency: string; category?: string | null; site_id?: string | null };
export type Expense = { id: string; title: string; category: string; vendor: string; amount: number; frequency: string; created_at?: string | null; paid_at?: string | null; period_month?: number | null; period_year?: number | null; template_id?: string | null; reference_code?: string | null; site_id?: string | null };
export type UnitType = { id: string; name: string; site_id?: string | null };
export type Vendor = { id: string; name: string; site_id?: string | null };
export type ServiceCategory = { id: string; name: string };
export type Bill = { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; status: string; paid_at: string | null; receipt_url?: string | null; receipt_filename?: string | null; receipt_path?: string | null; reference_code?: string | null };
export type BillLine = { bill_id: string; line_type: string; description: string; amount: number };
export type UnitOwner = { unit_id: string; owner_id: string };
export type UnitTenantAssignment = { unit_id: string; tenant_id: string; is_payment_responsible?: boolean };

export type ManagerData = {
  profile: Profile | null;
  site: Site | null;
  buildings: Building[]; units: Unit[]; services: Service[];
  expenses: Expense[]; profiles: Profile[]; unitTypes: UnitType[];
  vendors: Vendor[]; serviceCategories: ServiceCategory[];
  bills: Bill[]; billLines: BillLine[]; unitOwners: UnitOwner[]; unitTenantAssignments: UnitTenantAssignment[];
};

export const EMPTY: ManagerData = {
  profile: null, site: null, buildings: [], units: [], services: [], expenses: [],
  profiles: [], unitTypes: [], vendors: [], serviceCategories: [],
  bills: [], billLines: [], unitOwners: [], unitTenantAssignments: [],
};

export const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function isPeriodCurrent(periodMonth: number, periodYear: number): boolean {
  const now = new Date();
  return periodMonth === now.getMonth() + 1 && periodYear === now.getFullYear();
}

export function isPeriodEditable(periodMonth: number, periodYear: number): boolean {
  const now = new Date();
  const curM = now.getMonth() + 1, curY = now.getFullYear();
  const prevM = curM === 1 ? 12 : curM - 1, prevY = curM === 1 ? curY - 1 : curY;
  return (periodMonth === curM && periodYear === curY) || (periodMonth === prevM && periodYear === prevY);
}

export function expenseRef(e: { title?: string; category?: string; period_month?: number | null; period_year?: number | null }) {
  const src = e.title || e.category || "EXP";
  const code = src.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 3) || "EXP";
  if (e.period_month != null && e.period_year != null) {
    const mon = MONTHS[e.period_month - 1].slice(0, 3).toUpperCase();
    const yr = String(e.period_year % 100).padStart(2, "0");
    return `EXP-${code}-${mon}${yr}`;
  }
  return `EXP-${code}`;
}

export type ManagerContextValue = {
  data: ManagerData;
  setData: React.Dispatch<React.SetStateAction<ManagerData>>;
  loading: boolean;
  load: () => Promise<void>;
  addBills: (bills: Bill[]) => void;
  addExpense: (expense: Expense) => void;
};
