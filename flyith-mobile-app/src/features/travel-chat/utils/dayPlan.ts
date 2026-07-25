import type { DayPlanSlot, DayPlanSlotId, PlaceOption, TripBrief } from "../types";

type Locale = "tr" | "en";

export interface DayPlanSlotQuery {
  id: DayPlanSlotId;
  label: string;
  timeRange: string;
  query: string;
}

/**
 * Three time-of-day slots for place suggestions. Pace widens/narrows windows;
 * cuisineTypes enrich the evening food query.
 */
export function dayPlanSlotQueries(brief: TripBrief, locale: Locale): DayPlanSlotQuery[] {
  const dest = brief.destination ?? "the city";
  const cuisine = brief.cuisineTypes?.[0] ?? brief.foodPreferences?.[0] ?? "";
  const foodHint = cuisine && cuisine !== "any" ? ` ${cuisine}` : "";
  const pace = brief.pace ?? "balanced";

  const windows =
    pace === "relaxed"
      ? { morning: "10:00–12:30", afternoon: "13:00–17:00", evening: "19:00–22:00" }
      : pace === "packed"
        ? { morning: "08:30–12:00", afternoon: "12:15–18:00", evening: "18:30–23:00" }
        : { morning: "09:00–12:00", afternoon: "12:30–17:30", evening: "18:30–22:30" };

  if (locale === "tr") {
    return [
      {
        id: "morning",
        label: "Sabah",
        timeRange: windows.morning,
        query: `best breakfast brunch cafes in ${dest}`,
      },
      {
        id: "afternoon",
        label: "Öğleden sonra",
        timeRange: windows.afternoon,
        query: `top museums attractions things to do in ${dest}`,
      },
      {
        id: "evening",
        label: "Akşam",
        timeRange: windows.evening,
        query: `best dinner restaurants${foodHint} nightlife in ${dest}`.trim(),
      },
    ];
  }

  return [
    {
      id: "morning",
      label: "Morning",
      timeRange: windows.morning,
      query: `best breakfast brunch cafes in ${dest}`,
    },
    {
      id: "afternoon",
      label: "Afternoon",
      timeRange: windows.afternoon,
      query: `top museums attractions things to do in ${dest}`,
    },
    {
      id: "evening",
      label: "Evening",
      timeRange: windows.evening,
      query: `best dinner restaurants${foodHint} nightlife in ${dest}`.trim(),
    },
  ];
}

export function buildDayPlanSlots(
  results: { id: DayPlanSlotId; label: string; timeRange: string; options: PlaceOption[] }[]
): DayPlanSlot[] {
  return results.map((result) => ({
    id: result.id,
    label: result.label,
    timeRange: result.timeRange,
    options: result.options.slice(0, 4),
  }));
}

export function dayPlanLabel(locale: Locale): string {
  return locale === "tr" ? "Günün planı" : "Your day plan";
}
