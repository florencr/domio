"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User, LayoutGrid, Users, Building2, Home, History, Settings, SlidersHorizontal } from "lucide-react";
import { DomioLogo } from "@/components/DomioLogo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { AdminDataProvider, useAdminData, type Profile, type Site, type Building } from "./context";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

const NAV_KEYS = [
  { href: "/dashboard/admin/overview", key: "nav.admin.overview", icon: LayoutGrid },
  { href: "/dashboard/admin/users", key: "nav.admin.users", icon: Users },
  { href: "/dashboard/admin/sites", key: "nav.admin.sites", icon: Building2 },
  { href: "/dashboard/admin/buildings", key: "nav.admin.buildings", icon: Home },
  { href: "/dashboard/admin/audit", key: "nav.admin.audit", icon: History },
  { href: "/dashboard/admin/maintenance", key: "nav.admin.maintenance", icon: Settings },
];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading, load } = useAdminData();
  const { locale } = useLocale();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">{t(locale, "common.loading")}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <Link href="/dashboard/admin" className="flex items-center gap-2">
          <DomioLogo className="h-9 w-auto" />
          <span className="text-xs text-muted-foreground">{t(locale, "admin.administrator")}</span>
        </Link>
        <div className="flex gap-2">
          <Link href="/dashboard/admin/preferences">
            <Button variant="ghost" size="icon" title={t(locale, "common.preferences")}><SlidersHorizontal className="size-5" /></Button>
          </Link>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-9 w-auto md:px-3 md:gap-2">
                <User className="size-5 shrink-0" />
                <span className="hidden md:inline truncate max-w-[140px]">{profile?.name} {profile?.surname}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="p-3 space-y-2">
                <p className="font-semibold">{profile?.name} {profile?.surname}</p>
                <p className="text-sm text-muted-foreground">{t(locale, "common.role")}: {t(locale, "admin.admin")}</p>
                <p className="text-sm text-muted-foreground">{t(locale, "common.site")}: {t(locale, "admin.siteAll")}</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.phone && <p className="text-sm text-muted-foreground"><a href={`tel:${profile.phone.replace(/[\s\-\(\)\.]/g, "")}`} className="text-primary hover:underline">{profile.phone}</a></p>}
              </div>
              <DropdownMenuSeparator />
              <Link href="/dashboard/admin/preferences">
                <DropdownMenuItem className="gap-2 cursor-pointer">
                  <SlidersHorizontal className="size-4" />
                  {t(locale, "common.preferences")}
                </DropdownMenuItem>
              </Link>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="size-4 mr-1" />{t(locale, "common.logout")}</Button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 mb-6">
        {NAV_KEYS.map(({ href, key, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={`flex items-center gap-2 ${isActive ? "bg-muted" : ""}`}
              >
                <Icon className="size-4" />
                {t(locale, key)}
              </Button>
            </Link>
          );
        })}
      </nav>

      {children}
    </div>
  );
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AdminDataProvider>
      <AdminLayoutInner>{children}</AdminLayoutInner>
    </AdminDataProvider>
  );
}
