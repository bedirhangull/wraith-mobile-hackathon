import { MAX_FLEXIBLE_DATE_PROBES, MIN_BOOKING_LEAD_DAYS } from "../constants";
import { addDays, toIsoDate } from "./dates";

export interface CandidateRange {
  startDate: string;
  endDate: string;
}

/** "2026-09-14" → "2026-09" */
export function monthOf(isoDate: string | undefined): string | undefined {
  if (!isoDate) return undefined;
  const match = /^(\d{4}-\d{2})/.exec(isoDate);
  return match?.[1];
}

function lastDayOfMonth(year: number, month: number): string {
  return toIsoDate(new Date(Date.UTC(year, month, 0)));
}

/**
 * Spreads up to `maxProbes` departure dates evenly across the bookable part of a
 * month, so one "I'm flexible in September" turn can be priced in parallel and
 * shown as a price-per-date comparison.
 */
export function buildCandidateDateRanges(
  month: string,
  tripLengthDays: number,
  today: Date = new Date(),
  maxProbes: number = MAX_FLEXIBLE_DATE_PROBES
): CandidateRange[] {
  const match = /^(\d{4})-(\d{2})$/.exec(month);
  if (!match) return [];

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);
  if (!year || monthNumber < 1 || monthNumber > 12) return [];

  const firstOfMonth = `${match[1]}-${match[2]}-01`;
  const lastOfMonth = lastDayOfMonth(year, monthNumber);
  const earliestBookable = addDays(toIsoDate(today), MIN_BOOKING_LEAD_DAYS);

  const windowStart = firstOfMonth > earliestBookable ? firstOfMonth : earliestBookable;
  if (windowStart > lastOfMonth) return []; // month already gone

  const spanDays = Math.round(
    (new Date(`${lastOfMonth}T00:00:00Z`).getTime() -
      new Date(`${windowStart}T00:00:00Z`).getTime()) /
      86_400_000
  );
  const probeCount = Math.max(1, Math.min(maxProbes, spanDays + 1));
  const step = probeCount > 1 ? spanDays / (probeCount - 1) : 0;

  const seen = new Set<string>();
  const ranges: CandidateRange[] = [];
  for (let index = 0; index < probeCount; index += 1) {
    const startDate = addDays(windowStart, Math.round(index * step));
    if (seen.has(startDate)) continue;
    seen.add(startDate);
    ranges.push({ startDate, endDate: addDays(startDate, tripLengthDays) });
  }
  return ranges;
}
