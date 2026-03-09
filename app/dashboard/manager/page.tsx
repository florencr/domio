"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function ManagerPage() {
  const router = useRouter();
  const { locale } = useLocale();
  useEffect(() => {
    router.replace("/dashboard/manager/billing");
  }, [router]);
  return (
    <div className="min-h-[200px] flex items-center justify-center">
      <p className="text-muted-foreground">{t(locale, "common.redirecting")}</p>
    </div>
  );
}
