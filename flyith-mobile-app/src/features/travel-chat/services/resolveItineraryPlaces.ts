import type { ItineraryActivity, PlaceOption } from "../types";
import { mapPlaceDetails } from "./mappers";
import { getPlaceDetails } from "./serpapi";

// ─── Public types ─────────────────────────────────────────────────────────────

/**
 * ItineraryActivity enriched with place-detail fields resolved from SerpAPI.
 * Matches the shape the parent will extend onto ItineraryActivity; all added
 * fields are optional so that the type is backwards-compatible.
 */
export interface ResolvedActivity extends ItineraryActivity {
  /** Stable activity-level id — set by the parent, not this resolver. */
  id?: string;
  /** SerpAPI `place_id` from a matched PlaceOption, or `data_id` from a live fetch. */
  placeId?: string;
  /** SerpAPI `data_id` — enables follow-up photos/reviews calls. */
  dataId?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  phone?: string;
  openState?: string;
}

export interface ResolveItineraryPlacesOptions {
  /**
   * Destination city appended to SerpAPI queries to disambiguate place names.
   * E.g. "Paris" so "Le Jules Verne" → "Le Jules Verne Paris".
   */
  destination?: string;
  /** ISO 3166-1 alpha-2 country code for SerpAPI `gl` param. Defaults to "us". */
  gl?: string;
}

// ─── Module-level cache ───────────────────────────────────────────────────────

type CachedDetails = Pick<
  ResolvedActivity,
  "placeId" | "dataId" | "latitude" | "longitude" | "address" | "phone" | "openState"
>;

/** Persists across component mounts — one SerpAPI call per unique place name per app session. */
const detailCache = new Map<string, CachedDetails>();

// ─── Helpers ─────────────────────────────────────────────────────────────────

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function placeOptionToDetails(place: PlaceOption): CachedDetails {
  return {
    placeId: place.id,
    dataId: place.dataId,
    latitude: place.latitude,
    longitude: place.longitude,
    address: place.address,
    openState: place.openState,
    phone: place.phone,
  };
}

async function fetchFromSerpApi(
  placeName: string,
  options?: ResolveItineraryPlacesOptions,
): Promise<CachedDetails> {
  // Append destination to reduce geo-ambiguity
  const query = options?.destination ? `${placeName}, ${options.destination}` : placeName;
  try {
    const response = await getPlaceDetails(query, { gl: options?.gl ?? "us" });
    const detail = mapPlaceDetails(response);
    if (!detail) return {};
    return {
      placeId: detail.dataId,
      dataId: detail.dataId,
      latitude: detail.latitude,
      longitude: detail.longitude,
      address: detail.address,
      phone: detail.phone,
      openState: undefined,
    };
  } catch {
    // Non-fatal — return empty shell so the activity is still included in output
    return {};
  }
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve enriched place details for every ItineraryActivity that carries a
 * `placeName`. Matching strategy (in order):
 *
 * 1. Normalize the activity's `placeName` and look it up in `knownPlaces`
 *    (O(1), no network cost).
 * 2. Check the module-level cache (survives component remounts within the
 *    same app session).
 * 3. Lazily fetch via SerpAPI `google_maps` search, limited to 5 concurrent
 *    requests and deduplicated so identical names only trigger one call.
 *
 * The returned array has the same length and order as `activities`.
 */
export async function resolveItineraryPlaces(
  activities: ItineraryActivity[],
  knownPlaces: PlaceOption[],
  options?: ResolveItineraryPlacesOptions,
): Promise<ResolvedActivity[]> {
  // Seed cache from known places — free, no network needed
  for (const place of knownPlaces) {
    const key = normalizeName(place.name);
    if (!detailCache.has(key)) {
      detailCache.set(key, placeOptionToDetails(place));
    }
  }

  // Collect unique names that still require a remote fetch
  const toFetch: string[] = [];
  const queued = new Set<string>();

  for (const activity of activities) {
    if (!activity.placeName) continue;
    const key = normalizeName(activity.placeName);
    if (detailCache.has(key) || queued.has(key)) continue;
    queued.add(key);
    toFetch.push(activity.placeName);
  }

  // Bounded concurrency — at most 5 parallel SerpAPI requests
  const CONCURRENCY = 5;
  for (let i = 0; i < toFetch.length; i += CONCURRENCY) {
    const chunk = toFetch.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map(async (name) => {
        const key = normalizeName(name);
        const details = await fetchFromSerpApi(name, options);
        detailCache.set(key, details);
      }),
    );
  }

  // Build result — same length/order as input, spread cached details onto each activity
  return activities.map((activity): ResolvedActivity => {
    if (!activity.placeName) return { ...activity };
    const key = normalizeName(activity.placeName);
    const cached = detailCache.get(key);
    if (!cached) return { ...activity };
    return { ...activity, ...cached };
  });
}

/** Clear the module cache. Intended for tests or forced place-data refresh. */
export function clearItineraryPlacesCache(): void {
  detailCache.clear();
}
