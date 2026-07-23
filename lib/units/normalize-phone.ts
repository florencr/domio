/** Normalize phone for matching (handles Excel scientific notation like 3.06978E+11). */
export function normalizePhone(raw: string | null | undefined): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  if (/^\d+(\.\d+)?[eE][+-]?\d+$/.test(s)) {
    const n = Number(s);
    if (Number.isFinite(n)) s = String(Math.round(n));
  }
  return s.replace(/[^\d]/g, "");
}

export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a);
  const nb = normalizePhone(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 8 && nb.length >= 8 && (na.endsWith(nb) || nb.endsWith(na))) return true;
  return false;
}
