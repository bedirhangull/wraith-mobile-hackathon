import type { ItineraryActivity, ItineraryDay, PlaceOption } from "../types";

export type ResolvedPlaceStatus = "resolved" | "partial" | "unresolved";

export interface ResolvedItineraryPlace {
  activityId: string;
  dayNumber: number;
  dayDate?: string;
  dayTitle: string;
  activity: ItineraryActivity;
  orderIndex: number;
  status: ResolvedPlaceStatus;
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  phone?: string;
  openState?: string;
  placeId?: string;
  dataId?: string;
  source: "activity" | "known" | "details" | "none";
}

export function normalizePlaceName(value: string | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function matchKnownPlace(
  placeName: string | undefined,
  knownPlaces: PlaceOption[] | undefined
): PlaceOption | undefined {
  const target = normalizePlaceName(placeName);
  if (!target || !knownPlaces?.length) return undefined;

  const exact = knownPlaces.find((place) => normalizePlaceName(place.name) === target);
  if (exact) return exact;

  return knownPlaces.find((place) => {
    const candidate = normalizePlaceName(place.name);
    if (!candidate) return false;
    return candidate.includes(target) || target.includes(candidate);
  });
}

export function activityStableId(
  day: Pick<ItineraryDay, "dayNumber" | "date" | "title">,
  activity: ItineraryActivity,
  index: number
): string {
  if (activity.id) return activity.id;
  return `${day.date ?? `day-${day.dayNumber}`}:${activity.time ?? index}:${activity.placeName ?? activity.title}`;
}

export function hasCoords(place: {
  latitude?: number;
  longitude?: number;
}): place is { latitude: number; longitude: number } {
  return (
    typeof place.latitude === "number" &&
    Number.isFinite(place.latitude) &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.longitude)
  );
}

export function resolveStatus(place: {
  latitude?: number;
  longitude?: number;
  phone?: string;
  address?: string;
}): ResolvedPlaceStatus {
  const coordsOk =
    typeof place.latitude === "number" &&
    Number.isFinite(place.latitude) &&
    typeof place.longitude === "number" &&
    Number.isFinite(place.longitude);
  if (coordsOk) return place.phone || place.address ? "resolved" : "partial";
  if (place.phone || place.address) return "partial";
  return "unresolved";
}

export function buildSeedPlace(
  day: ItineraryDay,
  activity: ItineraryActivity,
  index: number,
  knownPlaces: PlaceOption[] | undefined
): ResolvedItineraryPlace {
  const activityId = activityStableId(day, activity, index);
  const known = matchKnownPlace(activity.placeName, knownPlaces);
  const latitude = activity.latitude ?? known?.latitude;
  const longitude = activity.longitude ?? known?.longitude;
  const address = activity.address ?? known?.address;
  const phone = activity.phone ?? known?.phone;
  const openState = activity.openState ?? known?.openState;
  const placeId = activity.placeId ?? known?.id;
  const dataId = activity.dataId ?? known?.dataId;
  const source: ResolvedItineraryPlace["source"] =
    activity.latitude != null || activity.phone || activity.address
      ? "activity"
      : known
        ? "known"
        : "none";

  return {
    activityId,
    dayNumber: day.dayNumber,
    dayDate: day.date,
    dayTitle: day.title,
    activity: { ...activity, id: activityId },
    orderIndex: index,
    status: resolveStatus({ latitude, longitude, phone, address }),
    name: activity.placeName ?? activity.title,
    latitude,
    longitude,
    address,
    phone,
    openState,
    placeId,
    dataId,
    source,
  };
}

export function buildGoogleMapsDirectionsUrl(
  coords: { latitude: number; longitude: number }[]
): string | null {
  if (coords.length < 2) return null;
  const origin = coords[0]!;
  const destination = coords[coords.length - 1]!;
  const waypoints = coords.slice(1, -1);
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.latitude},${origin.longitude}`,
    destination: `${destination.latitude},${destination.longitude}`,
    travelmode: "walking",
  });
  if (waypoints.length > 0) {
    params.set(
      "waypoints",
      waypoints.map((point) => `${point.latitude},${point.longitude}`).join("|")
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

export function mapsSearchUrl(place: {
  name: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}): string {
  if (hasCoords(place)) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  const query = place.address || place.name;
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
