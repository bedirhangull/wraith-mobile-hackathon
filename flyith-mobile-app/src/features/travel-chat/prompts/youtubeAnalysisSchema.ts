import { z } from "zod";

import type { YouTubeTravelAnalysis } from "../types";

export const GEMINI_YOUTUBE_ANALYSIS_SCHEMA = {
  type: "OBJECT",
  properties: {
    isTravelRelated: { type: "BOOLEAN" },
    confidence: { type: "NUMBER" },
    destination: { type: "STRING" },
    destinationCountry: { type: "STRING" },
    suggestedTripLengthDays: { type: "NUMBER" },
    summary: { type: "STRING" },
    travelStyle: { type: "STRING", enum: ["cultural", "experience", "mixed"] },
    pace: { type: "STRING", enum: ["relaxed", "balanced", "packed"] },
    accommodationHint: { type: "STRING", enum: ["hostel", "hotel", "resort", "boutique"] },
    cuisineTypes: { type: "ARRAY", items: { type: "STRING" } },
    foodPreferences: { type: "ARRAY", items: { type: "STRING" } },
    warnings: { type: "ARRAY", items: { type: "STRING" } },
    highlights: { type: "ARRAY", items: { type: "STRING" } },
    places: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          category: {
            type: "STRING",
            enum: ["food", "sight", "experience", "shopping", "event", "hotel", "other"],
          },
          sentiment: { type: "STRING", enum: ["positive", "negative", "neutral"] },
          note: { type: "STRING" },
          timeHint: { type: "STRING" },
          startMs: { type: "NUMBER" },
        },
        required: ["name", "category", "sentiment"],
      },
    },
  },
  required: ["isTravelRelated", "places", "summary"],
} as const;

const placeSchema = z.object({
  name: z.string(),
  category: z
    .enum(["food", "sight", "experience", "shopping", "event", "hotel", "other"])
    .catch("other"),
  sentiment: z.enum(["positive", "negative", "neutral"]).catch("neutral"),
  note: z.string().optional().catch(undefined),
  timeHint: z.string().optional().catch(undefined),
  startMs: z.number().optional().catch(undefined),
});

const analysisSchema = z.object({
  isTravelRelated: z.boolean().catch(false),
  confidence: z.number().optional().catch(undefined),
  destination: z.string().optional().catch(undefined),
  destinationCountry: z.string().optional().catch(undefined),
  suggestedTripLengthDays: z.number().optional().catch(undefined),
  summary: z.string().catch(""),
  travelStyle: z.enum(["cultural", "experience", "mixed"]).optional().catch(undefined),
  pace: z.enum(["relaxed", "balanced", "packed"]).optional().catch(undefined),
  accommodationHint: z
    .enum(["hostel", "hotel", "resort", "boutique"])
    .optional()
    .catch(undefined),
  cuisineTypes: z.array(z.string()).optional().catch(undefined),
  foodPreferences: z.array(z.string()).optional().catch(undefined),
  warnings: z.array(z.string()).optional().catch(undefined),
  highlights: z.array(z.string()).optional().catch(undefined),
  places: z.array(placeSchema).catch([]),
});

export function parseYouTubeTravelAnalysis(raw: unknown): YouTubeTravelAnalysis {
  const parsed = analysisSchema.parse(raw);
  return {
    isTravelRelated: parsed.isTravelRelated,
    confidence: parsed.confidence,
    destination: parsed.destination?.trim() || undefined,
    destinationCountry: parsed.destinationCountry?.trim() || undefined,
    suggestedTripLengthDays:
      parsed.suggestedTripLengthDays != null && parsed.suggestedTripLengthDays > 0
        ? Math.round(parsed.suggestedTripLengthDays)
        : undefined,
    summary: parsed.summary.trim(),
    travelStyle: parsed.travelStyle,
    pace: parsed.pace,
    accommodationHint: parsed.accommodationHint,
    cuisineTypes: parsed.cuisineTypes?.filter(Boolean).slice(0, 8),
    foodPreferences: parsed.foodPreferences?.filter(Boolean).slice(0, 8),
    warnings: parsed.warnings?.filter(Boolean).slice(0, 8),
    highlights: parsed.highlights?.filter(Boolean).slice(0, 8),
    places: parsed.places
      .filter((place) => place.name.trim().length > 0)
      .map((place) => ({
        name: place.name.trim(),
        category: place.category,
        sentiment: place.sentiment,
        note: place.note?.trim() || undefined,
        timeHint: place.timeHint?.trim() || undefined,
        startMs: place.startMs,
      }))
      .slice(0, 24),
  };
}
