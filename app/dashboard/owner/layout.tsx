"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, User, FileText, AlertTriangle, Home, BookOpen, Bell, CreditCard } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DomioLogo } from "@/components/DomioLogo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { OwnerDataProvider, useOwnerData } from "./context";

const NAV_ITEMS = [
  { href: "/dashboard/owner/units", label: "My Units", icon: Home },
  { href: "/dashboard/owner/billing", label: "Billing", icon: FileText },
  { href: "/dashboard/owner/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/owner/ledger", label: "Ledger", icon: BookOpen },
  { href: "/dashboard/owner/notifications", label: "Notifications", icon: Bell },
];

function OwnerLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading } = useOwnerData();

  async function handleSignOut() {
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

  const { profile, units, bills, expenses } = data;
  const unitIdSet = new Set(units.map(u => u.id));
  const myBills = bills.filter(b => unitIdSet.has(b.unit_id));
  const collected = myBills.filter(b => b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const outstanding = myBills.filter(b => !b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const unpaidBills = myBills.filter(b => !b.paid_at);
  const expenseRecords = expenses.filter(e => e.period_month != null);
  const monthlyExpenses = expenseRecords.reduce((s, e) => s + Number(e.amount), 0);
  const netFund = collected - monthlyExpenses;

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
        <header className="sticky top-0 z-30 -mx-4 -mt-4 px-4 pt-4 pb-2 mb-4 md:static md:mx-0 md:mt-0 md:px-0 md:pt-0 md:pb-0 md:mb-6 bg-white/90 dark:bg-background/90 backdrop-blur-sm md:bg-transparent flex items-center justify-between">
          <Link href="/dashboard/owner" className="flex items-center gap-2">
            <DomioLogo className="h-9 w-auto shrink-0" />
            <span className="text-sm font-medium text-muted-foreground whitespace-nowrap">Owner Dashboard</span>
          </Link>
          <div className="flex items-center gap-2 md:gap-2">
            <ThemeToggle />
            <NotificationBell onSeeAllClick={() => router.push("/dashboard/owner/notifications")} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 w-9 md:w-auto md:px-3 md:gap-2">
                  <User className="size-5 shrink-0" />
                  <span className="hidden md:inline truncate max-w-[140px]">{profile?.name} {profile?.surname}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="p-3 space-y-2">
                  <p className="font-semibold">{profile?.name} {profile?.surname}</p>
                  <p className="text-sm text-muted-foreground capitalize">Role: {profile?.role}</p>
                  <p className="text-sm text-muted-foreground">Site: {data.siteNames?.length ? data.siteNames.join(", ") : "—"}</p>
                  <p className="text-sm text-muted-foreground">{profile?.email}</p>
                  {profile?.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut} className="gap-2 cursor-pointer">
                  <LogOut className="size-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {unpaidBills.length > 0 && (
          <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:bg-amber-950/30 dark:border-amber-800">
            <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm">
              You have <strong>{unpaidBills.length} unpaid bill{unpaidBills.length > 1 ? "s" : ""}</strong> ({outstanding.toFixed(2)} total). Please pay or upload your payment slip in the Billing tab.
            </p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <Card className="border-l-4 border-l-green-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
            <p className="text-xl font-extrabold text-green-600 shrink-0">{collected.toFixed(2)}</p>
            <div className="text-right md:text-left">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Collected</p>
              <p className="text-xs text-muted-foreground mt-0.5">From {myBills.filter(b=>b.paid_at).length} paid bills</p>
            </div>
          </Card>
          <Card className="border-l-4 border-l-red-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
            <p className="text-xl font-extrabold text-red-600 shrink-0">{outstanding.toFixed(2)}</p>
            <div className="text-right md:text-left">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Outstanding</p>
              <p className="text-xs text-muted-foreground mt-0.5">From {myBills.filter(b=>!b.paid_at).length} unpaid bills</p>
            </div>
          </Card>
          <Card className="border-l-4 border-l-orange-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
            <p className="text-xl font-extrabold text-orange-600 shrink-0">{monthlyExpenses.toFixed(2)}</p>
            <div className="text-right md:text-left">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Monthly Expenses</p>
              <p className="text-xs text-muted-foreground mt-0.5">{expenseRecords.length} expense records</p>
            </div>
          </Card>
          <Card className={`border-l-4 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start ${netFund >= 0 ? "border-l-blue-500" : "border-l-amber-500"}`}>
            <p className={`text-xl font-extrabold shrink-0 ${netFund >= 0 ? "text-blue-600" : "text-amber-600"}`}>{netFund.toFixed(2)}</p>
            <div className="text-right md:text-left">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Net Fund</p>
              <p className="text-xs text-muted-foreground mt-0.5">Collected minus expenses</p>
            </div>
          </Card>
        </div>

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

        <div className="pb-24 md:pb-0">
          {children}
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-20 md:hidden bg-muted/90 border-t px-4 pt-1.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <nav className="grid grid-cols-5 gap-1 h-12 min-h-[48px] p-1.5 rounded-lg">
            {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href;
              return (
                <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold rounded-md ${isActive ? "bg-muted" : ""}`}>
                  <Icon className="size-4" />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
  );
}

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  return (
    <OwnerDataProvider>
      <OwnerLayoutInner>{children}</OwnerLayoutInner>
    </OwnerDataProvider>
  );
}
