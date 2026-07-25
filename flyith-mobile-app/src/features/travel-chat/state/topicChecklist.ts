import type { OnboardingContext, TripBrief } from "../types";

export interface TopicSpec {
  id: string;
  phase: 1 | 2 | 3 | 4;
  briefFields: (keyof TripBrief)[];
  goal: string;
  /**
   * Micro-preferences (layover minutes, emissions, star class…). The app assumes
   * sensible defaults for these instead of interrogating the user card by card.
   */
  optional?: boolean;
  skipIf?: (brief: TripBrief) => boolean;
  /** When set, overrides briefFields for coverage (e.g. concrete destination only). */
  coveredIf?: (brief: TripBrief) => boolean;
  onboardingHint?: (onboarding: OnboardingContext) => string | undefined;
}

function isSet(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "string") return value.length > 0;
  return true;
}

const VAGUE_DESTINATION =
  /^(bir\s+)?(avrupa(\s+şehri)?|europe(an)?(\s+city)?|asya(\s+şehri)?|asia(n)?(\s+city)?|sürpriz|surpriz|surprise(\s+me)?|somewhere|anywhere|herhangi(\s+bir)?|fark\s*etmez|bilmiyorum|not\s+sure)$/i;

/** True when the string alone is a region vibe, not a bookable city. */
export function isVagueDestination(value?: string): boolean {
  const trimmed = value?.trim();
  if (!trimmed) return true;
  return VAGUE_DESTINATION.test(trimmed);
}

/** Searchable real city — "Avrupa şehri" does not count. */
export function hasConcreteDestination(brief: TripBrief): boolean {
  if (brief.destinationAirportCode) return true;
  const value = brief.destination?.trim();
  return Boolean(value) && !isVagueDestination(value);
}

function isTopicCovered(topic: TopicSpec, brief: TripBrief): boolean {
  if (topic.skipIf?.(brief)) return true;
  if (brief.skippedTopics?.includes(topic.id)) return true;
  if (topic.coveredIf) return topic.coveredIf(brief);
  return topic.briefFields.some((field) => isSet(brief[field]));
}

/**
 * Topics across 4 phases. Covered when ANY mapped brief field is set.
 * Search gates sit after their preference groups so cards never arrive early.
 */
export const TOPICS: TopicSpec[] = [
  // Phase 1 — trip basics, then flight prefs (before any flight search)
  {
    id: "destination",
    phase: 1,
    briefFields: ["destination", "destinationAirportCode"],
    goal: "where they want to go (or explore destinations first)",
    coveredIf: hasConcreteDestination,
  },
  {
    id: "origin",
    phase: 1,
    briefFields: ["originAirportCode"],
    goal: "which city/airport they depart from",
  },
  {
    id: "dates",
    phase: 1,
    briefFields: ["startDate", "endDate"],
    goal: "travel dates — concrete or flexible month",
  },
  {
    id: "travelers",
    phase: 1,
    briefFields: ["adults", "travelers", "companionType"],
    goal: "how many adults are going and who with (solo/couple/friends/family)",
  },
  {
    id: "children",
    phase: 1,
    briefFields: ["children", "childrenAges"],
    goal: "whether any children are coming (and ages if yes)",
    skipIf: (brief) => brief.children === 0,
  },
  {
    id: "budget",
    phase: 1,
    briefFields: ["budgetTotalUSD"],
    goal: "total trip budget in USD",
    onboardingHint: (o) =>
      o.averageBudget
        ? `they said average budget ~$${o.averageBudget} in onboarding — confirm or adjust for THIS trip`
        : undefined,
  },
  {
    id: "cabin_class",
    phase: 1,
    briefFields: ["travelClass"],
    goal: "cabin class: economy / premium economy / business / first",
  },
  {
    id: "stops",
    phase: 1,
    briefFields: ["maxStops"],
    goal: "nonstop only, or ok with 1–2 stops",
  },
  {
    id: "bags",
    phase: 1,
    briefFields: ["carryOnBags"],
    goal: "carry-on bags needed",
  },
  {
    id: "occasion",
    phase: 1,
    briefFields: ["occasion"],
    goal: "what's the occasion (birthday, anniversary, just a getaway, workcation)",
  },

  // Phase 2 — optional flight micro-prefs (auto-assumed unless user volunteers)
  {
    id: "flight_price_cap",
    phase: 2,
    briefFields: ["maxFlightPriceUSD"],
    goal: "max they're willing to spend on flights",
    optional: true,
  },
  {
    id: "departure_window",
    phase: 2,
    briefFields: ["outboundTimeWindow"],
    goal: "preferred departure time window (morning/afternoon/evening)",
    optional: true,
  },
  {
    id: "flight_duration",
    phase: 2,
    briefFields: ["maxDurationMinutes", "layoverWindowMinutes"],
    goal: "max total flight duration or layover comfort",
    optional: true,
  },
  {
    id: "airlines_emissions",
    phase: 2,
    briefFields: ["preferredAirlines", "avoidAirlines", "preferLowEmissions"],
    goal: "airline preferences or lower-emissions preference",
    optional: true,
  },

  // Phase 3 — stay preferences (before hotel search)
  {
    id: "accommodation_type",
    phase: 3,
    briefFields: ["accommodationType", "vacationRentals"],
    goal: "hostel / hotel / resort / boutique / vacation rental for THIS trip",
    onboardingHint: (o) =>
      o.hostelVsHotel
        ? `they said "${o.hostelVsHotel}" in onboarding — confirm they still want that for this trip`
        : undefined,
  },
  {
    id: "hotel_budget",
    phase: 3,
    briefFields: ["maxPricePerNightUSD", "bedrooms"],
    goal: "max price per night (and bedrooms if vacation rental)",
  },
  {
    id: "hotel_class",
    phase: 3,
    briefFields: ["hotelClasses"],
    goal: "star class they want (2–5)",
    optional: true,
  },
  {
    id: "hotel_rating",
    phase: 3,
    briefFields: ["hotelMinRating"],
    goal: "minimum guest rating (3.5+ / 4.0+ / 4.5+)",
    optional: true,
  },
  {
    id: "hotel_amenities",
    phase: 3,
    briefFields: ["mustHaveAmenities"],
    goal: "must-have amenities (pool, breakfast, gym, kitchen, wifi…)",
    optional: true,
    onboardingHint: (o) =>
      o.tripPriorities?.includes("hotel")
        ? "they said hotel is critical in onboarding — dig into what makes a stay great for them"
        : undefined,
  },
  {
    id: "hotel_policies",
    phase: 3,
    briefFields: ["freeCancellationRequired", "ecoCertifiedPreferred"],
    goal: "free cancellation and/or eco-certified preference",
    optional: true,
  },
  {
    id: "neighborhood",
    phase: 3,
    briefFields: ["neighborhoodPreference"],
    goal: "preferred neighborhood / area of the city",
    optional: true,
  },

  // Phase 4 — experience prefs first, then search topics
  {
    id: "cuisine",
    phase: 4,
    briefFields: ["cuisineTypes", "foodPreferences"],
    goal: "cuisines they're craving on this trip",
    onboardingHint: (o) =>
      o.foodPreferences?.length
        ? `they like ${o.foodPreferences.join(", ")} — confirm for this destination and suggest local twists`
        : undefined,
  },
  {
    id: "dietary",
    phase: 4,
    briefFields: ["dietaryRestrictions"],
    goal: "dietary restrictions (veg, vegan, halal, allergies)",
    optional: true,
  },
  {
    id: "travel_style",
    phase: 4,
    briefFields: ["travelStyle"],
    goal: "cultural vs experience vs mixed for THIS trip",
    onboardingHint: (o) =>
      o.culturalVsExperience
        ? `they lean "${o.culturalVsExperience}" — gently argue the other side for this destination`
        : undefined,
  },
  {
    id: "pace",
    phase: 4,
    briefFields: ["pace"],
    goal: "pace: relaxed / balanced / packed itinerary",
  },
  {
    id: "famous_vs_hidden",
    phase: 4,
    briefFields: ["famousVsHiddenGems"],
    goal: "famous landmarks vs quieter hidden gems",
  },
  {
    id: "nightlife",
    phase: 4,
    briefFields: ["nightlifeInterest"],
    goal: "nightlife interest",
  },
  {
    id: "restaurants",
    phase: 4,
    briefFields: ["restaurantsShown"],
    goal: "run a real restaurants search and let them react",
    onboardingHint: (o) =>
      o.tripPriorities?.includes("food")
        ? "food is critical for them — lean into restaurant discovery"
        : undefined,
  },
  {
    id: "attractions",
    phase: 4,
    briefFields: ["attractionsShown"],
    goal: "run a real attractions search and let them react",
  },
  {
    id: "day_plan",
    phase: 4,
    briefFields: ["dayPlanShown"],
    goal: "morning / afternoon / evening place slots for a sample day",
  },
  {
    id: "day_trip",
    phase: 4,
    briefFields: ["dayTripInterest"],
    goal: "interest in a day trip outside the city",
    optional: true,
  },
  {
    id: "shopping_gifts",
    phase: 4,
    briefFields: ["shoppingInterest", "giftShopping"],
    goal: "shopping interest and whether they want gifts for friends",
    optional: true,
    onboardingHint: (o) =>
      o.likesGifting ? "they said they like gifting — offer a gift-shopping beat" : undefined,
  },
  {
    id: "events",
    phase: 4,
    briefFields: ["eventInterest", "eventsShown"],
    goal: "interest in local events / festivals, and search if yes",
    optional: true,
  },
  {
    id: "influencer_route",
    phase: 4,
    briefFields: ["influencerRouteAccepted", "exploreInterest"],
    goal: "offer a route inspired by their favorite influencer's travels",
    optional: true,
    onboardingHint: (o) =>
      o.favoriteInfluencer
        ? `${o.favoriteInfluencer} travelled ${
            o.influencerDestinations?.join(", ") ?? o.favoriteDestination ?? "interesting places"
          } — ask if they want a similar vibe`
        : undefined,
  },
];

export function coverage(brief: TripBrief): { covered: number; total: number } {
  const applicable = TOPICS.filter((topic) => !topic.skipIf?.(brief));
  const covered = applicable.filter((topic) => isTopicCovered(topic, brief)).length;
  return { covered, total: applicable.length };
}

export interface NextTopicOptions {
  /** Skip micro-preference topics the app answers with defaults. */
  coreOnly?: boolean;
  /** Topics already put on screen this session — never ask them twice. */
  skipIds?: Iterable<string>;
}

export function nextMissingTopics(
  brief: TripBrief,
  limit = 5,
  options: NextTopicOptions = {}
): TopicSpec[] {
  const skip = new Set(options.skipIds ?? []);
  const missing: TopicSpec[] = [];
  for (const phase of [1, 2, 3, 4] as const) {
    for (const topic of TOPICS) {
      if (topic.phase !== phase) continue;
      if (options.coreOnly && topic.optional) continue;
      if (skip.has(topic.id)) continue;
      if (isTopicCovered(topic, brief)) continue;
      missing.push(topic);
      if (missing.length >= limit) return missing;
    }
  }
  return missing;
}

/**
 * Ids the app fills in for the user rather than asking. Recorded on the brief so
 * coverage advances without inventing search filters the user never asked for.
 */
export function assumableTopicIds(brief: TripBrief): string[] {
  return TOPICS.filter((topic) => topic.optional && !isTopicCovered(topic, brief)).map(
    (topic) => topic.id
  );
}

/** Core flight prefs that must be answered (or skipped) before searching flights. */
export const FLIGHT_PREF_TOPIC_IDS = ["cabin_class", "stops", "bags"] as const;

/** Optional flight micro-prefs — auto-skip once a flight is chosen. */
export const OPTIONAL_FLIGHT_TOPIC_IDS = [
  "flight_price_cap",
  "departure_window",
  "flight_duration",
  "airlines_emissions",
] as const;

/** Core hotel prefs that must settle before searching hotels. */
export const HOTEL_PREF_TOPIC_IDS = ["accommodation_type", "hotel_budget"] as const;

/** Optional hotel micro-prefs — auto-skip once a hotel is chosen. */
export const OPTIONAL_HOTEL_TOPIC_IDS = [
  "hotel_class",
  "hotel_rating",
  "hotel_amenities",
  "hotel_policies",
  "neighborhood",
] as const;

/** Experience prefs that must settle before restaurants / attractions / day plan. */
export const EXPERIENCE_PREF_TOPIC_IDS = [
  "cuisine",
  "travel_style",
  "pace",
  "famous_vs_hidden",
] as const;

function topicsSettled(ids: readonly string[], brief: TripBrief): boolean {
  return ids.every((id) => {
    const topic = TOPICS.find((t) => t.id === id);
    return topic ? isTopicCovered(topic, brief) : true;
  });
}

export function flightPrefsSettled(brief: TripBrief): boolean {
  return topicsSettled(FLIGHT_PREF_TOPIC_IDS, brief);
}

export function hotelPrefsSettled(brief: TripBrief): boolean {
  return topicsSettled(HOTEL_PREF_TOPIC_IDS, brief);
}

export function experiencePrefsSettled(brief: TripBrief): boolean {
  return topicsSettled(EXPERIENCE_PREF_TOPIC_IDS, brief);
}

function hasTravelers(brief: TripBrief): boolean {
  return isSet(brief.adults) || isSet(brief.travelers) || isSet(brief.companionType);
}

/** Dest+origin+dates+travelers+cabin/stops/bags — ready to pull flight cards. */
export function readyToSearchFlights(brief: TripBrief): boolean {
  return (
    hasConcreteDestination(brief) &&
    Boolean(brief.originAirportCode && brief.startDate && brief.endDate && hasTravelers(brief)) &&
    flightPrefsSettled(brief)
  );
}

/** Flight locked + hotel prefs settled — ready to pull hotel cards. */
export function readyToSearchHotels(brief: TripBrief): boolean {
  return (
    Boolean(brief.chosenFlight && brief.startDate && brief.endDate) &&
    hasConcreteDestination(brief) &&
    hotelPrefsSettled(brief)
  );
}

/** Hotel locked + experience prefs settled — ready for places / day plan. */
export function readyToSearchExperiences(brief: TripBrief): boolean {
  return (
    Boolean(brief.chosenHotel) && hasConcreteDestination(brief) && experiencePrefsSettled(brief)
  );
}

function topicsToSkipAfterSelection(ids: readonly string[], brief: TripBrief): string[] {
  const current = brief.skippedTopics ?? [];
  return ids.filter((id) => {
    const topic = TOPICS.find((t) => t.id === id);
    if (!topic) return false;
    if (isTopicCovered(topic, brief)) return false;
    return !current.includes(id);
  });
}

/** Topics to mark skipped once the user has already picked a flight. */
export function flightTopicsToSkipAfterSelection(brief: TripBrief): string[] {
  return topicsToSkipAfterSelection(
    [...FLIGHT_PREF_TOPIC_IDS, ...OPTIONAL_FLIGHT_TOPIC_IDS],
    brief
  );
}

/** Topics to mark skipped once the user has already picked a hotel. */
export function hotelTopicsToSkipAfterSelection(brief: TripBrief): string[] {
  return topicsToSkipAfterSelection([...HOTEL_PREF_TOPIC_IDS, ...OPTIONAL_HOTEL_TOPIC_IDS], brief);
}

export function formatTopicForPrompt(topic: TopicSpec, onboarding?: OnboardingContext): string {
  const hint = onboarding ? topic.onboardingHint?.(onboarding) : undefined;
  return hint ? `- ${topic.id}: ${topic.goal} (${hint})` : `- ${topic.id}: ${topic.goal}`;
}
