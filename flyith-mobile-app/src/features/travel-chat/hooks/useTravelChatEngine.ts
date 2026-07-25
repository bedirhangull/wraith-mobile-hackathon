import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";

import { DEFAULT_TRIP_LENGTH_DAYS, GEMINI_TURN_BUDGET_MS } from "../constants";
import { buildSystemPrompt } from "../prompts/systemPrompt";
import {
  generateItinerary,
  generateStructuredTurn,
  analyzeYouTubeTravelSource,
} from "../services/geminiClient";
import { mapDestinations, mapFlights, mapHotels, mapPlaces } from "../services/mappers";
import { inMemoryPersistenceAdapter } from "../services/persistence";
import { resolveAirportCode } from "../services/resolveAirport";
import { ensureDestinationGeo } from "../services/resolveDestinationGeo";
import {
  exploreParamsFromBrief,
  flightParamsFromBrief,
  hotelParamsFromBrief,
  placesParamsFromBrief,
} from "../services/searchParams";
import {
  exploreDestinations,
  searchFlights,
  searchHotels,
  searchPlaces,
} from "../services/serpapi";
import { buildModelContents, type GeminiContent } from "../services/transcript";
import {
  briefPatchFromYouTubeAnalysis,
  resolveYouTubePlaces,
  youtubePlanResetPatch,
  youtubeSourceFromIngest,
  YOUTUBE_SKIP_TOPIC_IDS,
} from "../services/youtubeBrief";
import { ingestYouTubeUrl } from "../services/youtubeIngest";
import { chatReducer, createInitialChatState } from "../state/chatReducer";
import {
  assumableTopicIds,
  FLIGHT_PREF_TOPIC_IDS,
  flightTopicsToSkipAfterSelection,
  HOTEL_PREF_TOPIC_IDS,
  hotelTopicsToSkipAfterSelection,
  isVagueDestination,
  OPTIONAL_FLIGHT_TOPIC_IDS,
  OPTIONAL_HOTEL_TOPIC_IDS,
  readyToSearchExperiences,
  readyToSearchFlights,
  readyToSearchHotels,
} from "../state/topicChecklist";
import {
  initialTripBrief,
  isDayPlanSettled,
  isReadyForReview,
  mergeBriefPatch,
  revisionPatch,
  revisionTopicIdsToForget,
} from "../state/tripBrief";
import type {
  ActivityKind,
  AssistantTurn,
  DateOption,
  DayPlanSlot,
  DestinationOption,
  FlightOption,
  HotelOption,
  ItineraryDay,
  ModelAction,
  PlaceCategory,
  PlaceOption,
  TripBrief,
  UserTurn,
} from "../types";
import { buildDayPlanSlots, dayPlanLabel, dayPlanSlotQueries } from "../utils/dayPlan";
import { formatMonthLabel, formatShortDate } from "../utils/dates";
import { detectReplyLocale } from "../utils/fallbackCopy";
import { buildCandidateDateRanges, monthOf } from "../utils/flexibleDates";
import { generateId } from "../utils/ids";
import { detectChatIntent } from "../utils/intents";
import { annotateFlights, annotateHotels } from "../utils/matchReasons";
import {
  briefPatchFromChip,
  buildTopicTurn,
  chipsForNextTopic,
  ESSENTIAL_TOPIC_IDS,
} from "../utils/nextTopicTurn";
import { normalizeAssistantTurn, canOfferDateChips } from "../utils/normalizeTurn";
import { creativePlanReady, creativeSnag } from "../utils/chatCopy";
import {
  isCardSearchAction,
  searchFailedBridge,
  searchReadyBridge,
  turnAsksAQuestion,
} from "../utils/searchBridge";
import { isInteractiveTurn, type QueuedStep } from "../utils/stepQueue";
import { withTimeout } from "../utils/withTimeout";
import { isYouTubeUrl } from "../utils/youtubeUrl";

const PLACE_QUERY_BY_CATEGORY: Record<Exclude<PlaceCategory, "events">, string> = {
  restaurants: "top restaurants",
  attractions: "famous tourist attractions",
};

function placeQueryWithDestination(
  category: Exclude<PlaceCategory, "events">,
  destination: string,
  cuisineHint: string
): string {
  const base = PLACE_QUERY_BY_CATEGORY[category];
  return `${base}${cuisineHint} in ${destination}`.trim();
}

type Locale = "tr" | "en";

const PLACE_LABEL_BY_CATEGORY: Record<PlaceCategory, Record<Locale, string>> = {
  restaurants: { tr: "Denemeye değer restoranlar", en: "Restaurants worth trying" },
  attractions: { tr: "Görülmesi gereken yerler", en: "Famous places to visit" },
  events: { tr: "Etkinlikler ve festivaller", en: "Events & festivals happening" },
};

function mergePlaceOptions(
  existing: PlaceOption[] | undefined,
  incoming: PlaceOption[]
): PlaceOption[] {
  const byId = new Map<string, PlaceOption>();
  for (const place of [...(existing ?? []), ...incoming]) {
    byId.set(place.id || place.name.trim().toLowerCase(), place);
  }
  return [...byId.values()].slice(-48);
}

function normalizePlaceName(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function enrichItineraryDays(
  days: ItineraryDay[],
  places: PlaceOption[] | undefined
): ItineraryDay[] {
  const known = places ?? [];
  return days.map((day) => ({
    ...day,
    activities: day.activities.map((activity, index) => {
      const activityName = normalizePlaceName(activity.placeName);
      const place = activityName
        ? known.find((candidate) => {
            const candidateName = normalizePlaceName(candidate.name);
            return (
              candidateName === activityName ||
              candidateName.includes(activityName) ||
              activityName.includes(candidateName)
            );
          })
        : undefined;
      return {
        ...activity,
        id:
          activity.id ??
          `${day.date ?? `day-${day.dayNumber}`}:${activity.time ?? index}:${activity.placeName ?? activity.title}`,
        placeId: activity.placeId ?? place?.id,
        dataId: activity.dataId ?? place?.dataId,
        latitude: activity.latitude ?? place?.latitude,
        longitude: activity.longitude ?? place?.longitude,
        address: activity.address ?? place?.address,
        phone: activity.phone ?? place?.phone,
        openState: activity.openState ?? place?.openState,
      };
    }),
  }));
}

function intlLocale(locale: Locale): string {
  return locale === "tr" ? "tr-TR" : "en-US";
}

/** Default search window when the user gave a trip length but no month. */
function nextMonth(): string {
  const now = new Date();
  const next = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
}

type ActionOutcome =
  | { status: "ok"; turn: AssistantTurn; summary: string; briefPatch?: Partial<TripBrief> }
  | { status: "empty"; detail: string }
  | { status: "missing_info"; detail: string }
  | { status: "failed"; detail: string };

function activityForAction(action: ModelAction): ActivityKind {
  switch (action.type) {
    case "search_flights":
      return "flights";
    case "search_flexible_dates":
      return "flexible_dates";
    case "search_hotels":
      return "hotels";
    case "explore_destinations":
      return "destinations";
    case "search_places":
      return action.args.category === "restaurants" ? "restaurants" : "attractions";
    case "search_events":
      return "events";
    case "search_day_plan":
      return "day_plan";
    default:
      return "thinking";
  }
}

function retrySearchTurn(
  actionType: ModelAction["type"],
  locale: Locale
): Extract<AssistantTurn, { kind: "suggestions" }> | null {
  const tr = locale === "tr";
  switch (actionType) {
    case "search_flights":
      return {
        kind: "suggestions",
        chips: [{ id: "retry-flights", label: tr ? "Uçuşları tekrar ara" : "Retry flights" }],
      };
    case "search_hotels":
      return {
        kind: "suggestions",
        chips: [{ id: "retry-hotels", label: tr ? "Otelleri tekrar ara" : "Retry hotels" }],
      };
    case "search_places":
      return {
        kind: "suggestions",
        chips: [
          { id: "retry-restaurants", label: tr ? "Restoranları tekrar ara" : "Retry restaurants" },
        ],
      };
    case "search_day_plan":
      return {
        kind: "suggestions",
        chips: [
          { id: "retry-day-plan", label: tr ? "Gün planını tekrar ara" : "Retry day plan" },
          { id: "skip-day-plan", label: tr ? "Gerek yok" : "Skip for now" },
        ],
      };
    default:
      return null;
  }
}

const EUROPE_REGION_HINT =
  /\b(europe|european|eu|albania|andorra|armenia|austria|azerbaijan|belarus|belgium|bosnia|bulgaria|croatia|cyprus|czech|denmark|estonia|finland|france|georgia|germany|greece|hungary|iceland|ireland|italy|kosovo|latvia|liechtenstein|lithuania|luxembourg|malta|moldova|monaco|montenegro|netherlands|holland|north\s*macedonia|norway|poland|portugal|romania|russia|san\s*marino|serbia|slovakia|slovenia|spain|sweden|switzerland|turkey|türkiye|turkiye|ukraine|united\s*kingdom|uk|england|scotland|wales|vatican|avrupa|almanya|fransa|italya|ispanya|portekiz|yunanistan|hollanda|belçika|belcika|isviçre|isvicre|avusturya|çek|cek|polonya|macaristan|romanya|bulgaristan|sırbistan|sirbistan|hırvatistan|hirvatistan|slovenya|slovakya|litvanya|letoniya|estonya|finlandiya|isveç|isvec|norveç|norvec|danimarka|irlanda|izlanda|malta|kıbrıs|kibris)\b/i;

function filterEuropeanDestinations<T extends { countryOrRegion?: string; name: string }>(
  options: T[]
): T[] {
  const filtered = options.filter((option) => {
    const haystack = `${option.countryOrRegion ?? ""} ${option.name}`;
    return EUROPE_REGION_HINT.test(haystack);
  });
  return filtered.length > 0 ? filtered : options;
}

/** Topics the user actually answered via chip/patch — distinct from "asked on screen". */
function markAnsweredTopicsFromPatch(answered: Set<string>, patch: Partial<TripBrief>) {
  if (patch.destinationAirportCode !== undefined) {
    answered.add("destination");
  } else if (patch.destination !== undefined && !isVagueDestination(patch.destination)) {
    answered.add("destination");
  }
  if (patch.originAirportCode !== undefined) answered.add("origin");
  if (
    patch.tripLengthDays !== undefined ||
    patch.startDate !== undefined ||
    patch.endDate !== undefined
  ) {
    answered.add("dates");
  }
  if (
    patch.adults !== undefined ||
    patch.travelers !== undefined ||
    patch.companionType !== undefined
  ) {
    answered.add("travelers");
  }
  if (patch.children !== undefined) answered.add("children");
  if (patch.budgetTotalUSD !== undefined) answered.add("budget");
  if (patch.occasion !== undefined) answered.add("occasion");
  if (patch.travelClass !== undefined) answered.add("cabin_class");
  if (patch.maxStops !== undefined) answered.add("stops");
  if (patch.carryOnBags !== undefined) answered.add("bags");
  if (patch.accommodationType !== undefined) answered.add("accommodation_type");
  if (patch.maxPricePerNightUSD !== undefined || patch.bedrooms !== undefined) {
    answered.add("hotel_budget");
  }
  if (patch.cuisineTypes !== undefined || patch.foodPreferences !== undefined) {
    answered.add("cuisine");
  }
  if (patch.travelStyle !== undefined) answered.add("travel_style");
  if (patch.pace !== undefined) answered.add("pace");
  if (patch.famousVsHiddenGems !== undefined) answered.add("famous_vs_hidden");
  if (patch.nightlifeInterest !== undefined) answered.add("nightlife");
  if (patch.dayTripInterest !== undefined) answered.add("day_trip");
  if (patch.shoppingInterest !== undefined || patch.giftShopping !== undefined) {
    answered.add("shopping_gifts");
  }
  if (patch.eventInterest !== undefined) answered.add("events");
  if (patch.influencerRouteAccepted !== undefined) answered.add("influencer_route");
  if (patch.restaurantsShown) answered.add("restaurants");
  if (patch.attractionsShown) answered.add("attractions");
  if (patch.dayPlanShown) answered.add("day_plan");
}

/** Keep image prompts rooted in the actual trip destination. */
function anchorImagePrompt(prompt: string, brief: TripBrief): string {
  const destination = brief.destination?.trim();
  if (!destination) return prompt;
  if (prompt.toLowerCase().includes(destination.toLowerCase())) return prompt;
  return `${prompt}, in ${destination}`;
}

async function runAction(
  action: ModelAction,
  brief: TripBrief,
  locale: Locale
): Promise<ActionOutcome> {
  try {
    switch (action.type) {
      case "search_flights": {
        const rawOrigin = action.args.origin ?? brief.originAirportCode;
        const rawDestination = action.args.destination ?? brief.destinationAirportCode;
        const outboundDate = action.args.startDate ?? brief.startDate;
        const returnDate = action.args.endDate ?? brief.endDate;
        const missing: string[] = [];
        if (!rawOrigin) missing.push("origin");
        if (!rawDestination) missing.push("destination");
        if (!outboundDate) missing.push("departure date");
        if (missing.length > 0) {
          return { status: "missing_info", detail: `needs ${missing.join(" and ")}` };
        }

        // Gemini often gives free-text city names here rather than IATA codes —
        // google_flights rejects those outright, so resolve through autocomplete
        // instead of trusting the model's text.
        const [origin, destination] = await Promise.all([
          resolveAirportCode(rawOrigin!),
          resolveAirportCode(rawDestination!),
        ]);
        if (!origin || !destination) {
          return {
            status: "empty",
            detail: `Couldn't resolve airport for "${!origin ? rawOrigin : rawDestination}"`,
          };
        }

        const response = await searchFlights(
          flightParamsFromBrief(
            { origin, destination, outboundDate: outboundDate!, returnDate },
            brief
          )
        );
        const options = annotateFlights(mapFlights(response), brief);
        if (options.length === 0) {
          return {
            status: "empty",
            detail: `No flights found for ${origin} → ${destination} on ${outboundDate}`,
          };
        }
        return {
          status: "ok",
          turn: { kind: "flight_options", options },
          summary: `${options.length} flight(s) ${origin} → ${destination} on ${outboundDate}`,
        };
      }
      case "search_flexible_dates": {
        const rawOrigin = action.args.origin ?? brief.originAirportCode;
        const rawDestination =
          action.args.destination ?? brief.destinationAirportCode ?? brief.destination;
        const month = action.args.month ?? monthOf(brief.startDate);
        const missing: string[] = [];
        if (!rawOrigin) missing.push("origin");
        if (!rawDestination) missing.push("destination");
        if (!month) missing.push("a month to search (YYYY-MM)");
        if (missing.length > 0) {
          return { status: "missing_info", detail: `needs ${missing.join(" and ")}` };
        }

        const [origin, destination] = await Promise.all([
          resolveAirportCode(rawOrigin!),
          resolveAirportCode(rawDestination!),
        ]);
        if (!origin || !destination) {
          return {
            status: "empty",
            detail: `Couldn't resolve airport for "${!origin ? rawOrigin : rawDestination}"`,
          };
        }

        const tripLengthDays = Math.min(
          Math.max(Math.round(action.args.tripLengthDays ?? DEFAULT_TRIP_LENGTH_DAYS), 2),
          21
        );
        const candidates = buildCandidateDateRanges(month!, tripLengthDays);
        if (candidates.length === 0) {
          return {
            status: "empty",
            detail: `${month} has no bookable dates left — suggest a later month`,
          };
        }

        // One user turn → several priced probes in parallel, so "I'm flexible"
        // resolves into a real price-per-date comparison instead of a re-ask.
        const settled = await Promise.allSettled(
          candidates.map((candidate) =>
            searchFlights(
              flightParamsFromBrief(
                {
                  origin,
                  destination,
                  outboundDate: candidate.startDate,
                  returnDate: candidate.endDate,
                },
                brief
              )
            )
          )
        );

        const options: DateOption[] = [];
        settled.forEach((result, index) => {
          if (result.status !== "fulfilled") return;
          const flights = mapFlights(result.value);
          const cheapest = flights.reduce<FlightOption | null>(
            (best, flight) => (best === null || flight.priceUSD < best.priceUSD ? flight : best),
            null
          );
          if (!cheapest) return;
          options.push({
            id: generateId(),
            startDate: candidates[index].startDate,
            endDate: candidates[index].endDate,
            priceUSD: cheapest.priceUSD,
            airline: cheapest.airline,
            airlineLogoUrl: cheapest.airlineLogoUrl,
            durationMinutes: cheapest.durationMinutes,
            stops: cheapest.stops,
          });
        });

        if (options.length === 0) {
          return {
            status: "empty",
            detail: `Priced ${candidates.length} date(s) in ${month} for ${origin} → ${destination} but none returned fares`,
          };
        }

        const cheapestPrice = Math.min(
          ...options.map((option) => option.priceUSD ?? Number.POSITIVE_INFINITY)
        );
        for (const option of options) {
          option.isCheapest = option.priceUSD === cheapestPrice;
        }

        return {
          status: "ok",
          turn: {
            kind: "date_options",
            month: month!,
            label: `${formatMonthLabel(month!, intlLocale(locale))} · ${tripLengthDays} ${
              locale === "tr" ? "gece" : "nights"
            }`,
            options,
          },
          summary: `Priced ${options.length} date range(s) in ${month}, cheapest $${cheapestPrice}`,
        };
      }
      case "search_hotels": {
        const query = action.args.destination ?? brief.destination;
        const checkInDate = action.args.startDate ?? brief.startDate;
        const checkOutDate = action.args.endDate ?? brief.endDate;
        const missing: string[] = [];
        if (!query) missing.push("destination");
        if (!checkInDate) missing.push("check-in date");
        if (!checkOutDate) missing.push("check-out date");
        if (missing.length > 0) {
          return { status: "missing_info", detail: `needs ${missing.join(" and ")}` };
        }

        const geoPatch = await ensureDestinationGeo(brief);
        const briefWithGeo = { ...brief, ...geoPatch };
        const response = await searchHotels(
          hotelParamsFromBrief(
            { destination: query!, checkInDate: checkInDate!, checkOutDate: checkOutDate! },
            briefWithGeo,
            locale
          )
        );
        const options = annotateHotels(mapHotels(response), briefWithGeo);
        if (options.length === 0) {
          return {
            status: "empty",
            detail: `No hotels found for "${query}" (${checkInDate} → ${checkOutDate})`,
          };
        }
        return {
          status: "ok",
          turn: { kind: "hotel_options", options },
          summary: `${options.length} hotel(s) in ${query}`,
          briefPatch: Object.keys(geoPatch).length > 0 ? geoPatch : undefined,
        };
      }
      case "explore_destinations": {
        const rawOrigin = action.args.origin ?? brief.originAirportCode;
        if (!rawOrigin) {
          return { status: "missing_info", detail: "needs an origin airport or city" };
        }
        const origin = await resolveAirportCode(rawOrigin);
        if (!origin) {
          return { status: "empty", detail: `Couldn't resolve airport for "${rawOrigin}"` };
        }
        const response = await exploreDestinations(exploreParamsFromBrief(origin, brief));
        const mapped = mapDestinations(response);
        const options =
          action.args.region === "europe" ? filterEuropeanDestinations(mapped) : mapped;
        if (options.length === 0) {
          return { status: "empty", detail: `No destination ideas from ${origin}` };
        }
        return {
          status: "ok",
          turn: { kind: "destination_inspiration", options },
          summary: `${options.length} destination idea(s) from ${origin}`,
        };
      }
      case "search_places": {
        const destination = action.args.destination ?? brief.destination;
        const category = (action.args.category ?? "attractions") as PlaceCategory;
        if (category === "events") {
          // Events go through search_events — keep this path restaurants/attractions only.
          return { status: "missing_info", detail: "use search_events for events" };
        }
        if (!destination) {
          return { status: "missing_info", detail: "needs a destination" };
        }
        const geoPatch = await ensureDestinationGeo(brief);
        const briefWithGeo = { ...brief, ...geoPatch };
        const cuisineHint =
          category === "restaurants" && brief.cuisineTypes?.length
            ? ` ${brief.cuisineTypes.slice(0, 2).join(" ")}`
            : "";
        const response = await searchPlaces(
          placesParamsFromBrief(
            {
              query: placeQueryWithDestination(category, destination, cuisineHint),
              location: destination,
            },
            briefWithGeo,
            locale
          )
        );
        const options = mapPlaces(response);
        if (options.length === 0) {
          return { status: "empty", detail: `No ${category} found in ${destination}` };
        }
        const names = options.slice(0, 8).map((place) => place.name);
        const briefPatch: Partial<TripBrief> =
          category === "restaurants"
            ? {
                restaurantsShown: true,
                shownRestaurantNames: names,
                shownPlaceOptions: mergePlaceOptions(brief.shownPlaceOptions, options),
                ...geoPatch,
              }
            : {
                attractionsShown: true,
                shownAttractionNames: names,
                shownPlaceOptions: mergePlaceOptions(brief.shownPlaceOptions, options),
                ...geoPatch,
              };
        return {
          status: "ok",
          turn: {
            kind: "places",
            category,
            label: PLACE_LABEL_BY_CATEGORY[category][locale],
            options,
          },
          summary: `${options.length} ${category} in ${destination}`,
          briefPatch,
        };
      }
      case "search_events": {
        const destination = action.args.destination ?? brief.destination;
        if (!destination) {
          return { status: "missing_info", detail: "needs a destination" };
        }
        const geoPatch = await ensureDestinationGeo(brief);
        const briefWithGeo = { ...brief, ...geoPatch };
        const monthLabel = action.args.month
          ? formatMonthLabel(action.args.month)
          : brief.startDate
            ? formatMonthLabel(brief.startDate.slice(0, 7))
            : "";
        const query = [`events in ${destination}`, monthLabel].filter(Boolean).join(" ");
        const response = await searchPlaces(
          placesParamsFromBrief({ query, location: destination }, briefWithGeo, locale)
        );
        const options = mapPlaces(response);
        if (options.length === 0) {
          return { status: "empty", detail: `No events found in ${destination}` };
        }
        const names = options.slice(0, 8).map((place) => place.name);
        return {
          status: "ok",
          turn: {
            kind: "places",
            category: "events",
            label: PLACE_LABEL_BY_CATEGORY.events[locale],
            options,
          },
          summary: `${options.length} event(s) in ${destination}`,
          briefPatch: {
            eventsShown: true,
            shownEventNames: names,
            shownPlaceOptions: mergePlaceOptions(brief.shownPlaceOptions, options),
            eventInterest: true,
            ...geoPatch,
          },
        };
      }
      case "search_day_plan": {
        const destination = action.args.destination ?? brief.destination;
        if (!destination) {
          return { status: "missing_info", detail: "needs a destination" };
        }
        const geoPatch = await ensureDestinationGeo(brief);
        const briefWithGeo = { ...brief, destination, ...geoPatch };
        const slotQueries = dayPlanSlotQueries(briefWithGeo, locale);
        const settled = await Promise.all(
          slotQueries.map(async (slot) => {
            const response = await searchPlaces(
              placesParamsFromBrief(
                { query: slot.query, location: destination },
                briefWithGeo,
                locale
              )
            );
            return {
              id: slot.id,
              label: slot.label,
              timeRange: slot.timeRange,
              options: mapPlaces(response),
            };
          })
        );
        const slots = buildDayPlanSlots(settled);
        const totalPlaces = slots.reduce((count, slot) => count + slot.options.length, 0);
        if (totalPlaces === 0) {
          return { status: "empty", detail: `No day-plan places found in ${destination}` };
        }
        const attractionNames = slots
          .filter((slot) => slot.id === "afternoon")
          .flatMap((slot) => slot.options.map((place) => place.name));
        const restaurantNames = slots
          .filter((slot) => slot.id === "morning" || slot.id === "evening")
          .flatMap((slot) => slot.options.map((place) => place.name));
        const allPlaces = slots.flatMap((slot) => slot.options);
        return {
          status: "ok",
          turn: { kind: "day_plan", label: dayPlanLabel(locale), slots },
          summary: `Day plan with ${slots.length} slot(s) in ${destination}`,
          briefPatch: {
            dayPlanShown: true,
            shownAttractionNames: attractionNames.slice(0, 8),
            shownRestaurantNames: restaurantNames.slice(0, 8),
            shownPlaceOptions: mergePlaceOptions(brief.shownPlaceOptions, allPlaces),
            ...geoPatch,
          },
        };
      }
      default:
        return { status: "failed", detail: "Unknown action type" };
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown search error";
    return { status: "failed", detail };
  }
}

type SelectableList =
  | { kind: "flight"; options: FlightOption[] }
  | { kind: "hotel"; options: HotelOption[] }
  | { kind: "place"; options: PlaceOption[] }
  | { kind: "destination"; options: DestinationOption[] }
  | { kind: "date"; options: DateOption[] };

function toSelectableList(turn: AssistantTurn): SelectableList | null {
  switch (turn.kind) {
    case "flight_options":
      return { kind: "flight", options: turn.options };
    case "hotel_options":
      return { kind: "hotel", options: turn.options };
    case "places":
      return { kind: "place", options: turn.options };
    case "destination_inspiration":
      return { kind: "destination", options: turn.options };
    case "date_options":
      return { kind: "date", options: turn.options };
    default:
      return null;
  }
}

function lastUserTextFromTurn(turn: UserTurn): string | undefined {
  if (turn.kind === "text") return turn.text;
  if (turn.kind === "chip_selection") return turn.label;
  return undefined;
}

function isBareGreeting(text: string | undefined): boolean {
  if (!text) return false;
  return /^(selam+|merhaba+|hi+|hello+|hey+)([\s!.🙏❤️]*)$/i.test(text.trim());
}

/** Chip ids that mean "I'll type the answer" — no model hop, just open the composer. */
function typedAnswerTopicFromChip(chipId: string): string | null {
  if (chipId === "dest-type") return "destination";
  if (chipId === "origin-type") return "origin";
  if (chipId === "budget-type") return "budget";
  const match = /^topic-(.+)-type$/.exec(chipId);
  return match?.[1] ?? null;
}

function typedAnswerPrompt(topicId: string, locale: "tr" | "en"): string {
  const tr = locale === "tr";
  switch (topicId) {
    case "destination":
      return tr ? "Tamam — şehri yazman yeterli." : "Sure — just type the city.";
    case "origin":
      return tr ? "Tamam — kalkış şehrini yaz." : "Sure — type your departure city.";
    case "budget":
      return tr ? "Tamam — bütçeni yaz (USD)." : "Sure — type your budget in USD.";
    default:
      return tr ? "Tamam — yazabilirsin." : "Sure — type it below.";
  }
}

/** Short free-text that looks like a city/place, not a preference sentence. */
function looksLikeTypedPlaceName(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 2 || trimmed.length > 48) return false;
  if (isBareGreeting(trimmed)) return false;
  if (/[?]/.test(trimmed)) return false;
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  if (
    words.length >= 2 &&
    /\b(istiyorum|isterim|bul|öner|önerir|bak|göster|uçuş|otel|tatil|ucuz|pahalı|lütfen|please|want|find|show)\b/i.test(
      trimmed
    )
  ) {
    return false;
  }
  return true;
}

function isDayPlanDonePhrase(text: string): boolean {
  return /^(tamam+|tamamdır|bitti|ok+|okay|done|that's all|hepsi bu|yeter)([!.]*)$/i.test(
    text.trim()
  );
}

function parseBudgetUsd(text: string): number | undefined {
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!match) return undefined;
  const amount = Number(match[1]);
  return Number.isFinite(amount) && amount > 0 ? amount : undefined;
}

/** Model sometimes invents destination/dates on a hello — drop those. Also strip vague destinations. */
function sanitizeBriefPatchForUserTurn(
  patch: Partial<TripBrief>,
  userTurn: UserTurn
): Partial<TripBrief> {
  const next = { ...patch };
  if (isBareGreeting(lastUserTextFromTurn(userTurn))) {
    delete next.destination;
    delete next.destinationAirportCode;
    delete next.startDate;
    delete next.endDate;
  }
  if (next.destination !== undefined && isVagueDestination(next.destination)) {
    delete next.destination;
  }
  return next;
}

// Lets the user type "2" / "ikinci" / "son" instead of tapping a card — the
// index resolves against whichever option list was most recently shown.
const ORDINAL_WORDS: Record<string, number> = {
  ilk: 1,
  birinci: 1,
  ikinci: 2,
  üçüncü: 3,
  ucuncu: 3,
  dördüncü: 4,
  dorduncu: 4,
  beşinci: 5,
  besinci: 5,
  altıncı: 6,
  altinci: 6,
  first: 1,
  second: 2,
  third: 3,
  fourth: 4,
  fifth: 5,
};

function resolveNumberSelection(text: string, list: SelectableList): number | null {
  const trimmed = text.trim().toLowerCase().replace(/[.)]$/, "");
  if (!trimmed) return null;

  if (/^\d+$/.test(trimmed)) {
    const n = Number.parseInt(trimmed, 10);
    return n >= 1 && n <= list.options.length ? n - 1 : null;
  }
  if (["son", "last", "sonuncu", "sonuncusu"].includes(trimmed)) {
    return list.options.length - 1;
  }
  const firstWord = trimmed.split(/\s+/)[0];
  if (firstWord in ORDINAL_WORDS) {
    const n = ORDINAL_WORDS[firstWord];
    return n >= 1 && n <= list.options.length ? n - 1 : null;
  }
  return null;
}

export function useTravelChatEngine(onboarding?: TripBrief["onboarding"]) {
  const [state, dispatch] = useReducer(chatReducer, undefined, () =>
    createInitialChatState(onboarding)
  );
  const lastSelectableListRef = useRef<SelectableList | null>(null);
  const isBusyRef = useRef(false);
  const activeSearchesRef = useRef(0);
  const logisticsFanoutDoneRef = useRef(false);
  const hotelFanoutDoneRef = useRef(false);
  const experienceFanoutDoneRef = useRef(false);
  /** After dest-europe / dest-surprise — ask origin then explore. */
  const pendingExploreRef = useRef<"europe" | "any" | null>(null);
  /** Level-trigger searches; set after maybeRunReadySearches is defined. */
  const runReadySearchesRef = useRef<(brief: TripBrief, locale: "tr" | "en") => boolean>(
    () => false
  );
  // Locked once from the user's first message — a chip labelled "Okey" must not
  // flip a Turkish conversation into English mid-way.
  const localeRef = useRef<Locale | null>(null);
  // Topics already put on screen — the same question never comes back.
  const askedTopicsRef = useRef<Set<string>>(new Set());
  // Topics the user has actually answered (distinct from asked).
  const answeredTopicsRef = useRef<Set<string>>(new Set());
  // Currently open interactive assistant message — next interactive turns queue behind it.
  const openStepRef = useRef<string | null>(null);
  const stepQueueRef = useRef<QueuedStep[]>([]);
  // One-shot allow re-search after "başka uçuş" style chips.
  const forceResearchRef = useRef(false);
  // After "Kendim yazarım" — next composer send answers this topic locally (no Gemini).
  const awaitingTypedAnswerRef = useRef<string | null>(null);
  // A tap or send that lands mid-cycle is queued, never dropped — dropping it
  // is what made the chat feel dead after selecting a card.
  const pendingTurnRef = useRef<{ turn: UserTurn; patch?: Partial<TripBrief> } | null>(null);
  const sendUserTurnRef = useRef<((turn: UserTurn, patch?: Partial<TripBrief>) => void) | null>(
    null
  );
  // Mirror of reducer state so async cycles never read a stale closure snapshot.
  const stateRef = useRef(state);
  const readyForReview = useMemo(() => isReadyForReview(state.brief), [state.brief]);
  const readyForReviewRef = useRef(readyForReview);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    readyForReviewRef.current = readyForReview;
  }, [readyForReview]);

  const bumpSearchActivity = useCallback((activity: ActivityKind | undefined) => {
    dispatch({ type: "SEARCH_ACTIVITY", activity });
  }, []);

  /**
   * Locks on the first message the user actually typed and never moves again.
   * Chip labels ("Solo", "$2500") are too ambiguous to lock on, so before that
   * happens we guess from whatever the user has typed so far.
   */
  const resolveLocale = useCallback((sampleText?: string, lock = false): Locale => {
    if (localeRef.current) return localeRef.current;

    if (lock && sampleText?.trim()) {
      const locked = detectReplyLocale(sampleText);
      localeRef.current = locked;
      dispatch({ type: "LOCALE_LOCKED", locale: locked });
      return locked;
    }

    for (let index = stateRef.current.messages.length - 1; index >= 0; index -= 1) {
      const message = stateRef.current.messages[index];
      if (message.role !== "user" || message.turn.kind !== "text") continue;
      return detectReplyLocale(message.turn.text);
    }
    return detectReplyLocale(sampleText);
  }, []);

  const emitAssistantTurn = useCallback((turn: AssistantTurn, topicId?: string) => {
    if (!isInteractiveTurn(turn)) {
      dispatch({ type: "ASSISTANT_TURN_ADDED", turn });
      return;
    }
    if (openStepRef.current) {
      stepQueueRef.current.push({ kind: "turn", turn, topicId });
      return;
    }
    const id = generateId();
    openStepRef.current = id;
    dispatch({ type: "ASSISTANT_TURN_ADDED", turn, id });
    lastSelectableListRef.current = toSelectableList(turn) ?? lastSelectableListRef.current;
  }, []);

  const enqueueNextTopic = useCallback(
    (prompt?: string) => {
      // Never stack checklist questions on top of an open pick — and keep at most
      // one pending next_topic recipe so parallel searches can't flood the queue.
      if (openStepRef.current) {
        stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
        stepQueueRef.current.push({ kind: "next_topic", prompt });
        return;
      }

      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      const brief = stateRef.current.brief;

      // A queued card must not prevent a newly-ready search from starting.
      // Its result can safely wait behind the existing interactive turn.
      if (runReadySearchesRef.current(brief, locale)) {
        if (prompt?.trim()) {
          emitAssistantTurn({ kind: "text", text: prompt.trim() });
        }
        return;
      }

      if (
        stepQueueRef.current.some((step) => step.kind === "turn" && isInteractiveTurn(step.turn))
      ) {
        stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
        stepQueueRef.current.push({ kind: "next_topic", prompt });
        return;
      }

      const skipIds = [...askedTopicsRef.current, ...answeredTopicsRef.current];
      let next = chipsForNextTopic(brief, locale, skipIds);
      if (next.topicId && answeredTopicsRef.current.has(next.topicId)) {
        askedTopicsRef.current.add(next.topicId);
        next = chipsForNextTopic(brief, locale, [
          ...askedTopicsRef.current,
          ...answeredTopicsRef.current,
        ]);
        if (next.topicId && answeredTopicsRef.current.has(next.topicId)) {
          return;
        }
      }
      if (next.chips.length === 0) {
        return;
      }
      if (next.topicId) {
        askedTopicsRef.current.add(next.topicId);
      } else {
        const assumed = assumableTopicIds(brief);
        if (assumed.length > 0) {
          dispatch({
            type: "BRIEF_PATCHED",
            patch: { skippedTopics: [...(brief.skippedTopics ?? []), ...assumed] },
          });
        }
      }
      emitAssistantTurn(
        { kind: "suggestions", prompt: prompt ?? next.prompt, chips: next.chips },
        next.topicId
      );
    },
    [emitAssistantTurn]
  );

  const flushQueue = useCallback(() => {
    while (!openStepRef.current && stepQueueRef.current.length > 0) {
      const step = stepQueueRef.current.shift()!;
      if (step.kind === "turn") {
        const brief = stateRef.current.brief;
        if (step.turn.kind === "flight_options" && brief.chosenFlight) continue;
        if (step.turn.kind === "hotel_options" && brief.chosenHotel) continue;
        if (
          step.turn.kind === "destination_inspiration" &&
          (brief.destination || brief.destinationAirportCode)
        ) {
          continue;
        }
        emitAssistantTurn(step.turn, step.topicId);
        return;
      }
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      const brief = stateRef.current.brief;
      if (runReadySearchesRef.current(brief, locale)) {
        if (step.prompt?.trim()) {
          emitAssistantTurn({ kind: "text", text: step.prompt.trim() });
        }
        return;
      }
      const skipIds = new Set([...askedTopicsRef.current, ...answeredTopicsRef.current]);
      const next = chipsForNextTopic(brief, locale, skipIds);
      if (next.chips.length === 0) {
        continue;
      }
      if (!next.topicId || answeredTopicsRef.current.has(next.topicId)) {
        if (!next.topicId) {
          const assumed = assumableTopicIds(brief);
          if (assumed.length > 0) {
            dispatch({
              type: "BRIEF_PATCHED",
              patch: { skippedTopics: [...(brief.skippedTopics ?? []), ...assumed] },
            });
          }
          if (next.chips.some((chip) => chip.id === "review-plan")) {
            emitAssistantTurn({
              kind: "suggestions",
              prompt: step.prompt ?? next.prompt,
              chips: next.chips,
            });
            return;
          }
          continue;
        }
        continue;
      }
      askedTopicsRef.current.add(next.topicId);
      emitAssistantTurn(
        {
          kind: "suggestions",
          prompt: step.prompt ?? next.prompt,
          chips: next.chips,
        },
        next.topicId
      );
      return;
    }
  }, [emitAssistantTurn]);

  const closeOpenStep = useCallback(() => {
    openStepRef.current = null;
    flushQueue();
  }, [flushQueue]);

  /** Consume the visible choice without letting a stale queued topic jump ahead. */
  const consumeOpenStep = useCallback(() => {
    openStepRef.current = null;
    stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
  }, []);

  const enqueueBackgroundSearch = useCallback(
    (action: ModelAction, brief: TripBrief, locale: "tr" | "en", isRefresh = false) => {
      activeSearchesRef.current += 1;
      bumpSearchActivity(activityForAction(action));

      void (async () => {
        try {
          const outcome = await runAction(action, brief, locale);
          if (outcome.status === "ok") {
            if (outcome.briefPatch) {
              const livePatch = outcome.briefPatch.shownPlaceOptions
                ? {
                    ...outcome.briefPatch,
                    shownPlaceOptions: mergePlaceOptions(
                      stateRef.current.brief.shownPlaceOptions,
                      outcome.briefPatch.shownPlaceOptions
                    ),
                  }
                : outcome.briefPatch;
              stateRef.current = {
                ...stateRef.current,
                brief: mergeBriefPatch(stateRef.current.brief, livePatch),
              };
              dispatch({ type: "BRIEF_PATCHED", patch: livePatch });
              markAnsweredTopicsFromPatch(answeredTopicsRef.current, livePatch);
            }
            const liveBrief = stateRef.current.brief;
            const suppressCards =
              !isRefresh &&
              ((outcome.turn.kind === "flight_options" && Boolean(liveBrief.chosenFlight)) ||
                (outcome.turn.kind === "hotel_options" && Boolean(liveBrief.chosenHotel)));
            if (!suppressCards) {
              // Search cards are the next interaction; stale checklist recipes must not jump ahead.
              stepQueueRef.current = stepQueueRef.current.filter(
                (step) => step.kind !== "next_topic"
              );
              emitAssistantTurn({
                kind: "text",
                text: searchReadyBridge(action.type, locale, isRefresh),
              });
              emitAssistantTurn(outcome.turn);
            }
            dispatch({
              type: "ASSISTANT_TURN_ADDED",
              turn: {
                kind: "tool_outcome",
                action: action.type,
                outcome: "ok",
                detail: outcome.summary,
              },
            });
            if (
              isReadyForReview(mergeBriefPatch(stateRef.current.brief, outcome.briefPatch ?? {})) &&
              stateRef.current.brief.chosenFlight &&
              stateRef.current.brief.chosenHotel
            ) {
              if (!readyForReviewRef.current) {
                emitAssistantTurn({
                  kind: "suggestions",
                  chips: [
                    {
                      id: "review-plan",
                      label: locale === "tr" ? "Planı gözden geçir" : "Review my plan",
                    },
                  ],
                });
              }
            }
          } else {
            if (action.type === "search_day_plan") {
              askedTopicsRef.current.delete("day_plan");
              answeredTopicsRef.current.delete("day_plan");
            }
            dispatch({
              type: "ASSISTANT_TURN_ADDED",
              turn: {
                kind: "tool_outcome",
                action: action.type,
                outcome: outcome.status,
                detail: outcome.detail,
              },
            });
            emitAssistantTurn({ kind: "text", text: searchFailedBridge(action.type, locale) });
            const retryTurn = retrySearchTurn(action.type, locale);
            if (retryTurn) {
              if (action.type === "search_flights") logisticsFanoutDoneRef.current = false;
              if (action.type === "search_hotels") hotelFanoutDoneRef.current = false;
              if (action.type === "search_places") experienceFanoutDoneRef.current = false;
              emitAssistantTurn(retryTurn);
            } else {
              enqueueNextTopic();
            }
          }
        } catch (error) {
          console.warn("[enqueueBackgroundSearch] failed:", error);
          if (action.type === "search_day_plan") {
            askedTopicsRef.current.delete("day_plan");
            answeredTopicsRef.current.delete("day_plan");
          }
          emitAssistantTurn({ kind: "text", text: searchFailedBridge(action.type, locale) });
          const retryTurn = retrySearchTurn(action.type, locale);
          if (retryTurn) {
            if (action.type === "search_flights") logisticsFanoutDoneRef.current = false;
            if (action.type === "search_hotels") hotelFanoutDoneRef.current = false;
            if (action.type === "search_places") experienceFanoutDoneRef.current = false;
            emitAssistantTurn(retryTurn);
          } else {
            enqueueNextTopic();
          }
        } finally {
          activeSearchesRef.current = Math.max(0, activeSearchesRef.current - 1);
          if (activeSearchesRef.current === 0) {
            bumpSearchActivity(undefined);
          }
        }
      })();
    },
    [bumpSearchActivity, emitAssistantTurn, enqueueNextTopic]
  );

  /** When dest+origin+dates+travelers+cabin/stops/bags lock, search flights once. */
  const maybeFanoutLogistics = useCallback(
    (brief: TripBrief, locale: "tr" | "en"): boolean => {
      if (logisticsFanoutDoneRef.current || brief.chosenFlight) return false;
      if (!readyToSearchFlights(brief)) return false;
      logisticsFanoutDoneRef.current = true;
      enqueueBackgroundSearch(
        {
          type: "search_flights",
          args: {
            origin: brief.originAirportCode,
            destination: brief.destinationAirportCode ?? brief.destination,
            startDate: brief.startDate,
            endDate: brief.endDate,
          },
        },
        brief,
        locale
      );
      return true;
    },
    [enqueueBackgroundSearch]
  );

  /** When flight is locked and hotel prefs settle, search hotels once. */
  const maybeFanoutHotels = useCallback(
    (brief: TripBrief, locale: "tr" | "en"): boolean => {
      if (brief.planningMode === "youtube") return false;
      if (hotelFanoutDoneRef.current || brief.chosenHotel) return false;
      if (!readyToSearchHotels(brief)) return false;
      hotelFanoutDoneRef.current = true;
      enqueueBackgroundSearch(
        {
          type: "search_hotels",
          args: {
            destination: brief.destination,
            startDate: brief.startDate,
            endDate: brief.endDate,
          },
        },
        brief,
        locale
      );
      return true;
    },
    [enqueueBackgroundSearch]
  );

  /** Once a hotel and cuisine are known, show restaurant cards before more preference questions. */
  const maybeFanoutExperiences = useCallback(
    (brief: TripBrief, locale: "tr" | "en"): boolean => {
      if (brief.planningMode === "youtube") return false;
      if (experienceFanoutDoneRef.current || brief.restaurantsShown) return false;
      const hasCuisine = Boolean(brief.cuisineTypes?.length || brief.foodPreferences?.length);
      if (!brief.chosenHotel || !brief.destination || !hasCuisine) return false;
      experienceFanoutDoneRef.current = true;
      enqueueBackgroundSearch(
        {
          type: "search_places",
          args: { destination: brief.destination, category: "restaurants" },
        },
        brief,
        locale
      );
      return true;
    },
    [enqueueBackgroundSearch]
  );

  const maybeRunReadySearches = useCallback(
    (brief: TripBrief, locale: "tr" | "en"): boolean => {
      if (maybeFanoutLogistics(brief, locale)) return true;
      if (maybeFanoutHotels(brief, locale)) return true;
      if (maybeFanoutExperiences(brief, locale)) return true;
      return false;
    },
    [maybeFanoutExperiences, maybeFanoutHotels, maybeFanoutLogistics]
  );

  useEffect(() => {
    runReadySearchesRef.current = maybeRunReadySearches;
  }, [maybeRunReadySearches]);

  const runExploreDestinations = useCallback(
    (brief: TripBrief, locale: "tr" | "en", region: "europe" | "any") => {
      const origin = brief.originAirportCode;
      if (!origin) return false;
      pendingExploreRef.current = null;
      enqueueBackgroundSearch(
        { type: "explore_destinations", args: { origin, region } },
        brief,
        locale
      );
      return true;
    },
    [enqueueBackgroundSearch]
  );

  // `immediatePatch` is applied to the brief used for THIS turn — a dispatch
  // alone wouldn't be visible yet (stateRef only catches up after render), so
  // card selections would otherwise search with a stale brief.
  const sendUserTurn = useCallback(
    async (turn: UserTurn, immediatePatch?: Partial<TripBrief>) => {
      if (isBusyRef.current) {
        pendingTurnRef.current = { turn, patch: immediatePatch };
        return;
      }
      isBusyRef.current = true;

      if (immediatePatch) {
        stateRef.current = {
          ...stateRef.current,
          brief: mergeBriefPatch(stateRef.current.brief, immediatePatch),
        };
        markAnsweredTopicsFromPatch(answeredTopicsRef.current, immediatePatch);
      }
      closeOpenStep();

      const locale = resolveLocale(lastUserTextFromTurn(turn), turn.kind === "text");

      dispatch({ type: "USER_TURN_ADDED", turn });
      dispatch({ type: "STATUS_CHANGED", status: "awaiting_model", activity: "thinking" });

      const snapshot = stateRef.current;
      let nextBrief = immediatePatch
        ? mergeBriefPatch(snapshot.brief, immediatePatch)
        : snapshot.brief;
      // snapshot.brief already includes immediatePatch when we merged into stateRef above
      if (immediatePatch) nextBrief = snapshot.brief;
      const contents: GeminiContent[] = buildModelContents([
        ...snapshot.messages,
        { id: "pending", role: "user", turn, createdAt: Date.now() },
      ]);

      try {
        // Hard ceiling so a hung network read can never leave the composer disabled.
        await withTimeout(runTurnCycle(contents, nextBrief), GEMINI_TURN_BUDGET_MS, "Chat turn");

        async function runTurnCycle(
          cycleContents: GeminiContent[],
          brief: TripBrief
        ): Promise<void> {
          const systemPrompt = buildSystemPrompt(brief.onboarding, brief, locale);
          const modelResponse = await generateStructuredTurn(systemPrompt, cycleContents);

          const safePatch = sanitizeBriefPatchForUserTurn(modelResponse.briefPatch, turn);
          const briefBeforePatch = brief;
          if (Object.keys(safePatch).length > 0) {
            dispatch({ type: "BRIEF_PATCHED", patch: safePatch });
            markAnsweredTopicsFromPatch(answeredTopicsRef.current, safePatch);
            nextBrief = mergeBriefPatch(brief, safePatch);
          } else {
            nextBrief = brief;
          }

          // Destination / date pivot — drop stale logistics and re-search.
          const revision = revisionPatch(briefBeforePatch, nextBrief);
          let forcedRevisionSearch = false;
          if (Object.keys(revision).length > 0) {
            dispatch({ type: "BRIEF_PATCHED", patch: revision });
            nextBrief = mergeBriefPatch(nextBrief, revision);
            stateRef.current = { ...stateRef.current, brief: nextBrief };
            for (const id of revisionTopicIdsToForget(revision)) {
              askedTopicsRef.current.delete(id);
              answeredTopicsRef.current.delete(id);
            }
            logisticsFanoutDoneRef.current = false;
            hotelFanoutDoneRef.current = false;
            experienceFanoutDoneRef.current = false;
            forcedRevisionSearch = true;
            const destLabel = nextBrief.destination ?? "…";
            emitAssistantTurn({
              kind: "text",
              text:
                locale === "tr"
                  ? `${destLabel}'a çeviriyorum — uçuşları baştan arıyorum.`
                  : `Switching to ${destLabel} — searching flights again.`,
            });
          }

          const topicSkip = [...askedTopicsRef.current, ...answeredTopicsRef.current];
          const normalizedTurn = normalizeAssistantTurn(
            modelResponse.turn,
            nextBrief,
            locale,
            topicSkip
          );

          // Whatever the model just asked counts as asked — no second round of it.
          // Essentials stay re-askable only if not already answered by the user.
          if (normalizedTurn.kind === "suggestions") {
            const topicId = chipsForNextTopic(nextBrief, locale, topicSkip).topicId;
            if (
              topicId &&
              !ESSENTIAL_TOPIC_IDS.has(topicId) &&
              !answeredTopicsRef.current.has(topicId)
            ) {
              askedTopicsRef.current.add(topicId);
            }
          }

          const assistantTurn =
            normalizedTurn.kind === "image"
              ? {
                  ...normalizedTurn,
                  prompt: anchorImagePrompt(normalizedTurn.prompt, nextBrief),
                }
              : normalizedTurn;

          if (assistantTurn.kind === "question") {
            lastSelectableListRef.current = null;
          }

          let fannedOut = maybeRunReadySearches(nextBrief, locale);

          if (
            forcedRevisionSearch &&
            !fannedOut &&
            readyToSearchFlights(nextBrief) &&
            !nextBrief.chosenFlight
          ) {
            logisticsFanoutDoneRef.current = true;
            enqueueBackgroundSearch(
              {
                type: "search_flights",
                args: {
                  origin: nextBrief.originAirportCode,
                  destination: nextBrief.destinationAirportCode ?? nextBrief.destination,
                  startDate: nextBrief.startDate,
                  endDate: nextBrief.endDate,
                },
              },
              nextBrief,
              locale,
              true
            );
            fannedOut = true;
          }

          // Never run date/flight searches before destination + origin are known.
          let action: ModelAction | null = modelResponse.action;
          if (
            forcedRevisionSearch &&
            action &&
            (action.type === "search_flights" || action.type === "search_hotels")
          ) {
            // We already queued a fresh search — ignore the model's duplicate.
            action = null;
          }
          if (
            action &&
            (action.type === "search_flexible_dates" || action.type === "search_flights") &&
            !canOfferDateChips(nextBrief)
          ) {
            action = null;
          }
          // Fan-out already queued flights/hotels/places — don't duplicate.
          if (
            fannedOut &&
            action &&
            (action.type === "search_flights" ||
              action.type === "search_hotels" ||
              action.type === "search_places")
          ) {
            action = null;
          }

          const allowResearch = forceResearchRef.current;
          forceResearchRef.current = false;
          if (action?.type === "search_flights" && nextBrief.chosenFlight && !allowResearch) {
            action = null;
          }
          if (action?.type === "search_hotels" && nextBrief.chosenHotel && !allowResearch) {
            action = null;
          }

          // Preference gates — ask the missing topic instead of searching early.
          let blockedByPrefs = false;
          if (
            action?.type === "search_flights" &&
            !readyToSearchFlights(nextBrief) &&
            !allowResearch
          ) {
            action = null;
            blockedByPrefs = true;
          }
          if (
            action?.type === "search_hotels" &&
            !readyToSearchHotels(nextBrief) &&
            !allowResearch
          ) {
            action = null;
            blockedByPrefs = true;
          }
          if (
            action &&
            (action.type === "search_places" ||
              action.type === "search_day_plan" ||
              action.type === "search_events") &&
            !readyToSearchExperiences(nextBrief) &&
            !allowResearch
          ) {
            action = null;
            blockedByPrefs = true;
          }

          const cardSearchIncoming = fannedOut || isCardSearchAction(action);

          // One interactive step at a time: if cards are about to land, don't also
          // put checklist chips on screen in the same breath.
          // On forced revision we already emitted an ack — skip stacking more questions.
          if (forcedRevisionSearch) {
            // keep the revision ack only
          } else if (cardSearchIncoming && turnAsksAQuestion(assistantTurn)) {
            const bridgeText =
              assistantTurn.kind === "question"
                ? assistantTurn.text
                : assistantTurn.kind === "suggestions"
                  ? (assistantTurn.prompt ?? "")
                  : "";
            if (bridgeText.trim()) {
              emitAssistantTurn({ kind: "text", text: bridgeText.trim() });
            }
          } else {
            emitAssistantTurn(assistantTurn);
          }

          // Fire SerpAPI in the background — do not block the composer.
          if (action) {
            enqueueBackgroundSearch(action, nextBrief, locale, allowResearch);
          }

          // Only ask the next checklist topic when this turn didn't already open a step
          // (chips or a card search) — or when we blocked a search for missing prefs.
          if (
            !forcedRevisionSearch &&
            (blockedByPrefs || (!cardSearchIncoming && !turnAsksAQuestion(assistantTurn)))
          ) {
            enqueueNextTopic();
          }

          maybeOfferReview(nextBrief);
        }

        function maybeOfferReview(brief: TripBrief) {
          if (!isReadyForReview(brief) || readyForReviewRef.current || !brief.chosenFlight) {
            return;
          }
          if (brief.planningMode !== "youtube" && !brief.chosenHotel) return;
          emitAssistantTurn({
            kind: "suggestions",
            chips: [
              {
                id: "review-plan",
                label: locale === "tr" ? "Planı gözden geçir" : "Review my plan",
              },
            ],
          });
        }
      } catch (error) {
        console.warn("[useTravelChatEngine] sendUserTurn failed:", error);
        enqueueNextTopic(creativeSnag(locale));
      } finally {
        // Always clear busy + return to idle so the shimmer can never stick and
        // the user can keep chatting after any failure. Searches keep running in bg.
        isBusyRef.current = false;
        dispatch({ type: "STATUS_CHANGED", status: "idle" });

        const queued = pendingTurnRef.current;
        if (queued) {
          pendingTurnRef.current = null;
          sendUserTurnRef.current?.(queued.turn, queued.patch);
        }
      }
    },
    [
      closeOpenStep,
      emitAssistantTurn,
      enqueueBackgroundSearch,
      enqueueNextTopic,
      maybeRunReadySearches,
      resolveLocale,
    ]
  );

  useEffect(() => {
    sendUserTurnRef.current = (turn, patch) => void sendUserTurn(turn, patch);
  }, [sendUserTurn]);

  const selectFlight = useCallback(
    (flight: FlightOption) => {
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      const skipFlightTopics = flightTopicsToSkipAfterSelection(stateRef.current.brief);
      const flightTopicIds = new Set<string>([
        ...FLIGHT_PREF_TOPIC_IDS,
        ...OPTIONAL_FLIGHT_TOPIC_IDS,
      ]);
      const patch = {
        chosenFlight: flight,
        ...(skipFlightTopics.length > 0
          ? {
              skippedTopics: [...(stateRef.current.brief.skippedTopics ?? []), ...skipFlightTopics],
            }
          : {}),
      };
      const nextBrief = mergeBriefPatch(stateRef.current.brief, patch);
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      for (const id of skipFlightTopics) {
        answeredTopicsRef.current.add(id);
        askedTopicsRef.current.add(id);
      }
      dispatch({ type: "BRIEF_PATCHED", patch });
      dispatch({
        type: "USER_TURN_ADDED",
        turn: {
          kind: "card_selection",
          cardKind: "flight",
          optionId: flight.id,
          label: `${flight.airline} · ${flight.departureAirport}→${flight.arrivalAirport} · $${flight.priceUSD}`,
        },
      });
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter((step) => {
        if (step.kind === "next_topic") return false;
        if (step.kind === "turn" && step.turn.kind === "flight_options") return false;
        if (step.kind === "turn" && step.topicId && flightTopicIds.has(step.topicId)) return false;
        return true;
      });
      flushQueue();
      if (nextBrief.planningMode === "youtube" && isReadyForReview(nextBrief)) {
        emitAssistantTurn({
          kind: "text",
          text:
            locale === "tr"
              ? "Uçuş seçildi — videodaki rota planını hazırlayabilirim."
              : "Flight locked — I can build the plan from the video route.",
        });
        emitAssistantTurn({
          kind: "suggestions",
          chips: [
            {
              id: "review-plan",
              label: locale === "tr" ? "Planı gözden geçir" : "Review my plan",
            },
          ],
        });
        return;
      }
      if (!maybeRunReadySearches(nextBrief, locale)) {
        enqueueNextTopic();
      }
    },
    [emitAssistantTurn, enqueueNextTopic, flushQueue, maybeRunReadySearches]
  );

  const selectHotel = useCallback(
    (hotel: HotelOption) => {
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      const skipHotelTopics = hotelTopicsToSkipAfterSelection(stateRef.current.brief);
      const hotelTopicIds = new Set<string>([...HOTEL_PREF_TOPIC_IDS, ...OPTIONAL_HOTEL_TOPIC_IDS]);
      const patch = {
        chosenHotel: hotel,
        ...(skipHotelTopics.length > 0
          ? {
              skippedTopics: [...(stateRef.current.brief.skippedTopics ?? []), ...skipHotelTopics],
            }
          : {}),
      };
      const nextBrief = mergeBriefPatch(stateRef.current.brief, patch);
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      for (const id of skipHotelTopics) {
        answeredTopicsRef.current.add(id);
        askedTopicsRef.current.add(id);
      }
      dispatch({ type: "BRIEF_PATCHED", patch });
      dispatch({
        type: "USER_TURN_ADDED",
        turn: {
          kind: "card_selection",
          cardKind: "hotel",
          optionId: hotel.id,
          label: hotel.pricePerNightUSD
            ? `${hotel.name} · $${hotel.pricePerNightUSD}/night`
            : hotel.name,
        },
      });
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter((step) => {
        if (step.kind === "next_topic") return false;
        if (step.kind === "turn" && step.turn.kind === "hotel_options") return false;
        if (step.kind === "turn" && step.topicId && hotelTopicIds.has(step.topicId)) return false;
        return true;
      });
      flushQueue();
      if (!maybeRunReadySearches(nextBrief, locale)) {
        enqueueNextTopic();
      }
    },
    [enqueueNextTopic, flushQueue, maybeRunReadySearches]
  );

  const selectDestination = useCallback(
    (destination: DestinationOption) => {
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      awaitingTypedAnswerRef.current = null;
      pendingExploreRef.current = null;
      const patch = {
        destination: destination.name,
        destinationAirportCode: destination.airportCode,
        destinationThumbnailUrl: destination.thumbnailUrl,
      };
      const nextBrief = mergeBriefPatch(stateRef.current.brief, patch);
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      answeredTopicsRef.current.add("destination");
      askedTopicsRef.current.add("destination");
      dispatch({ type: "BRIEF_PATCHED", patch });
      dispatch({
        type: "USER_TURN_ADDED",
        turn: {
          kind: "card_selection",
          cardKind: "destination",
          optionId: destination.id,
          label: destination.name,
        },
      });
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter(
        (step) =>
          !(step.kind === "turn" && step.turn.kind === "destination_inspiration") &&
          step.kind !== "next_topic"
      );
      flushQueue();
      if (!maybeRunReadySearches(nextBrief, locale)) {
        enqueueNextTopic();
      }
    },
    [enqueueNextTopic, flushQueue, maybeRunReadySearches]
  );

  const selectDateOption = useCallback(
    (option: DateOption) => {
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      answeredTopicsRef.current.add("dates");
      askedTopicsRef.current.add("dates");
      const patch = { startDate: option.startDate, endDate: option.endDate };
      const nextBrief = mergeBriefPatch(stateRef.current.brief, patch);
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      dispatch({ type: "BRIEF_PATCHED", patch });
      dispatch({
        type: "USER_TURN_ADDED",
        turn: {
          kind: "card_selection",
          cardKind: "date",
          optionId: option.id,
          label: `${formatShortDate(option.startDate)} – ${formatShortDate(option.endDate)}${
            option.priceUSD ? ` · $${option.priceUSD}` : ""
          }`,
        },
      });
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter(
        (step) =>
          !(step.kind === "turn" && step.turn.kind === "date_options") && step.kind !== "next_topic"
      );
      flushQueue();
      if (!maybeRunReadySearches(nextBrief, locale)) {
        enqueueNextTopic();
      }
    },
    [enqueueNextTopic, flushQueue, maybeRunReadySearches]
  );

  /** Confirmed from the calendar sheet — dates land in the brief; flights follow if ready. */
  const selectDateRange = useCallback(
    (startDate: string, endDate: string) => {
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      answeredTopicsRef.current.add("dates");
      askedTopicsRef.current.add("dates");
      const patch = { startDate, endDate };
      const nextBrief = mergeBriefPatch(stateRef.current.brief, patch);
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      dispatch({ type: "BRIEF_PATCHED", patch });
      dispatch({
        type: "USER_TURN_ADDED",
        turn: { kind: "chip_selection", chipId: "date-range", label: `${startDate} → ${endDate}` },
      });
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
      flushQueue();
      if (!maybeRunReadySearches(nextBrief, locale)) {
        enqueueNextTopic();
      }
    },
    [enqueueNextTopic, flushQueue, maybeRunReadySearches]
  );

  const selectPlace = useCallback(
    (place: PlaceOption) => {
      dispatch({
        type: "USER_TURN_ADDED",
        turn: {
          kind: "card_selection",
          cardKind: "place",
          optionId: place.id,
          label: place.name,
        },
      });
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter(
        (step) =>
          !(step.kind === "turn" && step.turn.kind === "places") && step.kind !== "next_topic"
      );
      flushQueue();
      enqueueNextTopic();
    },
    [enqueueNextTopic, flushQueue]
  );

  const selectDayPlanPlace = useCallback(
    (slotId: DayPlanSlot["id"], place: PlaceOption) => {
      const brief = stateRef.current.brief;
      const selections = { ...(brief.dayPlanSelections ?? {}), [slotId]: place };
      const patch = { dayPlanSelections: selections };
      const nextBrief = mergeBriefPatch(brief, patch);
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      dispatch({ type: "BRIEF_PATCHED", patch });
      dispatch({
        type: "USER_TURN_ADDED",
        turn: {
          kind: "card_selection",
          cardKind: "place",
          optionId: place.id,
          label: `${slotId}: ${place.name}`,
        },
      });

      const complete = Boolean(selections.morning && selections.afternoon && selections.evening);
      if (!complete) return;

      answeredTopicsRef.current.add("day_plan");
      askedTopicsRef.current.add("day_plan");
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter(
        (step) =>
          !(step.kind === "turn" && step.turn.kind === "day_plan") && step.kind !== "next_topic"
      );
      flushQueue();
      enqueueNextTopic();
    },
    [enqueueNextTopic, flushQueue]
  );

  const refreshDayPlanSlot = useCallback(
    (slotId: DayPlanSlot["id"]) => {
      const brief = stateRef.current.brief;
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      const selections = { ...(brief.dayPlanSelections ?? {}) };
      delete selections[slotId];
      const patch = { dayPlanSelections: selections };
      stateRef.current = { ...stateRef.current, brief: mergeBriefPatch(brief, patch) };
      dispatch({ type: "BRIEF_PATCHED", patch });
      enqueueBackgroundSearch(
        { type: "search_day_plan", args: { destination: brief.destination } },
        stateRef.current.brief,
        locale,
        true
      );
    },
    [enqueueBackgroundSearch]
  );

  const finishDayPlanEarly = useCallback(() => {
    answeredTopicsRef.current.add("day_plan");
    askedTopicsRef.current.add("day_plan");
    const brief = stateRef.current.brief;
    const skipPatch = brief.skippedTopics?.includes("day_plan")
      ? {}
      : { skippedTopics: [...(brief.skippedTopics ?? []), "day_plan"] };
    if (Object.keys(skipPatch).length > 0) {
      const nextBrief = mergeBriefPatch(brief, skipPatch);
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      dispatch({ type: "BRIEF_PATCHED", patch: skipPatch });
    }
    openStepRef.current = null;
    stepQueueRef.current = stepQueueRef.current.filter(
      (step) =>
        !(step.kind === "turn" && step.turn.kind === "day_plan") && step.kind !== "next_topic"
    );
    flushQueue();
    enqueueNextTopic();
  }, [enqueueNextTopic, flushQueue]);

  const applyTypedDestination = useCallback(
    (raw: string) => {
      const destination = raw.trim();
      if (!destination || isVagueDestination(destination)) {
        if (destination && isVagueDestination(destination)) {
          const locale = localeRef.current ?? stateRef.current.locale ?? "en";
          dispatch({ type: "USER_TURN_ADDED", turn: { kind: "text", text: destination } });
          emitAssistantTurn({
            kind: "text",
            text:
              locale === "tr"
                ? "Bir şehir adı yazman yeterli — örneğin Amsterdam veya Lisbon."
                : "Just type a city name — for example Amsterdam or Lisbon.",
          });
        }
        return;
      }
      awaitingTypedAnswerRef.current = null;
      const before = stateRef.current.brief;
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      let nextBrief = mergeBriefPatch(before, { destination });
      const revision = revisionPatch(before, nextBrief);
      if (Object.keys(revision).length > 0) {
        nextBrief = mergeBriefPatch(nextBrief, revision);
        for (const id of revisionTopicIdsToForget(revision)) {
          askedTopicsRef.current.delete(id);
          answeredTopicsRef.current.delete(id);
        }
        logisticsFanoutDoneRef.current = false;
        hotelFanoutDoneRef.current = false;
        experienceFanoutDoneRef.current = false;
      }
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      answeredTopicsRef.current.add("destination");
      askedTopicsRef.current.add("destination");
      dispatch({ type: "BRIEF_PATCHED", patch: { destination, ...revision } });
      dispatch({ type: "USER_TURN_ADDED", turn: { kind: "text", text: destination } });
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
      flushQueue();

      if (
        Object.keys(revision).length > 0 &&
        readyToSearchFlights(nextBrief) &&
        !nextBrief.chosenFlight
      ) {
        emitAssistantTurn({
          kind: "text",
          text:
            locale === "tr"
              ? `${destination}'a çeviriyorum — uçuşları baştan arıyorum.`
              : `Switching to ${destination} — searching flights again.`,
        });
        logisticsFanoutDoneRef.current = true;
        enqueueBackgroundSearch(
          {
            type: "search_flights",
            args: {
              origin: nextBrief.originAirportCode,
              destination: nextBrief.destinationAirportCode ?? nextBrief.destination,
              startDate: nextBrief.startDate,
              endDate: nextBrief.endDate,
            },
          },
          nextBrief,
          locale,
          true
        );
      } else {
        enqueueNextTopic();
      }

      // Resolve IATA in the background so later flight search has a code.
      void resolveAirportCode(destination).then((code) => {
        if (!code) return;
        const airportPatch = { destinationAirportCode: code };
        dispatch({ type: "BRIEF_PATCHED", patch: airportPatch });
        stateRef.current = {
          ...stateRef.current,
          brief: mergeBriefPatch(stateRef.current.brief, airportPatch),
        };
      });
    },
    [emitAssistantTurn, enqueueBackgroundSearch, enqueueNextTopic, flushQueue]
  );

  const applyTypedOrigin = useCallback(
    async (raw: string) => {
      const query = raw.trim();
      if (!query) return;
      awaitingTypedAnswerRef.current = null;
      dispatch({ type: "USER_TURN_ADDED", turn: { kind: "text", text: query } });
      dispatch({ type: "STATUS_CHANGED", status: "awaiting_model", activity: "thinking" });
      const code = (await resolveAirportCode(query)) ?? query.toUpperCase().slice(0, 3);
      const patch = { originAirportCode: code };
      const nextBrief = mergeBriefPatch(stateRef.current.brief, patch);
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      answeredTopicsRef.current.add("origin");
      askedTopicsRef.current.add("origin");
      dispatch({ type: "BRIEF_PATCHED", patch });
      dispatch({ type: "STATUS_CHANGED", status: "idle" });
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
      flushQueue();
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      const pending = pendingExploreRef.current;
      if (pending && runExploreDestinations(nextBrief, locale, pending)) {
        return;
      }
      enqueueNextTopic();
    },
    [enqueueNextTopic, flushQueue, runExploreDestinations]
  );

  const applyTypedBudget = useCallback(
    (raw: string) => {
      const budgetTotalUSD = parseBudgetUsd(raw);
      if (budgetTotalUSD === undefined) {
        awaitingTypedAnswerRef.current = null;
        void sendUserTurn({ kind: "text", text: raw });
        return;
      }
      awaitingTypedAnswerRef.current = null;
      const patch = { budgetTotalUSD };
      const nextBrief = mergeBriefPatch(stateRef.current.brief, patch);
      stateRef.current = { ...stateRef.current, brief: nextBrief };
      answeredTopicsRef.current.add("budget");
      askedTopicsRef.current.add("budget");
      dispatch({ type: "BRIEF_PATCHED", patch });
      dispatch({ type: "USER_TURN_ADDED", turn: { kind: "text", text: raw.trim() } });
      openStepRef.current = null;
      stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
      flushQueue();
      enqueueNextTopic();
    },
    [enqueueNextTopic, flushQueue, sendUserTurn]
  );

  const ingestYouTubeLink = useCallback(
    async (rawUrl: string) => {
      if (isBusyRef.current) {
        pendingTurnRef.current = { turn: { kind: "text", text: rawUrl } };
        return;
      }
      isBusyRef.current = true;

      const existingLocale = localeRef.current ?? stateRef.current.locale;
      let locale: Locale = existingLocale ?? "tr";
      const onboarding = stateRef.current.brief.onboarding;

      // Replace any in-progress plan with a fresh YouTube-sourced plan.
      const resetPatch = youtubePlanResetPatch(onboarding);
      stateRef.current = {
        ...stateRef.current,
        brief: mergeBriefPatch(initialTripBrief(onboarding), resetPatch),
      };
      askedTopicsRef.current = new Set();
      answeredTopicsRef.current = new Set();
      logisticsFanoutDoneRef.current = false;
      hotelFanoutDoneRef.current = false;
      experienceFanoutDoneRef.current = false;
      awaitingTypedAnswerRef.current = null;
      pendingExploreRef.current = null;
      openStepRef.current = null;
      stepQueueRef.current = [];
      lastSelectableListRef.current = null;
      dispatch({ type: "BRIEF_PATCHED", patch: resetPatch });

      dispatch({ type: "USER_TURN_ADDED", turn: { kind: "text", text: rawUrl } });
      dispatch({ type: "STATUS_CHANGED", status: "awaiting_model", activity: "youtube" });
      bumpSearchActivity("youtube");

      try {
        const ingest = await ingestYouTubeUrl(rawUrl, {
          // A bare URL has no language signal. Try Turkish first, then the ingest
          // layer falls back to English if that transcript is unavailable.
          languageCode: existingLocale ?? "tr",
        });
        if (!existingLocale) {
          locale =
            ingest.transcript?.languageCode === "tr"
              ? "tr"
              : detectReplyLocale(ingest.analysisText);
          localeRef.current = locale;
          dispatch({ type: "LOCALE_LOCKED", locale });
        }
        const source = youtubeSourceFromIngest(ingest);

        emitAssistantTurn({
          kind: "youtube_video",
          videoId: source.videoId,
          url: source.url,
          title: source.title,
          thumbnailUrl: source.thumbnailUrl,
          channelName: source.channelName,
        });

        const analysis = await analyzeYouTubeTravelSource({
          analysisText: ingest.analysisText,
          textSource: ingest.textSource,
          locale,
        });

        if (!analysis.isTravelRelated || !analysis.destination) {
          emitAssistantTurn({
            kind: "text",
            text:
              locale === "tr"
                ? "Bu video net bir seyahat rotası gibi durmuyor. Başka bir gezi videosu yapıştırabilir veya şehri yazabilirsin."
                : "This doesn’t look like a clear travel video. Paste another trip video or tell me the city.",
          });
          emitAssistantTurn({
            kind: "suggestions",
            chips: [
              {
                id: "dest-type",
                label: locale === "tr" ? "Şehir yazacağım" : "I’ll type a city",
                description:
                  locale === "tr" ? "Normal planlamaya dön" : "Switch to normal planning",
                emoji: "✏",
              },
            ],
          });
          dispatch({
            type: "BRIEF_PATCHED",
            patch: { planningMode: undefined, youtubeSource: source, youtubeAnalysis: analysis },
          });
          return;
        }

        const placeOptions = await resolveYouTubePlaces(analysis, analysis.destination);
        const patch = {
          ...briefPatchFromYouTubeAnalysis(analysis, source, onboarding),
          shownPlaceOptions: placeOptions,
        };
        const nextBrief = mergeBriefPatch(stateRef.current.brief, patch);
        stateRef.current = { ...stateRef.current, brief: nextBrief };
        answeredTopicsRef.current.add("destination");
        askedTopicsRef.current.add("destination");
        for (const id of YOUTUBE_SKIP_TOPIC_IDS) {
          answeredTopicsRef.current.add(id);
          askedTopicsRef.current.add(id);
        }
        markAnsweredTopicsFromPatch(answeredTopicsRef.current, patch);
        dispatch({ type: "BRIEF_PATCHED", patch });

        // Resolve IATA in the background so flight search has a destination code.
        void resolveAirportCode(analysis.destination).then((code) => {
          if (!code) return;
          const airportPatch = { destinationAirportCode: code };
          dispatch({ type: "BRIEF_PATCHED", patch: airportPatch });
          stateRef.current = {
            ...stateRef.current,
            brief: mergeBriefPatch(stateRef.current.brief, airportPatch),
          };
        });
        void ensureDestinationGeo({
          ...nextBrief,
          destination: analysis.destination,
        }).then((geoPatch) => {
          if (!geoPatch || Object.keys(geoPatch).length === 0) return;
          dispatch({ type: "BRIEF_PATCHED", patch: geoPatch });
          stateRef.current = {
            ...stateRef.current,
            brief: mergeBriefPatch(stateRef.current.brief, geoPatch),
          };
        });

        // Refresh the video card with extracted place names.
        emitAssistantTurn({
          kind: "youtube_video",
          videoId: source.videoId,
          url: source.url,
          title: source.title,
          thumbnailUrl: source.thumbnailUrl,
          channelName: source.channelName,
          placeNames: analysis.places
            .filter((place) => place.sentiment !== "negative")
            .map((place) => place.name)
            .slice(0, 8),
          summary: analysis.summary,
        });

        const placeCount = analysis.places.filter((place) => place.sentiment !== "negative").length;
        emitAssistantTurn({
          kind: "text",
          text:
            locale === "tr"
              ? `${analysis.destination} için videodan ${placeCount} mekan çıkardım. Uçuş için sadece birkaç bilgi kaldı.`
              : `I pulled ${placeCount} places for ${analysis.destination} from the video. Just a few flight details left.`,
        });

        enqueueNextTopic();
      } catch (error) {
        console.warn("[useTravelChatEngine] YouTube ingest failed:", error);
        emitAssistantTurn({
          kind: "text",
          text:
            locale === "tr"
              ? "Videoyu okuyamadım. Linki kontrol edip tekrar dener misin?"
              : "I couldn’t read that video. Check the link and try again?",
        });
      } finally {
        bumpSearchActivity(undefined);
        isBusyRef.current = false;
        dispatch({ type: "STATUS_CHANGED", status: "idle" });
        const queued = pendingTurnRef.current;
        if (queued) {
          pendingTurnRef.current = null;
          sendUserTurnRef.current?.(queued.turn, queued.patch);
        }
      }
    },
    [bumpSearchActivity, emitAssistantTurn, enqueueNextTopic]
  );

  const sendText = useCallback(
    (text: string) => {
      const list = lastSelectableListRef.current;
      const index = list ? resolveNumberSelection(text, list) : null;

      if (list && index !== null) {
        const option = list.options[index];
        lastSelectableListRef.current = null; // consumed — a bare number shouldn't re-resolve against a stale list
        switch (list.kind) {
          case "flight":
            selectFlight(option as FlightOption);
            return;
          case "hotel":
            selectHotel(option as HotelOption);
            return;
          case "place":
            selectPlace(option as PlaceOption);
            return;
          case "destination":
            selectDestination(option as DestinationOption);
            return;
          case "date":
            selectDateOption(option as DateOption);
            return;
        }
      }

      const awaiting = awaitingTypedAnswerRef.current;
      const brief = stateRef.current.brief;
      const trimmed = text.trim();

      // YouTube URL — replace the current plan and drive a video-first flow.
      if (isYouTubeUrl(trimmed)) {
        void ingestYouTubeLink(trimmed);
        return;
      }

      if (brief.dayPlanShown && isDayPlanDonePhrase(trimmed)) {
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "text", text: trimmed } });
        finishDayPlanEarly();
        return;
      }

      // First message with no destination yet — skip Gemini and ask where to go.
      const isFirstUserMessage = !stateRef.current.messages.some(
        (message) => message.role === "user"
      );
      if (
        isFirstUserMessage &&
        !brief.destination &&
        !brief.destinationAirportCode &&
        !looksLikeTypedPlaceName(trimmed)
      ) {
        resolveLocale(trimmed, true);
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "text", text: trimmed } });
        openStepRef.current = null;
        stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
        flushQueue();
        enqueueNextTopic();
        return;
      }

      // Late free-text intents — bypass preference gates when the user asks explicitly.
      const intent = detectChatIntent(trimmed);
      if (intent && brief.destination) {
        const locale = localeRef.current ?? stateRef.current.locale ?? "en";
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "text", text: trimmed } });
        openStepRef.current = null;
        stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
        flushQueue();

        if (intent === "day_plan") {
          askedTopicsRef.current.delete("day_plan");
          answeredTopicsRef.current.delete("day_plan");
          enqueueBackgroundSearch(
            { type: "search_day_plan", args: { destination: brief.destination } },
            brief,
            locale,
            Boolean(brief.dayPlanShown)
          );
          return;
        }
        if (intent === "restaurants") {
          askedTopicsRef.current.delete("restaurants");
          answeredTopicsRef.current.delete("restaurants");
          enqueueBackgroundSearch(
            {
              type: "search_places",
              args: { destination: brief.destination, category: "restaurants" },
            },
            brief,
            locale,
            Boolean(brief.restaurantsShown)
          );
          return;
        }
        if (intent === "attractions") {
          askedTopicsRef.current.delete("attractions");
          answeredTopicsRef.current.delete("attractions");
          enqueueBackgroundSearch(
            {
              type: "search_places",
              args: { destination: brief.destination, category: "attractions" },
            },
            brief,
            locale,
            Boolean(brief.attractionsShown)
          );
          return;
        }
        if (intent === "events") {
          askedTopicsRef.current.delete("events");
          answeredTopicsRef.current.delete("events");
          enqueueBackgroundSearch(
            { type: "search_events", args: { destination: brief.destination } },
            brief,
            locale,
            Boolean(brief.eventsShown)
          );
          return;
        }
        if (intent === "other_flights") {
          forceResearchRef.current = true;
          enqueueBackgroundSearch(
            {
              type: "search_flights",
              args: {
                origin: brief.originAirportCode,
                destination: brief.destinationAirportCode ?? brief.destination,
                startDate: brief.startDate,
                endDate: brief.endDate,
              },
            },
            brief,
            locale,
            true
          );
          return;
        }
        if (intent === "other_hotels") {
          forceResearchRef.current = true;
          enqueueBackgroundSearch(
            {
              type: "search_hotels",
              args: {
                destination: brief.destination,
                startDate: brief.startDate,
                endDate: brief.endDate,
              },
            },
            brief,
            locale,
            true
          );
          return;
        }
        if (intent === "review_plan" || intent === "create_plan") {
          if (!isDayPlanSettled(brief)) {
            askedTopicsRef.current.delete("day_plan");
            answeredTopicsRef.current.delete("day_plan");
            emitAssistantTurn({
              kind: "text",
              text:
                locale === "tr"
                  ? "Önce gün planını tamamlayalım — sonra planı bir araya getiririm."
                  : "Let's finish the day plan first — then I'll put the trip together.",
            });
            enqueueBackgroundSearch(
              { type: "search_day_plan", args: { destination: brief.destination } },
              brief,
              locale,
              Boolean(brief.dayPlanShown)
            );
            return;
          }
          void sendUserTurn({ kind: "text", text: trimmed });
          return;
        }
      }

      if (
        awaiting === "destination" ||
        (!brief.destination && !brief.destinationAirportCode && looksLikeTypedPlaceName(trimmed))
      ) {
        applyTypedDestination(trimmed);
        return;
      }
      if (awaiting === "origin") {
        void applyTypedOrigin(trimmed);
        return;
      }
      if (awaiting === "budget") {
        applyTypedBudget(trimmed);
        return;
      }
      if (awaiting) {
        // Optional topic "I'll type it" — one model turn with their free text is fine.
        awaitingTypedAnswerRef.current = null;
        void sendUserTurn({ kind: "text", text: trimmed });
        return;
      }

      void sendUserTurn({ kind: "text", text });
    },
    [
      sendUserTurn,
      selectFlight,
      selectHotel,
      selectPlace,
      selectDestination,
      selectDateOption,
      applyTypedDestination,
      applyTypedOrigin,
      applyTypedBudget,
      finishDayPlanEarly,
      enqueueBackgroundSearch,
      emitAssistantTurn,
      flushQueue,
      enqueueNextTopic,
      resolveLocale,
      ingestYouTubeLink,
    ]
  );

  const requestDayPlan = useCallback(() => {
    const brief = stateRef.current.brief;
    const locale = localeRef.current ?? stateRef.current.locale ?? "en";
    if (!brief.destination) {
      enqueueNextTopic();
      return;
    }
    askedTopicsRef.current.delete("day_plan");
    answeredTopicsRef.current.delete("day_plan");
    openStepRef.current = null;
    stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
    flushQueue();
    emitAssistantTurn({
      kind: "text",
      text:
        locale === "tr"
          ? "Önce gün planını tamamlayalım — sonra planı bir araya getiririm."
          : "Let's finish the day plan first — then I'll put the trip together.",
    });
    enqueueBackgroundSearch(
      { type: "search_day_plan", args: { destination: brief.destination } },
      brief,
      locale,
      Boolean(brief.dayPlanShown)
    );
  }, [emitAssistantTurn, enqueueBackgroundSearch, enqueueNextTopic, flushQueue]);

  const noteContext = useCallback((text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    dispatch({
      type: "ASSISTANT_TURN_ADDED",
      turn: { kind: "context_note", text: trimmed },
    });
  }, []);

  const selectChip = useCallback(
    (chipId: string, label: string) => {
      const brief = stateRef.current.brief;
      const locale = resolveLocale(label);
      const patch = briefPatchFromChip(chipId, label, brief);

      if (/^(another-flight|more-flights|baska-ucus|research-flights)/i.test(chipId)) {
        forceResearchRef.current = true;
      }

      // Premature date chips — never pretend dates were chosen.
      if (
        (chipId === "pick-dates" || chipId === "flexible" || chipId.startsWith("days-")) &&
        !canOfferDateChips(brief)
      ) {
        void sendUserTurn(
          {
            kind: "chip_selection",
            chipId,
            label: brief.destination
              ? label
              : `Önce destinasyon seçmek istiyorum (yanlışlıkla "${label}" çıktı)`,
          },
          patch
        );
        return;
      }

      // Ignore useless Continue/Devam — re-ask the real next topic instead.
      if (chipId === "continue" || /^devam$/i.test(label.trim())) {
        consumeOpenStep();
        enqueueNextTopic();
        return;
      }

      if (chipId.startsWith("retry-")) {
        consumeOpenStep();
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
        const liveBrief = stateRef.current.brief;
        let action: ModelAction | null = null;
        if (chipId === "retry-flights") {
          logisticsFanoutDoneRef.current = true;
          action = {
            type: "search_flights",
            args: {
              origin: liveBrief.originAirportCode,
              destination: liveBrief.destinationAirportCode ?? liveBrief.destination,
              startDate: liveBrief.startDate,
              endDate: liveBrief.endDate,
            },
          };
        } else if (chipId === "retry-hotels") {
          hotelFanoutDoneRef.current = true;
          action = {
            type: "search_hotels",
            args: {
              destination: liveBrief.destination,
              startDate: liveBrief.startDate,
              endDate: liveBrief.endDate,
            },
          };
        } else if (chipId === "retry-restaurants") {
          experienceFanoutDoneRef.current = true;
          action = {
            type: "search_places",
            args: { destination: liveBrief.destination, category: "restaurants" },
          };
        } else if (chipId === "retry-day-plan") {
          action = { type: "search_day_plan", args: { destination: liveBrief.destination } };
        }
        if (action) {
          enqueueBackgroundSearch(action, liveBrief, locale, true);
        }
        return;
      }

      // "Kendim yazarım" — no Gemini hop; just unlock the composer for free text.
      const typedTopic = typedAnswerTopicFromChip(chipId);
      if (typedTopic) {
        awaitingTypedAnswerRef.current = typedTopic;
        openStepRef.current = null;
        stepQueueRef.current = stepQueueRef.current.filter((step) => step.kind !== "next_topic");
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
        emitAssistantTurn({ kind: "text", text: typedAnswerPrompt(typedTopic, locale) });
        flushQueue();
        return;
      }

      // Region vibes — ask origin (if needed) then SerpAPI explore cards.
      if (chipId === "dest-europe" || chipId === "dest-surprise") {
        consumeOpenStep();
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
        const region = chipId === "dest-europe" ? "europe" : "any";
        pendingExploreRef.current = region;
        if (brief.originAirportCode) {
          runExploreDestinations(brief, locale, region);
          return;
        }
        askedTopicsRef.current.add("origin");
        const originTurn = buildTopicTurn("origin", brief, locale);
        if (originTurn) {
          emitAssistantTurn(
            { kind: "suggestions", prompt: originTurn.prompt, chips: originTurn.chips },
            "origin"
          );
        } else {
          enqueueNextTopic();
        }
        return;
      }

      // Origin chips while waiting to explore destinations.
      if (
        (chipId === "origin-ist" || chipId === "origin-ank" || chipId === "origin-ayt") &&
        patch?.originAirportCode
      ) {
        consumeOpenStep();
        const nextBrief = mergeBriefPatch(brief, patch);
        stateRef.current = { ...stateRef.current, brief: nextBrief };
        answeredTopicsRef.current.add("origin");
        askedTopicsRef.current.add("origin");
        dispatch({ type: "BRIEF_PATCHED", patch });
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
        const pending = pendingExploreRef.current;
        if (pending && runExploreDestinations(nextBrief, locale, pending)) {
          return;
        }
        enqueueNextTopic();
        return;
      }

      // "5 gün" is a complete answer: price those dates instead of asking again.
      if (chipId.startsWith("days-") && patch?.tripLengthDays) {
        consumeOpenStep();
        const nextBrief = mergeBriefPatch(brief, patch);
        stateRef.current = { ...stateRef.current, brief: nextBrief };
        dispatch({ type: "BRIEF_PATCHED", patch });
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
        askedTopicsRef.current.add("dates");
        answeredTopicsRef.current.add("dates");
        enqueueBackgroundSearch(
          {
            type: "search_flexible_dates",
            args: {
              origin: nextBrief.originAirportCode,
              destination: nextBrief.destinationAirportCode ?? nextBrief.destination,
              month: monthOf(nextBrief.startDate) ?? nextMonth(),
              tripLengthDays: patch.tripLengthDays,
            },
          },
          nextBrief,
          locale
        );
        // Date cards are the next step — don't also ask travelers/budget in parallel.
        return;
      }

      // Explicit "show me places" chips — user asked, so search immediately.
      if (chipId === "show-restaurants" || chipId === "show-attractions") {
        consumeOpenStep();
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
        const category: PlaceCategory =
          chipId === "show-restaurants" ? "restaurants" : "attractions";
        askedTopicsRef.current.add(category);
        answeredTopicsRef.current.add(category);
        enqueueBackgroundSearch(
          { type: "search_places", args: { destination: brief.destination, category } },
          brief,
          locale
        );
        return;
      }

      if (chipId === "show-day-plan") {
        consumeOpenStep();
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
        askedTopicsRef.current.add("day_plan");
        answeredTopicsRef.current.add("day_plan");
        enqueueBackgroundSearch(
          { type: "search_day_plan", args: { destination: brief.destination } },
          brief,
          locale
        );
        return;
      }

      if (chipId.startsWith("skip-") && patch) {
        consumeOpenStep();
        const nextBrief = mergeBriefPatch(brief, patch);
        stateRef.current = { ...stateRef.current, brief: nextBrief };
        dispatch({ type: "BRIEF_PATCHED", patch });
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
        enqueueNextTopic();
        return;
      }

      // Preference chips with a local patch — skip Gemini; advance checklist / searches.
      if (patch) {
        consumeOpenStep();
        const nextBrief = mergeBriefPatch(brief, patch);
        stateRef.current = { ...stateRef.current, brief: nextBrief };
        dispatch({ type: "BRIEF_PATCHED", patch });
        markAnsweredTopicsFromPatch(answeredTopicsRef.current, patch);
        dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
        if (!maybeRunReadySearches(nextBrief, locale)) {
          enqueueNextTopic();
        }
        return;
      }

      void sendUserTurn({ kind: "chip_selection", chipId, label }, patch);
    },
    [
      consumeOpenStep,
      emitAssistantTurn,
      enqueueBackgroundSearch,
      enqueueNextTopic,
      flushQueue,
      maybeRunReadySearches,
      resolveLocale,
      runExploreDestinations,
      sendUserTurn,
    ]
  );

  const prepareItinerary = useCallback(async () => {
    if (state.brief.itineraryDays && state.brief.itineraryDays.length > 0) {
      const enriched = enrichItineraryDays(
        state.brief.itineraryDays,
        state.brief.shownPlaceOptions
      );
      dispatch({ type: "BRIEF_PATCHED", patch: { itineraryDays: enriched } });
      return enriched;
    }
    try {
      const generated = await generateItinerary(state.brief);
      const days = enrichItineraryDays(generated, state.brief.shownPlaceOptions);
      dispatch({ type: "BRIEF_PATCHED", patch: { itineraryDays: days } });
      return days;
    } catch {
      return [];
    }
  }, [state.brief]);

  const reorderItineraryDays = useCallback((days: ItineraryDay[]) => {
    dispatch({ type: "BRIEF_PATCHED", patch: { itineraryDays: days } });
  }, []);

  const confirmPlan = useCallback(() => {
    const locale = localeRef.current ?? "en";
    const destination = state.brief.destination ?? (locale === "tr" ? "rotan" : "your destination");
    dispatch({ type: "BRIEF_PATCHED", patch: { status: "confirmed" } });
    dispatch({
      type: "ASSISTANT_TURN_ADDED",
      turn: {
        kind: "text",
        text:
          locale === "tr"
            ? `${destination} planın hazır — harika bir gezi olsun!`
            : `Your trip to ${destination} is locked in — have an amazing time!`,
      },
    });
    void inMemoryPersistenceAdapter.saveConversation(state.messages, {
      ...state.brief,
      status: "confirmed",
    });
  }, [state.brief, state.messages]);

  const announcePlanReady = useCallback(() => {
    const locale = localeRef.current ?? stateRef.current.locale ?? "en";
    emitAssistantTurn({ kind: "text", text: creativePlanReady(locale) });
    emitAssistantTurn({
      kind: "suggestions",
      prompt: locale === "tr" ? "Planı açmak ister misin?" : "Want to open the plan?",
      chips: [
        {
          id: "review-plan",
          label: locale === "tr" ? "Planı gözden geçir" : "Review my plan",
          description: locale === "tr" ? "Gün gün program" : "Day-by-day itinerary",
          emoji: "📋",
        },
      ],
    });
  }, [emitAssistantTurn]);

  /** Leave a user bubble + short ack so plan chips aren't silent in the transcript. */
  const acknowledgeChip = useCallback(
    (chipId: string, label: string) => {
      const locale = localeRef.current ?? stateRef.current.locale ?? "en";
      closeOpenStep();
      dispatch({ type: "USER_TURN_ADDED", turn: { kind: "chip_selection", chipId, label } });
      const ack =
        chipId === "create-travel-plan"
          ? locale === "tr"
            ? "Hepsini bir araya getiriyorum…"
            : "Putting it all together…"
          : locale === "tr"
            ? "Planını hazırlıyorum…"
            : "Building your plan…";
      emitAssistantTurn({ kind: "text", text: ack });
    },
    [closeOpenStep, emitAssistantTurn]
  );

  const locale = useMemo(() => {
    if (state.locale) return state.locale;
    for (let index = state.messages.length - 1; index >= 0; index -= 1) {
      const message = state.messages[index];
      if (message.role !== "user") continue;
      const text = lastUserTextFromTurn(message.turn);
      if (text) return detectReplyLocale(text);
    }
    return "en" as const;
  }, [state.locale, state.messages]);

  return {
    messages: state.messages,
    brief: state.brief,
    status: state.status,
    activity: state.activity,
    searchActivity: state.searchActivity,
    locale,
    readyForReview,
    sendText,
    selectChip,
    selectFlight,
    selectHotel,
    selectDestination,
    selectPlace,
    selectDayPlanPlace,
    refreshDayPlanSlot,
    selectDateOption,
    selectDateRange,
    prepareItinerary,
    reorderItineraryDays,
    confirmPlan,
    announcePlanReady,
    acknowledgeChip,
    requestDayPlan,
    noteContext,
    isDayPlanSettled: () => isDayPlanSettled(stateRef.current.brief),
  };
}

export type TravelChatEngine = ReturnType<typeof useTravelChatEngine>;
