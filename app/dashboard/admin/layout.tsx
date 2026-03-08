"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut, User, LayoutGrid, Users, UserCog, Building2, Home, History, Settings } from "lucide-react";
import { DomioLogo } from "@/components/DomioLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AdminDataProvider, useAdminData, type Profile, type Site, type Building } from "./context";

const NAV_ITEMS = [
  { href: "/dashboard/admin/overview", label: "Overview", icon: LayoutGrid },
  { href: "/dashboard/admin/managers", label: "Managers", icon: UserCog },
  { href: "/dashboard/admin/sites", label: "Sites", icon: Building2 },
  { href: "/dashboard/admin/buildings", label: "Buildings", icon: Home },
  { href: "/dashboard/admin/users", label: "Users", icon: Users },
  { href: "/dashboard/admin/audit", label: "Audit", icon: History },
  { href: "/dashboard/admin/maintenance", label: "Maintenance", icon: Settings },
];

function AdminLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { profile, loading, load } = useAdminData();

  async function signOut() {
    await createClient().auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <Link href="/dashboard/admin" className="flex items-center gap-2">
          <DomioLogo className="h-9 w-auto" />
          <span className="text-xs text-muted-foreground">Administrator</span>
        </Link>
        <div className="flex gap-2">
          <ThemeToggle />
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
                <p className="text-sm text-muted-foreground">Role: Admin</p>
                <p className="text-sm text-muted-foreground">Site: All</p>
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.phone && <p className="text-sm text-muted-foreground"><a href={`tel:${profile.phone.replace(/[\s\-\(\)\.]/g, "")}`} className="text-primary hover:underline">{profile.phone}</a></p>}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="outline" size="sm" onClick={signOut}><LogOut className="size-4 mr-1" />Logout</Button>
        </div>
      </header>

      <nav className="flex flex-wrap gap-1 mb-6">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href;
          return (
            <Link key={href} href={href}>
              <Button
                variant={isActive ? "secondary" : "ghost"}
                size="sm"
                className={`flex items-center gap-2 ${isActive ? "bg-muted" : ""}`}
              >
                <Icon className="size-4" />
                {label}
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
