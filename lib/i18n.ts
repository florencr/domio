/**
 * Simple i18n helper. Use when you add translations.
 * No existing code uses this yet - you replace strings manually when ready.
 *
 * Usage:
 *   import { t } from "@/lib/i18n";
 *   const msg = t("al", "notifications.billReadyBody", { month: "Mar", year: "2026" });
 */

import en from "@/locales/en.json";
import al from "@/locales/al.json";

const dictionaries: Record<string, Record<string, unknown>> = { en, al };

function getNested(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const p of parts) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return typeof current === "string" ? current : undefined;
}

export function t(
  locale: "en" | "al",
  key: string,
  params?: Record<string, string>
): string {
  const dict = dictionaries[locale] ?? dictionaries.en;
  let str = getNested(dict as Record<string, unknown>, key);
  if (!str) str = getNested(dictionaries.en as Record<string, unknown>, key);
  if (!str) return key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), v);
    }
  }
  return str;
}
