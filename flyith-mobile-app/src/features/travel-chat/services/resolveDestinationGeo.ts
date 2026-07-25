import type { TripBrief } from "../types";
import { getPlaceDetails } from "./serpapi";

export interface DestinationGeo {
  latitude: number;
  longitude: number;
  countryCode: string;
  canonicalName: string;
}

const cache = new Map<string, DestinationGeo | null>();

/** Common country-name → ISO 3166-1 alpha-2 for SerpAPI `gl`. */
const COUNTRY_TO_CODE: Record<string, string> = {
  turkey: "tr",
  türkiye: "tr",
  turkiye: "tr",
  france: "fr",
  italy: "it",
  spain: "es",
  germany: "de",
  "united kingdom": "uk",
  uk: "uk",
  england: "uk",
  scotland: "uk",
  wales: "uk",
  greece: "gr",
  portugal: "pt",
  netherlands: "nl",
  belgium: "be",
  switzerland: "ch",
  austria: "at",
  poland: "pl",
  "czech republic": "cz",
  czechia: "cz",
  hungary: "hu",
  croatia: "hr",
  japan: "jp",
  "south korea": "kr",
  korea: "kr",
  china: "cn",
  thailand: "th",
  vietnam: "vn",
  indonesia: "id",
  malaysia: "my",
  singapore: "sg",
  "united arab emirates": "ae",
  uae: "ae",
  "saudi arabia": "sa",
  egypt: "eg",
  morocco: "ma",
  "south africa": "za",
  mexico: "mx",
  brazil: "br",
  argentina: "ar",
  canada: "ca",
  australia: "au",
  "new zealand": "nz",
  india: "in",
  "united states": "us",
  usa: "us",
  "united states of america": "us",
};

function countryCodeFromAddress(address?: string): string | undefined {
  if (!address) return undefined;
  const parts = address
    .split(",")
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const code = COUNTRY_TO_CODE[parts[i]];
    if (code) return code;
  }
  return undefined;
}

/**
 * Resolve a destination city name to lat/lng + country once, then reuse.
 * Mirrors resolveAirport.ts — SerpAPI google_maps type=search for the city.
 */
export async function resolveDestinationGeo(destination: string): Promise<DestinationGeo | null> {
  const key = destination.trim().toLowerCase();
  if (!key) return null;
  if (cache.has(key)) return cache.get(key) ?? null;

  try {
    const response = await getPlaceDetails(destination);
    const place = response.place_results;
    const lat = place?.gps_coordinates?.latitude;
    const lng = place?.gps_coordinates?.longitude;
    if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) {
      cache.set(key, null);
      return null;
    }
    const geo: DestinationGeo = {
      latitude: lat,
      longitude: lng,
      countryCode: countryCodeFromAddress(place?.address) ?? "us",
      canonicalName: place?.title ?? destination,
    };
    cache.set(key, geo);
    return geo;
  } catch {
    cache.set(key, null);
    return null;
  }
}

/** Patch fields to write onto TripBrief when geo resolves. */
export function geoPatchFromResolved(geo: DestinationGeo): Partial<TripBrief> {
  return {
    destinationLatitude: geo.latitude,
    destinationLongitude: geo.longitude,
    destinationCountryCode: geo.countryCode,
    destinationCanonicalName: geo.canonicalName,
  };
}

/** True when brief already has usable coordinates. */
export function briefHasDestinationGeo(brief: TripBrief): boolean {
  return (
    brief.destinationLatitude != null &&
    brief.destinationLongitude != null &&
    Number.isFinite(brief.destinationLatitude) &&
    Number.isFinite(brief.destinationLongitude)
  );
}

/**
 * Ensure brief has geo fields. Returns a patch (possibly empty) to merge.
 * Uses cache so repeated searches for the same city cost one SerpAPI call.
 */
export async function ensureDestinationGeo(brief: TripBrief): Promise<Partial<TripBrief>> {
  if (briefHasDestinationGeo(brief) && brief.destinationCountryCode) return {};
  const destination = brief.destinationCanonicalName ?? brief.destination;
  if (!destination) return {};
  const geo = await resolveDestinationGeo(destination);
  if (!geo) return {};
  return geoPatchFromResolved(geo);
}
