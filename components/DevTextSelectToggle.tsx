"use client";

import { useEffect, useState } from "react";

const STORAGE_KEY = "domio-text-select-restricted";

/** Dev only: floating control to turn prod-like “no text select” on/off. */
export function DevTextSelectToggle() {
  const isDev = process.env.NODE_ENV === "development";
  const [mounted, setMounted] = useState(false);
  const [restricted, setRestricted] = useState(false);

  useEffect(() => {
    if (!isDev) return;
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    const on = stored === "1";
    document.documentElement.classList.toggle("domio-select-restricted", on);
    setRestricted(on);
  }, [isDev]);

  if (!isDev || !mounted) return null;

  function toggle() {
    const next = !document.documentElement.classList.contains("domio-select-restricted");
    document.documentElement.classList.toggle("domio-select-restricted", next);
    localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    setRestricted(next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="fixed bottom-3 right-3 z-[100] rounded-md border border-amber-500/60 bg-amber-500/15 px-2 py-1 text-[11px] font-medium text-amber-950 shadow-sm backdrop-blur-sm dark:text-amber-100"
      title="Toggle text selection (development only)"
    >
      {restricted ? "Text select: OFF (prod-like)" : "Text select: ON (dev)"}
    </button>
  );
}
