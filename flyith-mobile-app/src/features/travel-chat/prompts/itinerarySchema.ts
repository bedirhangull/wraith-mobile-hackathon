import { z } from "zod";

import type { ItineraryDay } from "../types";

export const GEMINI_ITINERARY_SCHEMA = {
  type: "ARRAY",
  items: {
    type: "OBJECT",
    properties: {
      dayNumber: { type: "NUMBER" },
      date: { type: "STRING" },
      title: { type: "STRING" },
      summary: { type: "STRING" },
      estimatedDayCostUSD: { type: "NUMBER" },
      activities: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            time: { type: "STRING" },
            title: { type: "STRING" },
            kind: {
              type: "STRING",
              enum: ["food", "sight", "experience", "transit", "rest", "shopping", "event"],
            },
            placeName: { type: "STRING" },
            note: { type: "STRING" },
            estimatedCostUSD: { type: "NUMBER" },
          },
          required: ["title", "kind"],
        },
      },
    },
    required: ["dayNumber", "title", "activities"],
  },
} as const;

const activitySchema = z.object({
  time: z.string().optional(),
  title: z.string(),
  kind: z.enum(["food", "sight", "experience", "transit", "rest", "shopping", "event"]),
  placeName: z.string().optional(),
  note: z.string().optional(),
  estimatedCostUSD: z.number().optional(),
});

const itineraryDaySchema = z.object({
  dayNumber: z.number(),
  date: z.string().optional(),
  title: z.string(),
  summary: z.string().optional(),
  activities: z.array(activitySchema),
  estimatedDayCostUSD: z.number().optional(),
});

const itineraryDaysSchema = z.array(itineraryDaySchema);

export function parseItineraryDays(rawJson: unknown): ItineraryDay[] {
  return itineraryDaysSchema.parse(rawJson);
}
