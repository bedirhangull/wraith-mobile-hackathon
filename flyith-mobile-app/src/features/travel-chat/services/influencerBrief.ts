import type { Influencer } from "@/data/influencers";

import type {
  InfluencerRouteStop,
  InfluencerSourceMeta,
  ItineraryActivity,
  PlaceOption,
  TripBrief,
} from "../types";
import { generateId } from "../utils/ids";
import { resolveItineraryPlaces } from "./resolveItineraryPlaces";

/** Topics we skip in influencer mode — the creator route supplies experience prefs. */
export const INFLUENCER_SKIP_TOPIC_IDS = [
  "budget",
  "cabin_class",
  "stops",
  "bags",
  "children",
  "occasion",
  "flight_price_cap",
  "departure_window",
  "flight_duration",
  "airlines_emissions",
  "accommodation_type",
  "hotel_budget",
  "hotel_class",
  "hotel_rating",
  "hotel_amenities",
  "hotel_policies",
  "neighborhood",
  "cuisine",
  "travel_style",
  "pace",
  "famous_vs_hidden",
  "restaurants",
  "attractions",
  "day_plan",
  "events",
  "nightlife",
  "shopping",
  "gift_shopping",
  "day_trips",
  "influencer_route",
] as const;

export function influencerSourceFromInfluencer(influencer: Influencer): InfluencerSourceMeta {
  const route: InfluencerRouteStop[] = influencer.travelPlan.map((stop) => ({
    city: stop.city,
    countryCode: stop.countryCode,
    flag: stop.flag,
    notes: stop.notes,
    places: [...stop.places],
    startDate: stop.startDate,
    endDate: stop.endDate,
  }));

  return {
    id: influencer.id,
    name: influencer.name,
    handle: influencer.handle,
    niche: influencer.niche,
    highlight: influencer.highlight,
    context: influencer.context,
    originCity: influencer.origin.city,
    originCountryCode: influencer.origin.countryCode,
    originFlag: influencer.origin.flag,
    destinationCity: influencer.destination.city,
    destinationCountryCode: influencer.destination.countryCode,
    destinationFlag: influencer.destination.flag,
    route,
  };
}

/**
 * Build a brief patch from an influencer travel route.
 * Applies sensible flight defaults so only origin/dates/travelers remain missing.
 */
export function briefPatchFromInfluencer(
  source: InfluencerSourceMeta,
  previousOnboarding: TripBrief["onboarding"]
): Partial<TripBrief> {
  const primaryCity = source.route[0]?.city ?? source.destinationCity;
  const attractionNames = source.route.flatMap((stop) => stop.places);

  return {
    planningMode: "influencer",
    influencerSource: source,
    youtubeSource: undefined,
    youtubeAnalysis: undefined,
    destination: primaryCity,
    destinationCountryCode: source.route[0]?.countryCode ?? source.destinationCountryCode,
    // Flight micro-defaults so readyToSearchFlights only needs origin+dates+travelers.
    travelClass: 1,
    maxStops: 1,
    carryOnBags: 1,
    children: 0,
    shownAttractionNames: attractionNames.slice(0, 16),
    shownRestaurantNames: [],
    shownEventNames: [],
    restaurantsShown: true,
    attractionsShown: true,
    eventsShown: false,
    dayPlanShown: true,
    influencerRouteAccepted: true,
    skippedTopics: [...INFLUENCER_SKIP_TOPIC_IDS],
    chosenFlight: undefined,
    chosenHotel: undefined,
    itineraryDays: undefined,
    dayPlanSelections: undefined,
    originAirportCode: undefined,
    destinationAirportCode: undefined,
    startDate: undefined,
    endDate: undefined,
    tripLengthDays: undefined,
    onboarding: {
      ...previousOnboarding,
      favoriteInfluencer: source.name,
      favoriteInfluencerId: source.id,
      favoriteDestination: primaryCity,
      influencerDestinations: source.route.map((stop) => stop.city),
    },
    status: "planning",
  };
}

/** Wipe city-/plan-bound fields when starting a fresh influencer plan mid-chat. */
export function influencerPlanResetPatch(
  onboarding: TripBrief["onboarding"]
): Partial<TripBrief> {
  return {
    planningMode: "influencer",
    influencerSource: undefined,
    youtubeSource: undefined,
    youtubeAnalysis: undefined,
    destination: undefined,
    destinationCanonicalName: undefined,
    destinationLatitude: undefined,
    destinationLongitude: undefined,
    destinationCountryCode: undefined,
    destinationThumbnailUrl: undefined,
    destinationAirportCode: undefined,
    originAirportCode: undefined,
    startDate: undefined,
    endDate: undefined,
    tripLengthDays: undefined,
    travelers: undefined,
    adults: undefined,
    children: undefined,
    childrenAges: undefined,
    companionType: undefined,
    travelClass: undefined,
    maxStops: undefined,
    carryOnBags: undefined,
    maxFlightPriceUSD: undefined,
    outboundTimeWindow: undefined,
    maxDurationMinutes: undefined,
    cuisineTypes: undefined,
    foodPreferences: undefined,
    travelStyle: undefined,
    pace: undefined,
    accommodationType: undefined,
    chosenFlight: undefined,
    chosenHotel: undefined,
    itineraryDays: undefined,
    dayPlanSelections: undefined,
    dayPlanShown: undefined,
    restaurantsShown: undefined,
    attractionsShown: undefined,
    eventsShown: undefined,
    shownRestaurantNames: undefined,
    shownAttractionNames: undefined,
    shownEventNames: undefined,
    shownPlaceOptions: undefined,
    influencerRouteAccepted: undefined,
    skippedTopics: undefined,
    onboarding,
    status: "planning",
  };
}

export function isReadyForInfluencerReview(brief: TripBrief): boolean {
  return (
    brief.planningMode === "influencer" &&
    Boolean(brief.destination) &&
    Boolean(brief.chosenFlight) &&
    (brief.influencerSource?.route.some((stop) => stop.places.length > 0) ?? false)
  );
}

export async function resolveInfluencerPlaces(
  source: InfluencerSourceMeta
): Promise<PlaceOption[]> {
  const activities: ItineraryActivity[] = source.route.flatMap((stop) =>
    stop.places.map((placeName) => ({
      title: placeName,
      kind: "sight" as const,
      placeName,
      note: stop.notes,
    }))
  );

  if (activities.length === 0) return [];

  const destination = source.route[0]?.city ?? source.destinationCity;
  const resolved = await resolveItineraryPlaces(activities, [], { destination });

  return resolved.map((activity): PlaceOption => ({
    id: activity.placeId ?? generateId(),
    name: activity.placeName ?? activity.title,
    category: "attractions",
    address: activity.address,
    latitude: activity.latitude,
    longitude: activity.longitude,
    phone: activity.phone,
    dataId: activity.dataId,
    openState: activity.openState,
    description: activity.note,
  }));
}
