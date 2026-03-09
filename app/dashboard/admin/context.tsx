"use client";

import { createContext, useContext, ReactNode, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export type Site = { id: string; name: string; address?: string; manager_id: string; created_at?: string; vat_account?: string | null; bank_name?: string | null; iban?: string | null; swift_code?: string | null; tax_amount?: number | null };
export type Profile = { id: string; name: string; surname: string; email: string; role: string; phone?: string | null };
export type Building = { id: string; name: string; address?: string; site_id: string | null; site_name?: string | null; manager_id?: string | null; manager_name?: string | null; owner_names?: string | null };

export type AdminData = {
  profile: Profile | null;
  sites: Site[];
  managers: Profile[];
  buildings: Building[];
  usersBySite: { site_id: string; site_name: string; manager: Profile | null; owners: (Profile & { units: string[] })[]; tenants: (Profile & { units: string[] })[] }[];
  loading: boolean;
  load: () => Promise<void>;
  msg: { text: string; ok: boolean };
  setMsg: (m: { text: string; ok: boolean }) => void;
};

const AdminDataContext = createContext<AdminData | null>(null);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [managers, setManagers] = useState<Profile[]>([]);
  const [buildings, setBuildings] = useState<Building[]>([]);
  const [usersBySite, setUsersBySite] = useState<{ site_id: string; site_name: string; manager: Profile | null; owners: (Profile & { units: string[] })[]; tenants: (Profile & { units: string[] })[] }[]>([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState<{ text: string; ok: boolean }>({ text: "", ok: true });

  const load = useCallback(async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const [profileRes, managersRes, buildingsRes, sitesRes, usersBySiteRes] = await Promise.all([
      sb.from("profiles").select("id,name,surname,email,role,phone").eq("id", user.id).single(),
      fetch("/api/admin/managers").then(r => r.ok ? r.json() : []),
      fetch("/api/admin/buildings").then(r => r.ok ? r.json() : []),
      fetch("/api/admin/sites").then(r => r.ok ? r.json() : []),
      fetch("/api/admin/users-by-site").then(r => r.ok ? r.json() : []),
    ]);

    let p = profileRes.data as Profile | null;
    if (!p) {
      const apiRes = await fetch("/api/profile");
      if (apiRes.ok) p = (await apiRes.json()) as Profile;
    }
    if (p?.role !== "admin") { router.push("/dashboard"); return; }

    setProfile(p);
    setSites((sitesRes ?? []) as Site[]);
    setManagers((managersRes ?? []) as Profile[]);
    setBuildings((buildingsRes ?? []) as Building[]);
    setUsersBySite((usersBySiteRes ?? []) as { site_id: string; site_name: string; manager: Profile | null; owners: (Profile & { units: string[] })[]; tenants: (Profile & { units: string[] })[] }[]);
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  const value: AdminData = {
    profile,
    sites,
    managers,
    buildings,
    usersBySite,
    loading,
    load,
    msg,
    setMsg,
  };

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const ctx = useContext(AdminDataContext);
  if (!ctx) throw new Error("useAdminData must be used within AdminDataProvider");
  return ctx;
}
