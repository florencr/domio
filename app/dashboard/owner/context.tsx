"use client";

import { createContext, useContext, ReactNode, useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
export type OwnerData = {
  profile: { id: string; name: string; surname: string; email: string; role: string; phone?: string | null } | null;
  siteNames: string[];
  units: { id: string; unit_name: string; type: string; size_m2: number | null; building_id: string; entrance?: string | null; floor?: string | null }[];
  allUnits: { id: string; unit_name: string }[];
  buildings: { id: string; name: string; site_id?: string | null }[];
  bills: { id: string; unit_id: string; period_month: number; period_year: number; total_amount: number; status: string; paid_at: string | null; receipt_url?: string | null; receipt_filename?: string | null; receipt_path?: string | null; reference_code?: string }[];
  expenses: { id: string; title: string; vendor: string; amount: number; period_month: number | null; period_year: number | null }[];
  unitTenantAssignments: { unit_id: string; tenant_id: string; is_payment_responsible?: boolean }[];
  tenants: { id: string; name: string; surname: string; email: string }[];
};

type UploadTarget = { billId?: string; periodMonth?: number; periodYear?: number; paymentResponsibleId?: string };

const OwnerDataContext = createContext<{
  data: OwnerData;
  loading: boolean;
  load: () => Promise<void>;
  uploadingFor: string | null;
  uploadError: string | null;
  setUploadError: (e: string | null) => void;
  triggerFileInput: (target: UploadTarget) => void;
  assignTenant: (unitId: string, tenantId: string, isPaymentResponsible?: boolean) => Promise<{ ok: boolean; error?: string }>;
  removeTenant: (unitId: string, tenantId: string) => Promise<void>;
  setPaymentResponsible: (unitId: string, tenantId: string, isPaymentResponsible: boolean) => Promise<void>;
} | null>(null);

export function OwnerDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [data, setData] = useState<OwnerData>({
    profile: null, siteNames: [], units: [], allUnits: [], buildings: [],
    bills: [], expenses: [], unitTenantAssignments: [], tenants: [],
  });
  const [loading, setLoading] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadTargetRef = useRef<UploadTarget>({});

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const res = await fetch("/api/owner/data", { cache: "no-store" });
    if (!res.ok) { setLoading(false); return; }

    const json = await res.json().catch(() => ({}));
    let profile = json.profile ?? null;
    if (!profile) {
      const apiRes = await fetch("/api/profile");
      if (apiRes.ok) profile = (await apiRes.json()) as OwnerData["profile"];
    }

    setData({
      profile: profile ?? null,
      siteNames: json.siteNames ?? [],
      units: json.units ?? [],
      allUnits: json.allUnits ?? [],
      buildings: json.buildings ?? [],
      bills: json.bills ?? [],
      expenses: json.expenses ?? [],
      unitTenantAssignments: json.unitTenantAssignments ?? [],
      tenants: json.tenants ?? [],
    });
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const uploadSlip = useCallback(async (target: UploadTarget, file: File) => {
    const key = target.billId ?? `${target.periodMonth}-${target.periodYear}`;
    setUploadingFor(key);
    setUploadError(null);
    const sb = createClient();
    const ext = file.name.split(".").pop() || "jpg";
    const { data: { user } } = await sb.auth.getUser();
    let userId = data.profile?.id ?? user?.id ?? "x";
    const payer = target.paymentResponsibleId ?? userId;
    const path = target.periodMonth != null ? `payer-${payer}/${target.periodYear}-${String(target.periodMonth).padStart(2, "0")}.${ext}` : `${target.billId}.${ext}`;
    const { error: upErr } = await sb.storage.from("payment-slips").upload(path, file, { upsert: true });
    if (!upErr) {
      const body = target.periodMonth != null
        ? { periodMonth: target.periodMonth, periodYear: target.periodYear, paymentResponsibleId: target.paymentResponsibleId, receipt_path: path, receipt_filename: file.name }
        : { billId: target.billId, receipt_path: path, receipt_filename: file.name };
      const res = await fetch("/api/receipt-record", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      if (res.ok) load();
      else { const err = await res.json().catch(() => ({})); setUploadError(err.error || "Could not record slip."); }
    } else setUploadError(upErr.message || "Upload failed.");
    setUploadingFor(null);
  }, [data.profile?.id, load]);

  const triggerFileInput = useCallback((target: UploadTarget) => {
    uploadTargetRef.current = target;
    fileInputRef.current?.click();
  }, []);

  const assignTenant = useCallback(async (unitId: string, tenantId: string, isPaymentResponsible: boolean = true) => {
    const res = await fetch("/api/owner/tenant-assignment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId, tenantId, isPaymentResponsible }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) {
      await load();
      return { ok: true };
    }
    return { ok: false, error: json.error || "Failed to assign tenant" };
  }, [load]);

  const removeTenant = useCallback(async (unitId: string, tenantId: string) => {
    const res = await fetch(`/api/owner/tenant-assignment?unitId=${encodeURIComponent(unitId)}&tenantId=${encodeURIComponent(tenantId)}`, { method: "DELETE" });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) await load();
  }, [load]);

  const setPaymentResponsible = useCallback(async (unitId: string, tenantId: string, isPaymentResponsible: boolean) => {
    const res = await fetch("/api/owner/tenant-assignment", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ unitId, tenantId, isPaymentResponsible }),
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.success) await load();
  }, [load]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    const t = uploadTargetRef.current;
    if (f && (t.billId || (t.periodMonth != null && t.periodYear != null))) uploadSlip(t, f);
    e.target.value = "";
  }, [uploadSlip]);

  const value = {
    data,
    loading,
    load,
    uploadingFor,
    uploadError,
    setUploadError,
    triggerFileInput,
    assignTenant,
    removeTenant,
    setPaymentResponsible,
  };

  return (
    <OwnerDataContext.Provider value={value}>
      <input type="file" ref={fileInputRef} accept="image/*,.pdf" className="hidden" onChange={handleFileChange} />
      {children}
    </OwnerDataContext.Provider>
  );
}

export function useOwnerData() {
  const ctx = useContext(OwnerDataContext);
  if (!ctx) throw new Error("useOwnerData must be used within OwnerDataProvider");
  return ctx;
}
