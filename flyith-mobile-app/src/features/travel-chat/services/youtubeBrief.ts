import type {
  ItineraryActivity,
  PlaceOption,
  TripBrief,
  YouTubePlaceInsight,
  YouTubeSourceMeta,
  YouTubeTravelAnalysis,
} from "../types";
import { generateId } from "../utils/ids";
import { resolveItineraryPlaces } from "./resolveItineraryPlaces";
import type { YouTubeIngestResult } from "./youtubeIngest";

/** Topics we skip in YouTube mode — video supplies experience prefs. */
export const YOUTUBE_SKIP_TOPIC_IDS = [
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

export function youtubeSourceFromIngest(ingest: YouTubeIngestResult): YouTubeSourceMeta {
  return {
    videoId: ingest.video.videoId,
    url: ingest.video.url,
    title: ingest.video.title,
    thumbnailUrl: ingest.video.thumbnailUrl,
    channelName: ingest.video.channelName,
    publishedDate: ingest.video.publishedDate,
    textSource: ingest.textSource,
  };
}

/**
 * Build a brief patch from a successful travel-related YouTube analysis.
 * Applies sensible flight defaults so only origin/dates/travelers remain missing.
 */
export function briefPatchFromYouTubeAnalysis(
  analysis: YouTubeTravelAnalysis,
  source: YouTubeSourceMeta,
  previousOnboarding: TripBrief["onboarding"]
): Partial<TripBrief> {
  const restaurantNames = analysis.places
    .filter((place) => place.category === "food" && place.sentiment !== "negative")
    .map((place) => place.name);
  const attractionNames = analysis.places
    .filter(
      (place) =>
        (place.category === "sight" ||
          place.category === "experience" ||
          place.category === "shopping") &&
        place.sentiment !== "negative"
    )
    .map((place) => place.name);
  const eventNames = analysis.places
    .filter((place) => place.category === "event" && place.sentiment !== "negative")
    .map((place) => place.name);

  return {
    planningMode: "youtube",
    youtubeSource: source,
    youtubeAnalysis: analysis,
    destination: analysis.destination,
    tripLengthDays: analysis.suggestedTripLengthDays,
    travelStyle: analysis.travelStyle,
    pace: analysis.pace,
    accommodationType: analysis.accommodationHint ?? "hotel",
    cuisineTypes: analysis.cuisineTypes,
    foodPreferences: analysis.foodPreferences,
    // Flight micro-defaults so readyToSearchFlights only needs origin+dates+travelers.
    travelClass: 1,
    maxStops: 1,
    carryOnBags: 1,
    children: 0,
    shownRestaurantNames: restaurantNames.slice(0, 12),
    shownAttractionNames: attractionNames.slice(0, 12),
    shownEventNames: eventNames.slice(0, 8),
    restaurantsShown: true,
    attractionsShown: true,
    eventsShown: eventNames.length > 0,
    dayPlanShown: true,
    skippedTopics: [...YOUTUBE_SKIP_TOPIC_IDS],
    // Clear logistics from any prior chat plan.
    chosenFlight: undefined,
    chosenHotel: undefined,
    itineraryDays: undefined,
    dayPlanSelections: undefined,
    originAirportCode: undefined,
    destinationAirportCode: undefined,
    startDate: undefined,
    endDate: undefined,
    destinationThumbnailUrl: source.thumbnailUrl,
    onboarding: previousOnboarding,
    status: "planning",
  };
}

/** Wipe city-/plan-bound fields when starting a fresh YouTube plan mid-chat. */
export function youtubePlanResetPatch(
  onboarding: TripBrief["onboarding"]
): Partial<TripBrief> {
  return {
    planningMode: "youtube",
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
    skippedTopics: undefined,
    onboarding,
    status: "planning",
  };
}

export function isReadyForYouTubeReview(brief: TripBrief): boolean {
  return (
    brief.planningMode === "youtube" &&
    Boolean(brief.destination) &&
    Boolean(brief.chosenFlight) &&
    Boolean(brief.youtubeAnalysis?.isTravelRelated) &&
    (brief.youtubeAnalysis?.places.length ?? 0) > 0
  );
}

function categoryToPlaceCategory(category: YouTubePlaceInsight["category"]): string {
  switch (category) {
    case "food":
      return "restaurants";
    case "event":
      return "events";
    default:
      return "attractions";
  }
}

export async function resolveYouTubePlaces(
  analysis: YouTubeTravelAnalysis,
  destination?: string
): Promise<PlaceOption[]> {
  const activities: ItineraryActivity[] = analysis.places
    .filter((place) => place.sentiment !== "negative")
    .map((place) => ({
      title: place.name,
      kind:
        place.category === "food"
          ? "food"
          : place.category === "event"
            ? "event"
            : place.category === "shopping"
              ? "shopping"
              : place.category === "experience"
                ? "experience"
                : "sight",
      placeName: place.name,
      note: place.note,
    }));

  if (activities.length === 0) return [];

  const resolved = await resolveItineraryPlaces(activities, [], {
    destination,
  });

  return resolved.map((activity, index): PlaceOption => {
    const insight = analysis.places.filter((place) => place.sentiment !== "negative")[index];
    return {
      id: activity.placeId ?? generateId(),
      name: activity.placeName ?? activity.title,
      category: categoryToPlaceCategory(insight?.category ?? "other"),
      address: activity.address,
      latitude: activity.latitude,
      longitude: activity.longitude,
      phone: activity.phone,
      dataId: activity.dataId,
      openState: activity.openState,
      description: insight?.note,
    };
  });
}
