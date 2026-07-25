import type { TripBrief } from "../types";
import type {
  ExploreParams,
  FlightSearchParams,
  HotelSearchParams,
  PlacesSearchParams,
} from "../services/serpapi";

const EXPLORE_INTEREST_IDS = {
  popular: "0",
  outdoors: "/g/11bc58l13w",
  beaches: "/m/0b3yr",
  museum: "/m/09cmq",
  history: "/m/03g3w",
  skiing: "/m/071k0",
} as const;

function adultsFromBrief(brief: TripBrief): number {
  return brief.adults ?? brief.travelers ?? 1;
}

function briefGl(brief: TripBrief): string {
  return brief.destinationCountryCode?.toLowerCase() ?? "us";
}

function briefLl(brief: TripBrief): string | undefined {
  if (brief.destinationLatitude == null || brief.destinationLongitude == null) return undefined;
  return `@${brief.destinationLatitude},${brief.destinationLongitude},13z`;
}

function destinationLabel(brief: TripBrief, fallback?: string): string {
  return brief.destinationCanonicalName ?? brief.destination ?? fallback ?? "";
}

/** Builds google_flights params from the collected brief preferences. */
export function flightParamsFromBrief(
  base: {
    origin: string;
    destination: string;
    outboundDate: string;
    returnDate?: string;
    departureToken?: string;
  },
  brief: TripBrief
): FlightSearchParams {
  return {
    ...base,
    travelClass: brief.travelClass,
    adults: adultsFromBrief(brief),
    children: brief.children,
    infantsInSeat: brief.infantsInSeat,
    infantsOnLap: brief.infantsOnLap,
    stops: brief.maxStops,
    bags: brief.carryOnBags,
    maxPrice: brief.maxFlightPriceUSD,
    outboundTimes: brief.outboundTimeWindow,
    layoverDuration: brief.layoverWindowMinutes,
    maxDuration: brief.maxDurationMinutes,
    emissions: brief.preferLowEmissions ? 1 : undefined,
    includeAirlines: brief.preferredAirlines?.join(","),
    excludeAirlines: brief.avoidAirlines?.join(","),
  };
}

/** Builds google_hotels params — amenity/neighborhood text folds into `q`. */
export function hotelParamsFromBrief(
  base: { destination: string; checkInDate: string; checkOutDate: string },
  brief: TripBrief,
  _locale: "tr" | "en" = "en"
): HotelSearchParams {
  const extras: string[] = [];
  if (brief.mustHaveAmenities?.length) extras.push(`with ${brief.mustHaveAmenities.join(" and ")}`);
  if (brief.neighborhoodPreference) extras.push(`in ${brief.neighborhoodPreference}`);
  if (brief.accommodationType && brief.accommodationType !== "hotel") {
    extras.push(brief.accommodationType);
  }

  const dest = destinationLabel(brief, base.destination) || base.destination;
  const query = [`${dest} hotels`, ...extras].join(" ").trim();

  return {
    query,
    checkInDate: base.checkInDate,
    checkOutDate: base.checkOutDate,
    adults: adultsFromBrief(brief),
    children: brief.children,
    childrenAges: brief.childrenAges?.join(","),
    minPrice: undefined,
    maxPrice: brief.maxPricePerNightUSD,
    rating: brief.hotelMinRating,
    hotelClass: brief.hotelClasses?.join(","),
    freeCancellation: brief.freeCancellationRequired || undefined,
    ecoCertified: brief.ecoCertifiedPreferred || undefined,
    vacationRentals: brief.vacationRentals || undefined,
    bedrooms: brief.bedrooms,
    sortBy: brief.hotelMinRating ? 8 : 3,
    gl: briefGl(brief),
    hl: "en",
  };
}

export function exploreParamsFromBrief(origin: string, brief: TripBrief): ExploreParams {
  return {
    origin,
    travelClass: brief.travelClass,
    adults: adultsFromBrief(brief),
    children: brief.children,
    infantsInSeat: brief.infantsInSeat,
    infantsOnLap: brief.infantsOnLap,
    stops: brief.maxStops,
    maxPrice: brief.maxFlightPriceUSD,
    travelDuration: brief.travelDurationPreset,
    interest: brief.exploreInterest ? EXPLORE_INTEREST_IDS[brief.exploreInterest] : undefined,
  };
}

export function placesParamsFromBrief(
  base: { query: string; location: string },
  brief: TripBrief,
  _locale: "tr" | "en" = "en"
): PlacesSearchParams {
  const location = destinationLabel(brief, base.location) || base.location;
  return {
    query: base.query,
    location,
    minRating: brief.minPlaceRating,
    openState: brief.openNowOnly ? "now" : undefined,
    gl: briefGl(brief),
    // Keep Google's numeric fields language-neutral. In Turkish, "184 B"
    // means 184 bin, but upstream parsers can read it as 184 billion.
    hl: "en",
    ll: briefLl(brief),
  };
}
