export function formatShortDate(isoDate?: string): string {
  if (!isoDate) return "";
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return "";
  if (startDate && endDate) return `${formatShortDate(startDate)} – ${formatShortDate(endDate)}`;
  return formatShortDate(startDate ?? endDate);
}

export function formatDurationMinutes(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

export function toIsoDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return toIsoDate(date);
}

export function nightsBetween(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00Z`).getTime();
  const end = new Date(`${endDate}T00:00:00Z`).getTime();
  return Math.max(0, Math.round((end - start) / 86_400_000));
}

export function formatMonthLabel(month: string, locale?: string): string {
  const date = new Date(`${month}-01T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return month;
  return date.toLocaleDateString(locale, { month: "long", year: "numeric", timeZone: "UTC" });
}

export function formatTime(isoLikeDateTime: string): string {
  // SerpAPI returns "YYYY-MM-DD HH:mm" — normalize to a parseable ISO form.
  const parsed = new Date(isoLikeDateTime.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) return isoLikeDateTime;
  return parsed.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}
