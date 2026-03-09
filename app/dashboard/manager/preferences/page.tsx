"use client";

import { PreferencesPage } from "@/components/PreferencesPage";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export default function ManagerPreferencesPage() {
  const { locale } = useLocale();
  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">{t(locale, "preferences.title")}</h1>
      <PreferencesPage />
    </div>
  );
}
