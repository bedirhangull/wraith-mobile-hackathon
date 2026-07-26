export type ChatRole = "user" | "assistant";

export interface SuggestionChip {
  id: string;
  label: string;
  value?: string;
  /** Optional one-liner so the option can render as a full card instead of a tiny chip. */
  description?: string;
  emoji?: string;
}

/** One priced candidate date range, produced by fanning out flight searches across a month. */
export interface DateOption {
  id: string;
  startDate: string;
  endDate: string;
  priceUSD?: number;
  airline?: string;
  airlineLogoUrl?: string;
  durationMinutes?: number;
  stops?: number;
  isCheapest?: boolean;
}

export interface FlightOption {
  id: string;
  airline: string;
  airlineLogoUrl?: string;
  departureAirport: string;
  arrivalAirport: string;
  departureTime: string;
  arrivalTime: string;
  durationMinutes: number;
  stops: number;
  priceUSD: number;
  bookingToken?: string;
  departureToken?: string;
  /** Short "why this matches you" line derived from the brief. */
  matchReason?: string;
}

export interface HotelOption {
  id: string;
  name: string;
  thumbnailUrl?: string;
  pricePerNightUSD?: number;
  totalPriceUSD?: number;
  rating?: number;
  reviewCount?: number;
  hotelClass?: number;
  amenities?: string[];
  propertyToken?: string;
  matchReason?: string;
}

export interface DestinationOption {
  id: string;
  name: string;
  countryOrRegion?: string;
  thumbnailUrl?: string;
  estimatedPriceUSD?: number;
  airportCode?: string;
  blurb?: string;
}

export type ItineraryActivityKind =
  "food" | "sight" | "experience" | "transit" | "rest" | "shopping" | "event";

export interface ItineraryActivity {
  id?: string;
  time?: string;
  title: string;
  kind: ItineraryActivityKind;
  placeName?: string;
  placeId?: string;
  dataId?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  phone?: string;
  openState?: string;
  note?: string;
  estimatedCostUSD?: number;
}

export interface ItineraryDay {
  dayNumber: number;
  date?: string;
  title: string;
  summary?: string;
  activities: ItineraryActivity[];
  estimatedDayCostUSD?: number;
}

export type PlaceCategory = "restaurants" | "attractions" | "events";

export interface PlaceOption {
  id: string;
  name: string;
  category: string;
  rating?: number;
  reviewCount?: number;
  priceLevel?: string;
  thumbnailUrl?: string;
  address?: string;
  description?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  dataId?: string;
  openState?: string;
  /** Day-keyed hours from SerpAPI, e.g. { monday: "9 AM–5 PM" }. */
  operatingHours?: Record<string, string>;
}

export type DayPlanSlotId = "morning" | "afternoon" | "evening";

export interface DayPlanSlot {
  id: DayPlanSlotId;
  label: string;
  timeRange: string;
  options: PlaceOption[];
}

export interface BookingOption {
  id: string;
  bookWith: string;
  airlineLogoUrl?: string;
  priceUSD?: number;
  optionTitle?: string;
  extensions?: string[];
  bookingUrl?: string;
  /** Signed form payload that must be POSTed to bookingUrl. */
  bookingPostData?: string;
}

export interface PhotoItem {
  id: string;
  thumbnailUrl: string;
  fullUrl: string;
}

export interface PhotoSection {
  title: string;
  photos: PhotoItem[];
}

export interface ReviewUser {
  name: string;
  avatarUrl?: string;
  profileUrl?: string;
  isLocalGuide?: boolean;
}

export interface ReviewItem {
  id: string;
  user: ReviewUser;
  rating?: number;
  date?: string;
  snippet?: string;
}

export interface PlaceDetail {
  name: string;
  rating?: number;
  reviewCount?: number;
  phone?: string;
  address?: string;
  todayHours?: string;
  mapsUrl: string;
  latitude?: number;
  longitude?: number;
  dataId?: string;
}

export type AssistantTurn =
  | { kind: "text"; text: string }
  | { kind: "question"; text: string; quickReplies?: string[] }
  | { kind: "suggestions"; prompt?: string; chips: SuggestionChip[] }
  | { kind: "flight_options"; options: FlightOption[] }
  | { kind: "hotel_options"; options: HotelOption[] }
  | { kind: "destination_inspiration"; options: DestinationOption[] }
  | { kind: "places"; category: PlaceCategory; label: string; options: PlaceOption[] }
  | { kind: "date_options"; month: string; label: string; options: DateOption[] }
  | { kind: "day_plan"; label: string; slots: DayPlanSlot[] }
  | { kind: "itinerary_review"; brief: TripBrief; days: ItineraryDay[] }
  | { kind: "image"; prompt: string; imageBase64?: string; caption?: string }
  | {
      kind: "youtube_video";
      videoId: string;
      url: string;
      title: string;
      thumbnailUrl?: string;
      channelName?: string;
      placeNames?: string[];
      summary?: string;
    }
  | {
      kind: "influencer_route";
      influencerId: string;
      name: string;
      handle: string;
      niche?: string;
      context?: string;
      routeCities: string[];
      placeNames: string[];
      summary?: string;
    }
  | { kind: "system_notice"; text: string }
  // Invisible to the UI — kept in messages so Gemini sees search outcomes on
  // later turns and doesn't re-fire an identical failing search.
  | {
      kind: "tool_outcome";
      action: string;
      outcome: "ok" | "empty" | "missing_info" | "failed";
      detail: string;
    }
  /** Invisible — injects review/detail context the user opened into model history. */
  | { kind: "context_note"; text: string };

export type UserTurn =
  | { kind: "text"; text: string }
  | { kind: "chip_selection"; chipId: string; label: string }
  | {
      kind: "card_selection";
      cardKind: "flight" | "hotel" | "destination" | "place" | "date";
      optionId: string;
      /** Human-readable summary of what was tapped — shown as a user bubble and sent to the model. */
      label?: string;
    }
  | { kind: "review_action"; action: "start" | "edit" };

export interface BaseMessage {
  id: string;
  createdAt: number;
}

export type ChatMessage =
  | (BaseMessage & { role: "assistant"; turn: AssistantTurn })
  | (BaseMessage & { role: "user"; turn: UserTurn });

export type AccommodationType = "hostel" | "hotel" | "resort" | "boutique";
export type TravelStyle = "cultural" | "experience" | "mixed";

export interface OnboardingContext {
  averageBudget?: number;
  favoriteInfluencer?: string;
  /** Stable id from `src/data/influencers.ts` — preferred over name for lookups. */
  favoriteInfluencerId?: string;
  favoriteDestination?: string;
  influencerDestinations?: string[];
  foodPreferences?: string[];
  hostelVsHotel?: string;
  culturalVsExperience?: string;
  likesGifting?: boolean;
  /** What's critical for them on a trip — e.g. hotel, food, nightlife. */
  tripPriorities?: string[];
}

export type TravelClass = 1 | 2 | 3 | 4;
export type ExploreInterest = "popular" | "outdoors" | "beaches" | "museum" | "history" | "skiing";
export type TripPace = "relaxed" | "balanced" | "packed";
export type FamousVsHidden = "famous" | "hidden" | "mix";

export type PlanningMode = "chat" | "youtube" | "influencer";

export type YouTubePlaceCategory =
  "food" | "sight" | "experience" | "shopping" | "event" | "hotel" | "other";

export interface YouTubePlaceInsight {
  name: string;
  category: YouTubePlaceCategory;
  sentiment: "positive" | "negative" | "neutral";
  note?: string;
  timeHint?: string;
  startMs?: number;
}

export interface YouTubeTravelAnalysis {
  isTravelRelated: boolean;
  confidence?: number;
  destination?: string;
  destinationCountry?: string;
  suggestedTripLengthDays?: number;
  summary: string;
  travelStyle?: TravelStyle;
  pace?: TripPace;
  accommodationHint?: AccommodationType;
  cuisineTypes?: string[];
  foodPreferences?: string[];
  warnings?: string[];
  highlights?: string[];
  places: YouTubePlaceInsight[];
}

export interface YouTubeSourceMeta {
  videoId: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  channelName?: string;
  publishedDate?: string;
  textSource: "transcript" | "description_chapters" | "metadata_only";
}

/** One stop on an influencer travel plan — JSON-safe (no ImageSourcePropType). */
export interface InfluencerRouteStop {
  city: string;
  countryCode: string;
  flag: string;
  notes?: string;
  places: string[];
  startDate?: string;
  endDate?: string;
}

/** Serializable influencer snapshot stored on TripBrief (image resolved via id). */
export interface InfluencerSourceMeta {
  id: string;
  name: string;
  handle: string;
  niche: string;
  highlight: string;
  context: string;
  originCity: string;
  originCountryCode: string;
  originFlag: string;
  destinationCity: string;
  destinationCountryCode: string;
  destinationFlag: string;
  route: InfluencerRouteStop[];
}

export interface TripBrief {
  destination?: string;
  /** SerpAPI destination photo selected by the user, used in the trip review hero. */
  destinationThumbnailUrl?: string;
  /** Canonical place name from geocode (e.g. "Paris, France"). */
  destinationCanonicalName?: string;
  destinationLatitude?: number;
  destinationLongitude?: number;
  /** ISO 3166-1 alpha-2 country code for SerpAPI `gl`. */
  destinationCountryCode?: string;
  originAirportCode?: string;
  destinationAirportCode?: string;
  startDate?: string;
  endDate?: string;
  travelers?: number;
  budgetTotalUSD?: number;
  accommodationType?: AccommodationType;
  travelStyle?: TravelStyle;
  foodPreferences?: string[];

  // Passengers
  adults?: number;
  children?: number;
  childrenAges?: number[];
  infantsInSeat?: number;
  infantsOnLap?: number;
  companionType?: string;

  // Flight preferences (map 1:1 onto google_flights params)
  travelClass?: TravelClass;
  maxStops?: 0 | 1 | 2 | 3;
  carryOnBags?: number;
  maxFlightPriceUSD?: number;
  outboundTimeWindow?: string;
  layoverWindowMinutes?: string;
  maxDurationMinutes?: number;
  preferLowEmissions?: boolean;
  preferredAirlines?: string[];
  avoidAirlines?: string[];

  // Hotel preferences
  hotelClasses?: number[];
  hotelMinRating?: 7 | 8 | 9;
  mustHaveAmenities?: string[];
  freeCancellationRequired?: boolean;
  ecoCertifiedPreferred?: boolean;
  neighborhoodPreference?: string;
  maxPricePerNightUSD?: number;
  vacationRentals?: boolean;
  bedrooms?: number;

  // Explore / places
  exploreInterest?: ExploreInterest;
  travelDurationPreset?: 1 | 2 | 3;
  minPlaceRating?: number;
  openNowOnly?: boolean;

  // Trip shape / vibe
  pace?: TripPace;
  famousVsHiddenGems?: FamousVsHidden;
  dayTripInterest?: boolean;
  nightlifeInterest?: boolean;
  shoppingInterest?: boolean;
  giftShopping?: boolean;
  eventInterest?: boolean;
  dietaryRestrictions?: string[];
  cuisineTypes?: string[];
  occasion?: string;
  influencerRouteAccepted?: boolean;

  /** How long they want to stay, before concrete dates exist. */
  tripLengthDays?: number;
  /** Topic ids the app decided not to interrogate — treated as covered. */
  skippedTopics?: string[];
  /** Morning/afternoon/evening place slots already shown. */
  dayPlanShown?: boolean;
  /** User picks for each day-plan time slot. */
  dayPlanSelections?: Partial<Record<DayPlanSlotId, PlaceOption>>;

  chosenFlight?: FlightOption;
  chosenHotel?: HotelOption;
  itineraryDays?: ItineraryDay[];
  shownRestaurantNames?: string[];
  shownAttractionNames?: string[];
  shownEventNames?: string[];
  /** Rich SerpAPI cards retained for itinerary map/contact enrichment. */
  shownPlaceOptions?: PlaceOption[];
  restaurantsShown?: boolean;
  attractionsShown?: boolean;
  eventsShown?: boolean;
  /** Standard chat checklist vs YouTube- / influencer-route-driven planning. */
  planningMode?: PlanningMode;
  youtubeSource?: YouTubeSourceMeta;
  youtubeAnalysis?: YouTubeTravelAnalysis;
  influencerSource?: InfluencerSourceMeta;
  status: "planning" | "confirmed";
  onboarding?: OnboardingContext;
}

export type ModelAction =
  | {
      type: "search_flights";
      args: { origin?: string; destination?: string; startDate?: string; endDate?: string };
    }
  | { type: "search_hotels"; args: { destination?: string; startDate?: string; endDate?: string } }
  | { type: "explore_destinations"; args: { origin?: string; region?: "europe" | "any" } }
  | { type: "search_places"; args: { destination?: string; category?: PlaceCategory } }
  | {
      type: "search_flexible_dates";
      args: { origin?: string; destination?: string; month?: string; tripLengthDays?: number };
    }
  | { type: "search_events"; args: { destination?: string; month?: string } }
  | { type: "search_day_plan"; args: { destination?: string } };

/** Drives the animated "what am I doing right now" label under the chat. */
export type ActivityKind =
  | "thinking"
  | "flights"
  | "flexible_dates"
  | "hotels"
  | "destinations"
  | "restaurants"
  | "attractions"
  | "events"
  | "day_plan"
  | "plan"
  | "youtube"
  | "influencer";

export interface ModelTurnResponse {
  turn: AssistantTurn;
  briefPatch: Partial<TripBrief>;
  action: ModelAction | null;
}

export type ChatStatus = "idle" | "awaiting_model" | "awaiting_tool" | "error";
