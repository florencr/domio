"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PreferencesPage } from "@/components/PreferencesPage";
import { DomioLogo } from "@/components/DomioLogo";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function TenantPreferencesPage() {
  const { locale } = useLocale();
  return (
    <div className="min-h-screen bg-muted/20 p-4 md:p-6">
      <header className="flex items-center justify-between mb-6">
        <Link href="/dashboard/tenant" className="flex items-center gap-2">
          <DomioLogo className="h-9 w-auto" />
          <span className="text-sm font-medium text-muted-foreground">{t(locale, "tenant.tenantDashboard")}</span>
        </Link>
        <Link href="/dashboard/tenant">
          <Button variant="ghost" size="sm" className="gap-1">
            <ArrowLeft className="size-4" />
            {t(locale, "common.back")}
          </Button>
        </Link>
      </header>
      <h1 className="text-xl font-semibold mb-4">{t(locale, "preferences.title")}</h1>
      <PreferencesPage />
    </div>
  );
}
