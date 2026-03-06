"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LogOut, Settings, User, FileText, Wallet, CreditCard, BookOpen } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { DomioLogo } from "@/components/DomioLogo";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ManagerDataProvider, useManagerData } from "./context";
import { SendNotificationForm } from "./SendNotificationForm";

const NAV_ITEMS = [
  { href: "/dashboard/manager/billing", label: "Billing", icon: FileText },
  { href: "/dashboard/manager/expenses", label: "Expenses", icon: Wallet },
  { href: "/dashboard/manager/payments", label: "Payments", icon: CreditCard },
  { href: "/dashboard/manager/ledger", label: "Ledger", icon: BookOpen },
  { href: "/dashboard/manager/config", label: "Config", icon: Settings },
];

function ManagerLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { data, loading } = useManagerData();
  const [showSendNotif, setShowSendNotif] = useState(false);

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

  const { profile, bills, expenses } = data;
  const collected = bills.filter(b => b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const outstanding = bills.filter(b => !b.paid_at).reduce((s, b) => s + Math.abs(Number(b.total_amount)), 0);
  const expenseRecords = expenses.filter(e => e.period_month != null);
  const monthlyExpenses = expenseRecords.reduce((s, e) => s + Number(e.amount), 0);
  const netFund = collected - monthlyExpenses;

  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      {showSendNotif && <SendNotificationForm unitTypes={data.unitTypes} onClose={() => setShowSendNotif(false)} />}
      <header className="flex items-center justify-between mb-6">
        <div>
          <Link href="/dashboard/manager" className="flex items-center gap-2">
            <DomioLogo className="h-9 w-auto" />
            <span className="text-xs text-muted-foreground whitespace-nowrap">{data.site?.name ? `${data.site.name} Manager` : "Manager"}</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell
            isManager
            onSendClick={() => setShowSendNotif(true)}
            onSeeAllClick={() => router.push("/dashboard/manager/config/notifications")}
          />
          <Link href="/dashboard/manager/config">
            <Button variant="ghost" size="icon" title="Configuration"><Settings className="size-5" /></Button>
          </Link>
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
                {data.site?.name != null && <p className="text-sm text-muted-foreground">Site: {data.site.name}</p>}
                <p className="text-sm text-muted-foreground">{profile?.email}</p>
                {profile?.phone && <p className="text-sm text-muted-foreground">{profile.phone}</p>}
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut} className="gap-2 cursor-pointer">
                <LogOut className="size-4" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <Card className="border-l-4 border-l-green-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-green-600 shrink-0">{collected.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Collected</p>
            <p className="text-xs text-muted-foreground mt-0.5">From {bills.filter(b=>b.paid_at).length} paid bills</p>
          </div>
        </Card>
        <Card className="border-l-4 border-l-red-500 py-3 gap-1 px-4 flex flex-row items-center justify-between md:flex-col md:items-start md:justify-start">
          <p className="text-xl font-extrabold text-red-600 shrink-0">{outstanding.toFixed(2)}</p>
          <div className="text-right md:text-left">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Outstanding</p>
            <p className="text-xs text-muted-foreground mt-0.5">From {bills.filter(b=>!b.paid_at).length} unpaid bills</p>
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
          const isActive = pathname === href || (href === "/dashboard/manager/config" && pathname?.startsWith("/dashboard/manager/config"));
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
        <nav className="grid grid-cols-4 gap-1 h-12 min-h-[48px] p-1.5 rounded-lg">
          {NAV_ITEMS.filter(n => n.href !== "/dashboard/manager/config").map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href;
            return (
              <Link key={href} href={href} className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold rounded-md ${isActive ? "bg-muted" : ""}`}>
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
          <Link href="/dashboard/manager/config" className={`flex flex-col items-center justify-center gap-0.5 text-xs font-semibold rounded-md ${pathname?.startsWith("/dashboard/manager/config") ? "bg-muted" : ""}`}>
            <Settings className="size-4" />
            Config
          </Link>
        </nav>
      </div>
    </div>
  );
}

export default function ManagerLayout({ children }: { children: React.ReactNode }) {
  return (
    <ManagerDataProvider>
      <ManagerLayoutInner>{children}</ManagerLayoutInner>
    </ManagerDataProvider>
  );
}
