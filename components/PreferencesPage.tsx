"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Languages } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";

type LocaleOption = { value: "en" | "al"; label: string };

type ThemeOption = "light" | "dark" | "system";

export function PreferencesPage() {
  const { theme, setTheme } = useTheme();
  const { locale, setLocale, refreshLocale } = useLocale();
  const [loading, setLoading] = useState(true);
  const [savingLocale, setSavingLocale] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => { setLoading(false); }, []);

  const localeOptions: LocaleOption[] = [
    { value: "en", label: t(locale, "preferences.english") },
    { value: "al", label: t(locale, "preferences.shqip") },
  ];

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

  if (!mounted) {
    return (
      <div className="max-w-md">
        <Card>
          <CardHeader>
            <CardTitle>{t(locale, "preferences.title")}</CardTitle>
            <p className="text-sm text-muted-foreground">{t(locale, "common.loading")}</p>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Languages className="size-5" />
            {t(locale, "preferences.language")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t(locale, "preferences.languageDescription")}</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label>{t(locale, "preferences.appLanguage")}</Label>
            <Select
              value={locale}
              onValueChange={(v) => handleLocaleChange(v as "en" | "al")}
              disabled={loading || savingLocale}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {localeOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sun className="size-5" />
            {t(locale, "preferences.appearance")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t(locale, "preferences.appearanceDescription")}</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {(["light", "dark", "system"] as ThemeOption[]).map((opt) => (
              <Button
                key={opt}
                variant={theme === opt ? "default" : "outline"}
                size="sm"
                onClick={() => setTheme(opt)}
              >
                {opt === "light" && <Sun className="size-4 mr-1" />}
                {opt === "dark" && <Moon className="size-4 mr-1" />}
                {opt === "system" && <Monitor className="size-4 mr-1" />}
                {t(locale, `preferences.${opt}`)}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
