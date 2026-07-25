import { REQUIRED_BRIEF_FIELDS } from "../constants";
import type { TripBrief } from "../types";
import { coverage } from "./topicChecklist";

/** Minimum topics covered before the review chip is offered. */
export const MIN_TOPICS_FOR_REVIEW = 24;

const CITY_BOUND_SKIP_TOPICS = ["restaurants", "attractions", "day_plan", "events"] as const;

export function initialTripBrief(onboarding?: TripBrief["onboarding"]): TripBrief {
  return { status: "planning", onboarding };
}

export function mergeBriefPatch(brief: TripBrief, patch: Partial<TripBrief>): TripBrief {
  return { ...brief, ...patch };
}

/** Day plan is done when all three slots are picked, or the user explicitly skipped it. */
export function isDayPlanSettled(brief: TripBrief): boolean {
  if (brief.skippedTopics?.includes("day_plan")) return true;
  const selections = brief.dayPlanSelections;
  return Boolean(selections?.morning && selections?.afternoon && selections?.evening);
}

export function isReadyForReview(brief: TripBrief): boolean {
  if (brief.planningMode === "youtube") {
    return (
      Boolean(brief.destination) &&
      Boolean(brief.chosenFlight) &&
      Boolean(brief.youtubeAnalysis?.isTravelRelated) &&
      (brief.youtubeAnalysis?.places.length ?? 0) > 0
    );
  }
  const { covered } = coverage(brief);
  return (
    REQUIRED_BRIEF_FIELDS.every((field) => Boolean(brief[field])) &&
    Boolean(brief.chosenFlight) &&
    Boolean(brief.chosenHotel) &&
    Boolean(brief.restaurantsShown) &&
    Boolean(brief.attractionsShown) &&
    isDayPlanSettled(brief) &&
    covered >= MIN_TOPICS_FOR_REVIEW
  );
}

function normalizeDestination(value?: string): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * When the user pivots destination or dates mid-chat, drop city-/date-bound
 * selections so searches restart cleanly. Generic prefs (cabin, budget, style…) stay.
 */
export function revisionPatch(before: TripBrief, after: TripBrief): Partial<TripBrief> {
  const hadDestination = Boolean(before.destination || before.destinationAirportCode);
  const destChanged =
    hadDestination &&
    Boolean(after.destination) &&
    normalizeDestination(before.destination) !== normalizeDestination(after.destination);
  const datesChanged =
    hadDestination &&
    ((after.startDate !== undefined && after.startDate !== before.startDate) ||
      (after.endDate !== undefined && after.endDate !== before.endDate));

  if (!destChanged && !datesChanged) return {};

  if (destChanged) {
    const skipped = (before.skippedTopics ?? []).filter(
      (id) => !(CITY_BOUND_SKIP_TOPICS as readonly string[]).includes(id)
    );
    return {
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
      destinationAirportCode: undefined,
      destinationThumbnailUrl: undefined,
      destinationLatitude: undefined,
      destinationLongitude: undefined,
      destinationCountryCode: undefined,
      destinationCanonicalName: undefined,
      youtubeSource: undefined,
      youtubeAnalysis: undefined,
      planningMode: undefined,
      skippedTopics: skipped,
    };
  }

  // Dates only — keep city places, drop logistics + generated itinerary.
  return {
    chosenFlight: undefined,
    chosenHotel: undefined,
    itineraryDays: undefined,
  };
}

/** Topic ids to forget from asked/answered sets when a destination revision fires. */
export function revisionTopicIdsToForget(patch: Partial<TripBrief>): string[] {
  if (patch.dayPlanShown === undefined && patch.restaurantsShown === undefined) {
    // Date-only revision — only flight/hotel search topics need re-asking via fan-out.
    return [];
  }
  return ["restaurants", "attractions", "day_plan", "events"];
}
