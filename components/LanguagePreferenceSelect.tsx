"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

export function LanguagePreferenceSelect() {
  const { locale, setLocale, refreshLocale } = useLocale();
  const [savingLocale, setSavingLocale] = useState(false);

  async function handleLocaleChange(value: "en" | "al") {
    setLocale(value);
    setSavingLocale(true);
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: value }),
      });
      await refreshLocale();
    } finally {
      setSavingLocale(false);
    }
  }

  return (
    <div className="space-y-2 max-w-md">
      <Label>{t(locale, "preferences.appLanguage")}</Label>
      <Select
        value={locale}
        onValueChange={(v) => handleLocaleChange(v as "en" | "al")}
        disabled={savingLocale}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="en">{t(locale, "preferences.english")}</SelectItem>
          <SelectItem value="al">{t(locale, "preferences.shqip")}</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
