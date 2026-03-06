"use client";

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { ManagerData, ManagerContextValue, Bill, Expense } from "./types";
import { EMPTY } from "./types";

const ManagerDataContext = createContext<ManagerContextValue | null>(null);

export function ManagerDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<ManagerData>(EMPTY);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const results = await Promise.all([
      sb.from("profiles").select("id,name,surname,email,role,phone,avatar_url").eq("id", user.id).single(),
      sb.from("sites").select("id,name,address").eq("manager_id", user.id).maybeSingle(),
      fetch("/api/manager/buildings").then(r => r.ok ? r.json() : []),
      sb.from("units").select("id,unit_name,type,size_m2,building_id,entrance,floor"),
      sb.from("services").select("id,name,unit_type,pricing_model,price_value,frequency,category,site_id"),
      fetch("/api/manager/expenses", { cache: "no-store" }).then(async r => { if (!r.ok) return []; const j = await r.json(); return Array.isArray(j) ? j : []; }),
      fetch("/api/manager/users").then(r => r.ok ? r.json() : []),
      fetch("/api/manager/unit-types").then(r => r.ok ? r.json() : []),
      fetch("/api/manager/vendors").then(r => r.ok ? r.json() : []),
      fetch("/api/manager/service-categories").then(r => r.ok ? r.json() : []),
      sb.from("bills").select("id,unit_id,period_month,period_year,total_amount,status,paid_at,receipt_url,receipt_filename,receipt_path,reference_code").order("period_year",{ascending:false}).order("period_month",{ascending:false}).limit(200),
      fetch("/api/manager/unit-assignments").then(r => r.ok ? r.json() : { unitOwners: [], unitTenantAssignments: [] }),
    ]);

    let profile = results[0].data as ManagerData["profile"];
    if (!profile) {
      const apiRes = await fetch("/api/profile");
      if (apiRes.ok) profile = (await apiRes.json()) as ManagerData["profile"];
    }
    if (profile?.role !== "manager") { router.push("/dashboard"); return; }

    const site = (results[1].data ?? null) as ManagerData["site"];
    const siteId = site?.id ?? null;
    const buildingsData = (results[2] ?? []) as ManagerData["buildings"];
    const allUnits = (results[3].data ?? []) as ManagerData["units"];
    const allServices = (results[4].data ?? []) as ManagerData["services"];
    const allExpenses = (Array.isArray(results[5]) ? results[5] : []) as ManagerData["expenses"];
    const allUnitTypes = (results[7] ?? []) as ManagerData["unitTypes"];
    const allVendors = (results[8] ?? []) as ManagerData["vendors"];
    const allServiceCategories = (results[9] ?? []) as ManagerData["serviceCategories"];

    const buildings = siteId ? buildingsData.filter((b) => b.site_id === siteId) : buildingsData;
    const buildingIds = new Set(buildings.map((b: { id: string }) => b.id));
    const units = siteId ? allUnits.filter((u: { building_id: string }) => buildingIds.has(u.building_id)) : allUnits;
    const unitIds = new Set(units.map((u: { id: string }) => u.id));
    const assignmentsRes = results[11] as { unitOwners: ManagerData["unitOwners"]; unitTenantAssignments: ManagerData["unitTenantAssignments"] };
    const unitOwnersFiltered = assignmentsRes?.unitOwners ?? [];
    const unitTenantAssignmentsFiltered = assignmentsRes?.unitTenantAssignments ?? [];
    const profiles = (results[6] ?? []) as ManagerData["profiles"];
    const services = siteId ? allServices.filter((s) => !(s as { site_id?: string | null }).site_id || (s as { site_id?: string | null }).site_id === siteId) : allServices;
    const expenses = siteId ? allExpenses.filter((e) => !(e as { site_id?: string | null }).site_id || (e as { site_id?: string | null }).site_id === siteId) : allExpenses;
    const unitTypes = siteId ? allUnitTypes.filter((ut) => !(ut as { site_id?: string | null }).site_id || (ut as { site_id?: string | null }).site_id === siteId) : allUnitTypes;
    const vendors = siteId ? allVendors.filter((v) => !(v as { site_id?: string | null }).site_id || (v as { site_id?: string | null }).site_id === siteId) : allVendors;
    const serviceCategories = allServiceCategories;

    const bills = siteId ? (results[10].data ?? []).filter((b: { unit_id: string }) => unitIds.has(b.unit_id)) as Bill[] : (results[10].data ?? []) as Bill[];
    const billIds = bills.map((b: { id: string }) => b.id);
    let billLines: ManagerData["billLines"] = [];
    if (billIds.length > 0) {
      const { data: linesData } = await sb.from("bill_lines").select("bill_id, line_type, description, amount").in("bill_id", billIds);
      billLines = (linesData ?? []) as ManagerData["billLines"];
    }

    setData({
      profile,
      site,
      buildings,
      units,
      services,
      expenses,
      profiles,
      unitTypes,
      vendors,
      serviceCategories,
      bills,
      billLines,
      unitOwners: unitOwnersFiltered,
      unitTenantAssignments: unitTenantAssignmentsFiltered,
    });
    } catch (err) {
      console.error("Manager load error:", err);
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const addBills = useCallback((newBills: Bill[]) => {
    setData(prev => ({ ...prev, bills: [...(prev.bills || []), ...newBills] }));
  }, []);

  const addExpense = useCallback((expense: Expense) => {
    setData(prev => ({ ...prev, expenses: [...(prev.expenses || []), expense] }));
  }, []);

  const value: ManagerContextValue = {
    data,
    setData,
    loading,
    load,
    addBills,
    addExpense,
  };

  return <ManagerDataContext.Provider value={value}>{children}</ManagerDataContext.Provider>;
}

export function useManagerData() {
  const ctx = useContext(ManagerDataContext);
  if (!ctx) throw new Error("useManagerData must be used within ManagerDataProvider");
  return ctx;
}
