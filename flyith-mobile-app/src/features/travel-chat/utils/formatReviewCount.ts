type Locale = "tr" | "en";

export function normalizeReviewCount(value: number | undefined): number | undefined {
  if (value == null || !Number.isFinite(value) || value <= 0) return undefined;
  // With hl=tr, Google abbreviates "bin" as "B". SerpAPI can interpret that as
  // billion (184 B → 184,000,000,000) instead of 184 thousand.
  return value >= 1_000_000_000 ? value / 1_000_000 : value;
}

function compact(value: number, divisor: number, suffix: string): string {
  const rounded = Math.round((value / divisor) * 10) / 10;
  return `${String(rounded).replace(".", ",")} ${suffix}`;
}

/** Compact review totals without relying on Hermes' incomplete Intl compact notation. */
export function formatReviewCount(value: number | undefined, locale: Locale): string | undefined {
  const count = normalizeReviewCount(value);
  if (count == null) return undefined;
  if (count >= 1_000_000) return compact(count, 1_000_000, locale === "tr" ? "Mn" : "M");
  if (count >= 1_000) return compact(count, 1_000, locale === "tr" ? "bin" : "K");
  return new Intl.NumberFormat(locale === "tr" ? "tr-TR" : "en-US").format(Math.round(count));
}
