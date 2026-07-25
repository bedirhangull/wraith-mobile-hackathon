import { z } from "zod";

import type { AssistantTurn, ModelAction, ModelTurnResponse } from "../types";

// Gemini only ever needs to produce these turn kinds directly — flight/hotel/
// destination cards are always built by the app from real SerpAPI data (see
// services/mappers.ts), never authored by the model, so they're deliberately
// excluded from what the model is allowed to emit.
export const GEMINI_TURN_KINDS = [
  "text",
  "question",
  "suggestions",
  "image",
  "system_notice",
] as const;

const BRIEF_PATCH_PROPERTIES = {
  destination: { type: "STRING" },
  originAirportCode: { type: "STRING" },
  destinationAirportCode: { type: "STRING" },
  startDate: { type: "STRING" },
  endDate: { type: "STRING" },
  travelers: { type: "NUMBER" },
  budgetTotalUSD: { type: "NUMBER" },
  accommodationType: { type: "STRING", enum: ["hostel", "hotel", "resort", "boutique"] },
  travelStyle: { type: "STRING", enum: ["cultural", "experience", "mixed"] },
  foodPreferences: { type: "ARRAY", items: { type: "STRING" } },
  adults: { type: "NUMBER" },
  children: { type: "NUMBER" },
  childrenAges: { type: "ARRAY", items: { type: "NUMBER" } },
  infantsInSeat: { type: "NUMBER" },
  infantsOnLap: { type: "NUMBER" },
  companionType: { type: "STRING" },
  travelClass: { type: "NUMBER" },
  maxStops: { type: "NUMBER" },
  carryOnBags: { type: "NUMBER" },
  maxFlightPriceUSD: { type: "NUMBER" },
  outboundTimeWindow: { type: "STRING" },
  layoverWindowMinutes: { type: "STRING" },
  maxDurationMinutes: { type: "NUMBER" },
  preferLowEmissions: { type: "BOOLEAN" },
  preferredAirlines: { type: "ARRAY", items: { type: "STRING" } },
  avoidAirlines: { type: "ARRAY", items: { type: "STRING" } },
  hotelClasses: { type: "ARRAY", items: { type: "NUMBER" } },
  hotelMinRating: { type: "NUMBER" },
  mustHaveAmenities: { type: "ARRAY", items: { type: "STRING" } },
  freeCancellationRequired: { type: "BOOLEAN" },
  ecoCertifiedPreferred: { type: "BOOLEAN" },
  neighborhoodPreference: { type: "STRING" },
  maxPricePerNightUSD: { type: "NUMBER" },
  vacationRentals: { type: "BOOLEAN" },
  bedrooms: { type: "NUMBER" },
  exploreInterest: {
    type: "STRING",
    enum: ["popular", "outdoors", "beaches", "museum", "history", "skiing"],
  },
  travelDurationPreset: { type: "NUMBER" },
  minPlaceRating: { type: "NUMBER" },
  openNowOnly: { type: "BOOLEAN" },
  pace: { type: "STRING", enum: ["relaxed", "balanced", "packed"] },
  famousVsHiddenGems: { type: "STRING", enum: ["famous", "hidden", "mix"] },
  dayTripInterest: { type: "BOOLEAN" },
  nightlifeInterest: { type: "BOOLEAN" },
  shoppingInterest: { type: "BOOLEAN" },
  giftShopping: { type: "BOOLEAN" },
  eventInterest: { type: "BOOLEAN" },
  dietaryRestrictions: { type: "ARRAY", items: { type: "STRING" } },
  cuisineTypes: { type: "ARRAY", items: { type: "STRING" } },
  occasion: { type: "STRING" },
  influencerRouteAccepted: { type: "BOOLEAN" },
} as const;

// Kept as a flat object (no oneOf/discriminated-union) because Gemini's
// structured-output support for that OpenAPI subset is inconsistent across
// versions — see plan section "Gemini integration".
export const GEMINI_RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    turn: {
      type: "OBJECT",
      properties: {
        kind: { type: "STRING", enum: [...GEMINI_TURN_KINDS] },
        text: { type: "STRING" },
        quickReplies: { type: "ARRAY", items: { type: "STRING" } },
        chips: {
          type: "ARRAY",
          items: {
            type: "OBJECT",
            properties: {
              id: { type: "STRING" },
              label: { type: "STRING" },
              value: { type: "STRING" },
              description: { type: "STRING" },
              emoji: { type: "STRING" },
            },
            required: ["id", "label"],
          },
        },
        imagePrompt: { type: "STRING" },
        imageCaption: { type: "STRING" },
      },
      required: ["kind"],
    },
    briefPatch: {
      type: "OBJECT",
      properties: BRIEF_PATCH_PROPERTIES,
    },
    action: {
      type: "OBJECT",
      properties: {
        type: {
          type: "STRING",
          enum: [
            "search_flights",
            "search_flexible_dates",
            "search_hotels",
            "explore_destinations",
            "search_places",
            "search_events",
            "search_day_plan",
            "none",
          ],
        },
        origin: { type: "STRING" },
        destination: { type: "STRING" },
        startDate: { type: "STRING" },
        endDate: { type: "STRING" },
        category: { type: "STRING", enum: ["restaurants", "attractions", "events"] },
        month: { type: "STRING" },
        tripLengthDays: { type: "NUMBER" },
      },
      required: ["type"],
    },
  },
  required: ["turn", "briefPatch", "action"],
} as const;

const chipSchema = z.object({
  id: z.string().catch("option"),
  label: z.string(),
  value: z.string().optional().catch(undefined),
  description: z.string().optional().catch(undefined),
  emoji: z.string().optional().catch(undefined),
});

const rawTurnSchema = z.object({
  kind: z.enum(GEMINI_TURN_KINDS).catch("text"),
  text: z.string().optional().catch(undefined),
  quickReplies: z.array(z.string()).optional().catch(undefined),
  chips: z.array(chipSchema).optional().catch(undefined),
  imagePrompt: z.string().optional().catch(undefined),
  imageCaption: z.string().optional().catch(undefined),
});

const softString = z.string().optional().catch(undefined);
const softNumber = z.number().optional().catch(undefined);
const softBoolean = z.boolean().optional().catch(undefined);
const softStringArray = z.array(z.string()).optional().catch(undefined);
const softNumberArray = z.array(z.number()).optional().catch(undefined);

// Every field uses .catch(undefined) so one bad enum from Gemini cannot
// reject the entire response and dump the user into the catastrophic fallback.
const briefPatchSchema = z
  .object({
    destination: softString,
    originAirportCode: softString,
    destinationAirportCode: softString,
    startDate: softString,
    endDate: softString,
    travelers: softNumber,
    budgetTotalUSD: softNumber,
    accommodationType: z
      .enum(["hostel", "hotel", "resort", "boutique"])
      .optional()
      .catch(undefined),
    travelStyle: z.enum(["cultural", "experience", "mixed"]).optional().catch(undefined),
    foodPreferences: softStringArray,
    adults: softNumber,
    children: softNumber,
    childrenAges: softNumberArray,
    infantsInSeat: softNumber,
    infantsOnLap: softNumber,
    companionType: softString,
    travelClass: z
      .union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)])
      .optional()
      .catch(undefined),
    maxStops: z
      .union([z.literal(0), z.literal(1), z.literal(2), z.literal(3)])
      .optional()
      .catch(undefined),
    carryOnBags: softNumber,
    maxFlightPriceUSD: softNumber,
    outboundTimeWindow: softString,
    layoverWindowMinutes: softString,
    maxDurationMinutes: softNumber,
    preferLowEmissions: softBoolean,
    preferredAirlines: softStringArray,
    avoidAirlines: softStringArray,
    hotelClasses: softNumberArray,
    hotelMinRating: z
      .union([z.literal(7), z.literal(8), z.literal(9)])
      .optional()
      .catch(undefined),
    mustHaveAmenities: softStringArray,
    freeCancellationRequired: softBoolean,
    ecoCertifiedPreferred: softBoolean,
    neighborhoodPreference: softString,
    maxPricePerNightUSD: softNumber,
    vacationRentals: softBoolean,
    bedrooms: softNumber,
    exploreInterest: z
      .enum(["popular", "outdoors", "beaches", "museum", "history", "skiing"])
      .optional()
      .catch(undefined),
    travelDurationPreset: z
      .union([z.literal(1), z.literal(2), z.literal(3)])
      .optional()
      .catch(undefined),
    minPlaceRating: softNumber,
    openNowOnly: softBoolean,
    pace: z.enum(["relaxed", "balanced", "packed"]).optional().catch(undefined),
    famousVsHiddenGems: z.enum(["famous", "hidden", "mix"]).optional().catch(undefined),
    dayTripInterest: softBoolean,
    nightlifeInterest: softBoolean,
    shoppingInterest: softBoolean,
    giftShopping: softBoolean,
    eventInterest: softBoolean,
    dietaryRestrictions: softStringArray,
    cuisineTypes: softStringArray,
    occasion: softString,
    influencerRouteAccepted: softBoolean,
  })
  .passthrough();

const actionSchema = z.object({
  type: z
    .enum([
      "search_flights",
      "search_flexible_dates",
      "search_hotels",
      "explore_destinations",
      "search_places",
      "search_events",
      "search_day_plan",
      "none",
    ])
    .catch("none"),
  origin: softString,
  destination: softString,
  startDate: softString,
  endDate: softString,
  category: z.enum(["restaurants", "attractions", "events"]).optional().catch(undefined),
  month: softString,
  tripLengthDays: softNumber,
});

export const modelResponseRawSchema = z.object({
  turn: rawTurnSchema,
  briefPatch: briefPatchSchema.catch({}),
  action: actionSchema.catch({ type: "none" as const }),
});

export type ModelResponseRaw = z.infer<typeof modelResponseRawSchema>;

function toAssistantTurn(raw: z.infer<typeof rawTurnSchema>): AssistantTurn {
  if ((raw.kind === "text" || raw.kind === "question") && raw.chips && raw.chips.length >= 2) {
    return { kind: "suggestions", prompt: raw.text, chips: raw.chips };
  }

  switch (raw.kind) {
    case "text":
      return { kind: "text", text: raw.text ?? "" };
    case "question":
      return { kind: "question", text: raw.text ?? "", quickReplies: raw.quickReplies };
    case "suggestions":
      return { kind: "suggestions", prompt: raw.text, chips: raw.chips ?? [] };
    case "image":
      return {
        kind: "image",
        prompt: raw.imagePrompt ?? raw.text ?? "",
        caption: raw.imageCaption,
      };
    case "system_notice":
      return { kind: "system_notice", text: raw.text ?? "" };
    default:
      return { kind: "text", text: raw.text ?? "" };
  }
}

function toModelAction(raw: z.infer<typeof actionSchema>): ModelAction | null {
  switch (raw.type) {
    case "search_flights":
      return {
        type: "search_flights",
        args: {
          origin: raw.origin,
          destination: raw.destination,
          startDate: raw.startDate,
          endDate: raw.endDate,
        },
      };
    case "search_flexible_dates":
      return {
        type: "search_flexible_dates",
        args: {
          origin: raw.origin,
          destination: raw.destination,
          month: raw.month,
          tripLengthDays: raw.tripLengthDays,
        },
      };
    case "search_hotels":
      return {
        type: "search_hotels",
        args: { destination: raw.destination, startDate: raw.startDate, endDate: raw.endDate },
      };
    case "explore_destinations":
      return { type: "explore_destinations", args: { origin: raw.origin } };
    case "search_places":
      return {
        type: "search_places",
        args: { destination: raw.destination, category: raw.category },
      };
    case "search_events":
      return { type: "search_events", args: { destination: raw.destination, month: raw.month } };
    case "search_day_plan":
      return { type: "search_day_plan", args: { destination: raw.destination } };
    default:
      return null;
  }
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) (out as Record<string, unknown>)[key] = value;
  }
  return out;
}

/**
 * Parses Gemini JSON into the app's typed shape. Invalid briefPatch / action
 * fields are dropped instead of failing the whole turn.
 */
export function parseModelResponse(rawJson: unknown): ModelTurnResponse {
  const loose = z
    .object({
      turn: rawTurnSchema,
      briefPatch: z.unknown().optional(),
      action: z.unknown().optional(),
    })
    .safeParse(rawJson);

  if (!loose.success) {
    const obj = rawJson as { turn?: { text?: string; imagePrompt?: string } };
    const text = obj?.turn?.text ?? obj?.turn?.imagePrompt ?? "";
    return {
      turn: { kind: "text", text: text || "…" },
      briefPatch: {},
      action: null,
    };
  }

  const briefParsed = briefPatchSchema.safeParse(loose.data.briefPatch ?? {});
  const actionParsed = actionSchema.safeParse(loose.data.action ?? { type: "none" });

  return {
    turn: toAssistantTurn(loose.data.turn),
    briefPatch: stripUndefined(
      (briefParsed.success ? briefParsed.data : {}) as Record<string, unknown>
    ),
    action: actionParsed.success ? toModelAction(actionParsed.data) : null,
  };
}
