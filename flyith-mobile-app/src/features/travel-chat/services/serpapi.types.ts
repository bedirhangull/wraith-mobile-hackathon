// Shapes confirmed against live SerpAPI responses during the implementation
// verification spike (google_flights, google_hotels, google_travel_explore).
// Only the fields this app actually reads are declared — SerpAPI returns
// many more.

export interface SerpApiFlightLeg {
  departure_airport: { name: string; id: string; time: string };
  arrival_airport: { name: string; id: string; time: string };
  duration: number;
  airline: string;
  airline_logo?: string;
  flight_number?: string;
}

export interface SerpApiFlightItinerary {
  flights: SerpApiFlightLeg[];
  total_duration: number;
  price: number;
  airline_logo?: string;
  layovers?: { name: string; id: string; duration: number }[];
  booking_token?: string;
  // Present on a round-trip's outbound-only result; must be sent back as
  // `departure_token` to fetch the return leg, whose result then carries the
  // real `booking_token`. One-way searches return `booking_token` directly.
  departure_token?: string;
}

export interface SerpApiFlightsResponse {
  best_flights?: SerpApiFlightItinerary[];
  other_flights?: SerpApiFlightItinerary[];
  error?: string;
}

export interface SerpApiHotelProperty {
  name: string;
  property_token?: string;
  hotel_class?: string;
  overall_rating?: number;
  reviews?: number;
  amenities?: string[];
  images?: { thumbnail?: string; original_image?: string }[];
  rate_per_night?: { extracted_lowest?: number };
  total_rate?: { extracted_lowest?: number };
}

export interface SerpApiHotelsResponse {
  properties?: SerpApiHotelProperty[];
  error?: string;
}

export interface SerpApiExploreDestination {
  destination_id: string;
  name: string;
  country?: string;
  thumbnail?: string;
  flight_price?: number;
  hotel_price?: number;
  destination_airport?: { code?: string };
}

export interface SerpApiExploreResponse {
  destinations?: SerpApiExploreDestination[];
  error?: string;
}

export interface SerpApiAirport {
  name: string;
  type: "city" | "region" | string;
  id?: string;
  airports?: { name: string; id: string; city: string }[];
}

export interface SerpApiFlightAutocompleteResponse {
  suggestions?: SerpApiAirport[];
  error?: string;
}

export interface SerpApiHotelAutocompleteSuggestion {
  value: string;
  type: string;
  autocomplete_suggestion: string;
}

export interface SerpApiHotelAutocompleteResponse {
  suggestions?: SerpApiHotelAutocompleteSuggestion[];
  error?: string;
}

export interface SerpApiLocalResult {
  title: string;
  type?: string;
  rating?: number;
  reviews?: number;
  price?: string;
  description?: string;
  thumbnail?: string;
  address?: string;
  phone?: string;
  place_id?: string;
  data_id?: string;
  open_state?: string;
  operating_hours?: Record<string, string>;
  hours?: string;
  gps_coordinates?: { latitude: number; longitude: number };
}

export interface SerpApiLocalResponse {
  local_results?: SerpApiLocalResult[];
  error?: string;
}

// google_flights called again with a `booking_token` param (NOT a separate
// "google_flights_booking_options" engine — that name doesn't exist, confirmed
// live: it returns "Unsupported search engine").
export interface SerpApiBookingOption {
  together?: {
    book_with?: string;
    airline_logos?: string[];
    marketed_as?: string[];
    price?: number;
    option_title?: string;
    extensions?: string[];
    baggage_prices?: string[];
    booking_request?: { url?: string; post_data?: string };
  };
}

export interface SerpApiBookingOptionsResponse {
  booking_options?: SerpApiBookingOption[];
  error?: string;
}

// google_hotels_photos (param: property_token)
export interface SerpApiHotelPhoto {
  thumbnail_url?: string;
  photo_url?: string;
  source?: string;
}

export interface SerpApiHotelPhotoSection {
  title: string;
  total?: number;
  photos?: SerpApiHotelPhoto[];
}

export interface SerpApiHotelPhotosResponse {
  sections?: SerpApiHotelPhotoSection[];
  error?: string;
}

// google_hotels_reviews (param: property_token)
export interface SerpApiReviewUser {
  name: string;
  link?: string;
  thumbnail?: string;
  local_guide?: boolean;
  reviews?: number;
  photos?: number;
}

export interface SerpApiHotelReview {
  user: SerpApiReviewUser;
  rating?: number;
  best_rating?: number;
  date?: string;
  snippet?: string;
  hotel_highlights?: string[];
}

export interface SerpApiHotelReviewsResponse {
  reviews?: SerpApiHotelReview[];
  error?: string;
}

// google_maps (direct place search, type=search) — returns `place_results`
// when the query resolves to a single specific place.
export interface SerpApiPlaceResult {
  title: string;
  data_id?: string;
  place_id?: string;
  gps_coordinates?: { latitude: number; longitude: number };
  rating?: number;
  reviews?: number;
  phone?: string;
  address?: string;
  type?: string;
  thumbnail?: string;
  hours?: Record<string, string>[];
}

export interface SerpApiPlaceDetailsResponse {
  place_results?: SerpApiPlaceResult;
  error?: string;
}

// google_maps_photos (param: data_id, from SerpApiPlaceResult.data_id)
export interface SerpApiMapsPhoto {
  thumbnail?: string;
  image?: string;
}

export interface SerpApiMapsPhotosResponse {
  photos?: SerpApiMapsPhoto[];
  error?: string;
}

// google_maps_reviews (param: data_id)
export interface SerpApiMapsReview {
  user: SerpApiReviewUser;
  rating?: number;
  date?: string;
  snippet?: string;
  images?: string[];
}

export interface SerpApiMapsReviewsResponse {
  reviews?: SerpApiMapsReview[];
  error?: string;
}

// youtube_video — metadata card + optional transcript link probe
export interface SerpApiYouTubeChannel {
  name: string;
  thumbnail?: string;
  link?: string;
  subscribers?: string;
  extracted_subscribers?: number;
}

export interface SerpApiYouTubeDescription {
  content?: string;
  links?: { start_index?: number; length?: number; text?: string; url?: string }[];
}

export interface SerpApiYouTubeVideoChapter {
  title: string;
  time_start: number;
  thumbnail?: string;
}

export interface SerpApiYouTubeVideoResponse {
  title?: string;
  thumbnail?: string;
  channel?: SerpApiYouTubeChannel;
  views?: string;
  extracted_views?: number;
  likes?: string;
  extracted_likes?: number;
  published_date?: string;
  description?: SerpApiYouTubeDescription;
  chapters?: SerpApiYouTubeVideoChapter[];
  /** Presence of serpapi_link signals a transcript is available. */
  transcript?: { serpapi_link?: string };
  error?: string;
}

// youtube_video_transcript — timed segments + chapter alignment
export interface SerpApiYouTubeTranscriptSegment {
  start_ms: number;
  snippet: string;
  start_time_text?: string;
  start_time_label?: string;
}

export interface SerpApiYouTubeTranscriptChapter {
  chapter: string;
  start_ms: number;
  start_time_text?: string;
}

export interface SerpApiYouTubeTranscriptResponse {
  transcript?: SerpApiYouTubeTranscriptSegment[];
  chapters?: SerpApiYouTubeTranscriptChapter[];
  error?: string;
}
