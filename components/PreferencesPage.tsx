"use client";

import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun, Monitor, Languages } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { t } from "@/lib/i18n";
import { LanguagePreferenceSelect } from "@/components/LanguagePreferenceSelect";

type ThemeOption = "light" | "dark" | "system";

export function PreferencesPage() {
  const { theme, setTheme } = useTheme();
  const { locale } = useLocale();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
          <LanguagePreferenceSelect />
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
