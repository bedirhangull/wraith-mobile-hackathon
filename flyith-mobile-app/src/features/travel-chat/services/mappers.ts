import type {
  BookingOption,
  DestinationOption,
  FlightOption,
  HotelOption,
  PhotoItem,
  PhotoSection,
  PlaceDetail,
  PlaceOption,
  ReviewItem,
} from "../types";
import { normalizeReviewCount } from "../utils/formatReviewCount";
import { generateId } from "../utils/ids";
import type {
  SerpApiBookingOptionsResponse,
  SerpApiExploreResponse,
  SerpApiFlightItinerary,
  SerpApiFlightsResponse,
  SerpApiHotelPhotosResponse,
  SerpApiHotelReviewsResponse,
  SerpApiHotelsResponse,
  SerpApiLocalResponse,
  SerpApiMapsPhotosResponse,
  SerpApiMapsReviewsResponse,
  SerpApiPlaceDetailsResponse,
  SerpApiReviewUser,
} from "./serpapi.types";

export function mapFlights(response: SerpApiFlightsResponse): FlightOption[] {
  const itineraries: SerpApiFlightItinerary[] = [
    ...(response.best_flights ?? []),
    ...(response.other_flights ?? []),
  ];

  return itineraries.slice(0, 5).map((itinerary) => {
    const firstLeg = itinerary.flights[0];
    const lastLeg = itinerary.flights[itinerary.flights.length - 1];
    return {
      id: generateId(),
      airline: firstLeg?.airline ?? "Unknown airline",
      airlineLogoUrl: itinerary.airline_logo ?? firstLeg?.airline_logo,
      departureAirport: firstLeg?.departure_airport.id ?? "",
      arrivalAirport: lastLeg?.arrival_airport.id ?? "",
      departureTime: firstLeg?.departure_airport.time ?? "",
      arrivalTime: lastLeg?.arrival_airport.time ?? "",
      durationMinutes: itinerary.total_duration,
      stops: Math.max(itinerary.flights.length - 1, 0),
      priceUSD: itinerary.price,
      bookingToken: itinerary.booking_token,
      departureToken: itinerary.departure_token,
    };
  });
}

export function mapHotels(response: SerpApiHotelsResponse): HotelOption[] {
  return (response.properties ?? []).slice(0, 5).map((property) => ({
    id: property.property_token ?? generateId(),
    name: property.name,
    thumbnailUrl: property.images?.[0]?.thumbnail,
    pricePerNightUSD: property.rate_per_night?.extracted_lowest,
    totalPriceUSD: property.total_rate?.extracted_lowest,
    rating: property.overall_rating,
    reviewCount: normalizeReviewCount(property.reviews),
    hotelClass: property.hotel_class
      ? Number.parseInt(property.hotel_class, 10) || undefined
      : undefined,
    amenities: property.amenities,
    propertyToken: property.property_token,
  }));
}

export function mapDestinations(response: SerpApiExploreResponse): DestinationOption[] {
  return (response.destinations ?? []).slice(0, 10).map((destination) => ({
    id: destination.destination_id,
    name: destination.name,
    countryOrRegion: destination.country,
    thumbnailUrl: destination.thumbnail,
    estimatedPriceUSD:
      destination.flight_price !== undefined && destination.hotel_price !== undefined
        ? destination.flight_price + destination.hotel_price
        : destination.flight_price,
    airportCode: destination.destination_airport?.code,
  }));
}

export function mapPlaces(response: SerpApiLocalResponse): PlaceOption[] {
  return (response.local_results ?? []).slice(0, 8).map((place) => ({
    id: place.place_id ?? generateId(),
    name: place.title,
    category: place.type ?? "Place",
    rating: place.rating,
    reviewCount: normalizeReviewCount(place.reviews),
    priceLevel: place.price,
    thumbnailUrl: place.thumbnail,
    address: place.address,
    description: place.description,
    latitude: place.gps_coordinates?.latitude,
    longitude: place.gps_coordinates?.longitude,
    phone: place.phone,
    dataId: place.data_id,
    openState: place.open_state,
    operatingHours: place.operating_hours,
  }));
}

// Not a separate engine — booking options come from `google_flights` +
// `booking_token` (see services/serpapi.ts's getBookingOptions).
export function mapBookingOptions(response: SerpApiBookingOptionsResponse): BookingOption[] {
  return (response.booking_options ?? [])
    .map((option) => option.together)
    .filter((together): together is NonNullable<typeof together> => Boolean(together))
    .slice(0, 6)
    .map((together) => ({
      id: generateId(),
      bookWith: together.book_with ?? "Unknown",
      airlineLogoUrl: together.airline_logos?.[0],
      priceUSD: together.price,
      optionTitle: together.option_title,
      extensions: together.extensions,
      bookingUrl: together.booking_request?.url,
      bookingPostData: together.booking_request?.post_data,
    }));
}

export function mapHotelPhotoSections(response: SerpApiHotelPhotosResponse): PhotoSection[] {
  return (response.sections ?? [])
    .filter((section) => (section.photos?.length ?? 0) > 0)
    .map((section) => ({
      title: section.title,
      photos: (section.photos ?? []).slice(0, 20).map((photo) => ({
        id: generateId(),
        thumbnailUrl: photo.thumbnail_url ?? photo.photo_url ?? "",
        fullUrl: photo.photo_url ?? photo.thumbnail_url ?? "",
      })),
    }));
}

function mapReviewUser(user: SerpApiReviewUser): ReviewItem["user"] {
  return {
    name: user.name,
    avatarUrl: user.thumbnail,
    profileUrl: user.link,
    isLocalGuide: user.local_guide,
  };
}

export function mapHotelReviews(response: SerpApiHotelReviewsResponse): ReviewItem[] {
  return (response.reviews ?? []).slice(0, 15).map((review) => ({
    id: generateId(),
    user: mapReviewUser(review.user),
    rating: review.rating,
    date: review.date,
    snippet: review.snippet,
  }));
}

export function mapPlaceDetails(response: SerpApiPlaceDetailsResponse): PlaceDetail | null {
  const place = response.place_results;
  if (!place) return null;
  const todayName = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const todayHours = place.hours?.find((entry) => todayName in entry)?.[todayName];
  const mapsUrl =
    place.gps_coordinates !== undefined
      ? `https://www.google.com/maps/search/?api=1&query=${place.gps_coordinates.latitude},${place.gps_coordinates.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.title)}`;
  return {
    name: place.title,
    rating: place.rating,
    reviewCount: normalizeReviewCount(place.reviews),
    phone: place.phone,
    address: place.address,
    todayHours,
    mapsUrl,
    latitude: place.gps_coordinates?.latitude,
    longitude: place.gps_coordinates?.longitude,
    dataId: place.data_id,
  };
}

export function mapMapsPhotos(response: SerpApiMapsPhotosResponse): PhotoItem[] {
  return (response.photos ?? []).slice(0, 20).map((photo) => ({
    id: generateId(),
    thumbnailUrl: photo.thumbnail ?? photo.image ?? "",
    fullUrl: photo.image ?? photo.thumbnail ?? "",
  }));
}

export function mapMapsReviews(response: SerpApiMapsReviewsResponse): ReviewItem[] {
  return (response.reviews ?? []).slice(0, 15).map((review) => ({
    id: generateId(),
    user: mapReviewUser(review.user),
    rating: review.rating,
    date: review.date,
    snippet: review.snippet,
  }));
}
