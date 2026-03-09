"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

type Locale = "en" | "al";

type LocaleContextValue = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  refreshLocale: () => Promise<void>;
  loading: boolean;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("en");
  const [loading, setLoading] = useState(true);

  const refreshLocale = useCallback(async () => {
    try {
      const res = await fetch("/api/profile", { cache: "no-store" });
      if (res.ok) {
        const p = await res.json();
        setLocaleState(p?.locale === "al" ? "al" : "en");
      }
    } catch {
      setLocaleState("en");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshLocale();
  }, [refreshLocale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
  }, []);

  return (
    <LocaleContext.Provider value={{ locale, setLocale, refreshLocale, loading }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) {
    return {
      locale: "en",
      setLocale: () => {},
      refreshLocale: async () => {},
      loading: false,
    };
  }
  return ctx;
}
