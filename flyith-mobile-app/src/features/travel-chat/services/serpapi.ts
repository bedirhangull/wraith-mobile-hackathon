import { env } from "@/config/env";

import { SERPAPI_TIMEOUT_MS } from "../constants";
import { isTransientNetworkError, withTimeout } from "../utils/withTimeout";
import type {
  SerpApiBookingOptionsResponse,
  SerpApiExploreResponse,
  SerpApiFlightAutocompleteResponse,
  SerpApiFlightsResponse,
  SerpApiHotelAutocompleteResponse,
  SerpApiHotelPhotosResponse,
  SerpApiHotelReviewsResponse,
  SerpApiHotelsResponse,
  SerpApiLocalResponse,
  SerpApiMapsPhotosResponse,
  SerpApiMapsReviewsResponse,
  SerpApiPlaceDetailsResponse,
  SerpApiYouTubeTranscriptResponse,
  SerpApiYouTubeVideoResponse,
} from "./serpapi.types";

const SERPAPI_BASE_URL = "https://serpapi.com/search.json";

export type SerpApiErrorKind = "timeout" | "http" | "no_results";

export class SerpApiError extends Error {
  readonly kind: SerpApiErrorKind;

  constructor(kind: SerpApiErrorKind, message: string) {
    super(message);
    this.name = "SerpApiError";
    this.kind = kind;
  }
}

// Plain fetch against SerpAPI's REST endpoint, not the `serpapi` npm package —
// that package is Node-oriented (callback-based `getJson`), which carries the
// same Metro/Hermes bundling risk as the Gemini SDK. A REST GET needs nothing
// the RN runtime doesn't already provide.
async function serpApiGet<T extends { error?: string }>(
  params: Record<string, string | number | undefined>
): Promise<T> {
  const query = new URLSearchParams({ api_key: env.serpApiKey });
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }

  try {
    // Soft timeout — never AbortController (RN cancels → FetchRequestCanceledException).
    const response = await withTimeout(
      fetch(`${SERPAPI_BASE_URL}?${query.toString()}`),
      SERPAPI_TIMEOUT_MS,
      "SerpAPI"
    );
    if (!response.ok) {
      throw new SerpApiError("http", `SerpAPI request failed (${response.status})`);
    }
    const json = (await response.json()) as T;
    // SerpAPI often returns HTTP 200 with an `error` field when Google has
    // nothing (e.g. "Google Flights hasn't returned any results for this query").
    if (typeof json.error === "string" && json.error.length > 0) {
      throw new SerpApiError("no_results", json.error);
    }
    return json;
  } catch (error) {
    if (error instanceof SerpApiError) throw error;
    if (
      isTransientNetworkError(error) &&
      error instanceof Error &&
      error.message.toLowerCase().includes("timed out")
    ) {
      throw new SerpApiError("timeout", "SerpAPI request timed out");
    }
    throw error;
  }
}

export interface FlightSearchParams {
  origin: string;
  destination: string;
  outboundDate: string;
  returnDate?: string;
  // Resolves a round-trip's return leg (and its real booking_token) from the
  // departure_token an earlier outbound-only search returned.
  departureToken?: string;
  travelClass?: number;
  adults?: number;
  children?: number;
  infantsInSeat?: number;
  infantsOnLap?: number;
  stops?: number;
  bags?: number;
  maxPrice?: number;
  outboundTimes?: string;
  returnTimes?: string;
  layoverDuration?: string;
  maxDuration?: number;
  emissions?: number;
  includeAirlines?: string;
  excludeAirlines?: string;
  sortBy?: number;
}

export function searchFlights(params: FlightSearchParams): Promise<SerpApiFlightsResponse> {
  return serpApiGet({
    engine: "google_flights",
    hl: "en",
    gl: "us",
    currency: "USD",
    departure_id: params.origin,
    arrival_id: params.destination,
    outbound_date: params.outboundDate,
    departure_token: params.departureToken,
    return_date: params.returnDate,
    // google_flights defaults to type=1 (round trip), which requires a return
    // date — be explicit so a one-way conversation (no return date yet) doesn't
    // implicitly ask for a round trip it can't fulfill.
    type: params.returnDate ? 1 : 2,
    travel_class: params.travelClass,
    adults: params.adults,
    children: params.children,
    infants_in_seat: params.infantsInSeat,
    infants_on_lap: params.infantsOnLap,
    stops: params.stops,
    bags: params.bags,
    max_price: params.maxPrice,
    outbound_times: params.outboundTimes,
    return_times: params.returnTimes,
    layover_duration: params.layoverDuration,
    max_duration: params.maxDuration,
    emissions: params.emissions,
    include_airlines: params.includeAirlines,
    exclude_airlines: params.excludeAirlines,
    sort_by: params.sortBy,
  });
}

export interface HotelSearchParams {
  query: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  children?: number;
  childrenAges?: string;
  minPrice?: number;
  maxPrice?: number;
  rating?: number;
  hotelClass?: string;
  freeCancellation?: boolean;
  ecoCertified?: boolean;
  vacationRentals?: boolean;
  bedrooms?: number;
  sortBy?: number;
  /** ISO country code for SerpAPI `gl` (defaults to us only as last resort). */
  gl?: string;
  hl?: string;
}

export function searchHotels(params: HotelSearchParams): Promise<SerpApiHotelsResponse> {
  return serpApiGet({
    engine: "google_hotels",
    hl: params.hl ?? "en",
    gl: params.gl ?? "us",
    currency: "USD",
    q: params.query,
    check_in_date: params.checkInDate,
    check_out_date: params.checkOutDate,
    adults: params.adults,
    children: params.children,
    children_ages: params.childrenAges,
    min_price: params.minPrice,
    max_price: params.maxPrice,
    rating: params.rating,
    hotel_class: params.hotelClass,
    free_cancellation: params.freeCancellation ? "true" : undefined,
    eco_certified: params.ecoCertified ? "true" : undefined,
    vacation_rentals: params.vacationRentals ? "true" : undefined,
    bedrooms: params.bedrooms,
    sort_by: params.sortBy,
  });
}

export interface ExploreParams {
  origin: string;
  month?: string;
  travelDuration?: number;
  interest?: string;
  travelClass?: number;
  adults?: number;
  children?: number;
  infantsInSeat?: number;
  infantsOnLap?: number;
  stops?: number;
  maxPrice?: number;
}

export function exploreDestinations(params: ExploreParams): Promise<SerpApiExploreResponse> {
  return serpApiGet({
    engine: "google_travel_explore",
    hl: "en",
    gl: "us",
    currency: "USD",
    departure_id: params.origin,
    month: params.month,
    travel_duration: params.travelDuration,
    interest: params.interest,
    travel_class: params.travelClass,
    adults: params.adults,
    children: params.children,
    infants_in_seat: params.infantsInSeat,
    infants_on_lap: params.infantsOnLap,
    stops: params.stops,
    max_price: params.maxPrice,
  });
}

export interface PlacesSearchParams {
  query: string;
  location: string;
  minRating?: number;
  openState?: string;
  /** ISO country code for SerpAPI `gl`. */
  gl?: string;
  hl?: string;
  /** Map center — `@lat,lng,zoom` — strongest geographic anchor. */
  ll?: string;
}

export function searchPlaces(params: PlacesSearchParams): Promise<SerpApiLocalResponse> {
  return serpApiGet({
    engine: "google_local",
    hl: params.hl ?? "en",
    gl: params.gl ?? "us",
    q: params.query,
    location: params.location,
    ll: params.ll,
    min_rating: params.minRating,
    open_state: params.openState,
  });
}

export function autocompleteFlights(query: string): Promise<SerpApiFlightAutocompleteResponse> {
  return serpApiGet({ engine: "google_flights_autocomplete", hl: "en", gl: "us", q: query });
}

export function autocompleteHotels(query: string): Promise<SerpApiHotelAutocompleteResponse> {
  return serpApiGet({ engine: "google_hotels_autocomplete", q: query, currency: "USD" });
}

export interface BookingOptionsParams {
  bookingToken: string;
}

// Not a separate engine — `google_flights_booking_options` returns "Unsupported
// search engine" (confirmed live). Booking options come from calling
// `google_flights` again with the same route/dates plus `booking_token`.
export function getBookingOptions(
  params: BookingOptionsParams
): Promise<SerpApiBookingOptionsResponse> {
  return serpApiGet({
    engine: "google_flights",
    hl: "en",
    gl: "us",
    currency: "USD",
    booking_token: params.bookingToken,
  });
}

export function getHotelPhotos(propertyToken: string): Promise<SerpApiHotelPhotosResponse> {
  return serpApiGet({ engine: "google_hotels_photos", property_token: propertyToken });
}

export function getHotelReviews(propertyToken: string): Promise<SerpApiHotelReviewsResponse> {
  return serpApiGet({ engine: "google_hotels_reviews", property_token: propertyToken });
}

export function getPlaceDetails(
  query: string,
  options?: { gl?: string; hl?: string; ll?: string }
): Promise<SerpApiPlaceDetailsResponse> {
  return serpApiGet({
    engine: "google_maps",
    hl: options?.hl ?? "en",
    gl: options?.gl ?? "us",
    q: query,
    type: "search",
    ll: options?.ll,
  });
}

export function getPlacePhotos(dataId: string): Promise<SerpApiMapsPhotosResponse> {
  return serpApiGet({ engine: "google_maps_photos", data_id: dataId, hl: "en" });
}

export function getPlaceReviews(dataId: string): Promise<SerpApiMapsReviewsResponse> {
  return serpApiGet({ engine: "google_maps_reviews", data_id: dataId, hl: "en" });
}

export function getYouTubeVideo(videoId: string): Promise<SerpApiYouTubeVideoResponse> {
  return serpApiGet({ engine: "youtube_video", v: videoId });
}

export function getYouTubeTranscript(
  videoId: string,
  languageCode = "en"
): Promise<SerpApiYouTubeTranscriptResponse> {
  return serpApiGet({
    engine: "youtube_video_transcript",
    v: videoId,
    language_code: languageCode,
  });
}
