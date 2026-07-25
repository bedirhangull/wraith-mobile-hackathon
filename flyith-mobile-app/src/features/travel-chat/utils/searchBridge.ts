import type { ActivityKind, AssistantTurn, ModelAction, TripBrief } from "../types";
import { creativeResearchReady, creativeSearchFailed, creativeSearchReady } from "./chatCopy";

type Locale = "tr" | "en";

/** Short bridge line when a background search lands mid-conversation. */
export function searchReadyBridge(
  actionType: ModelAction["type"],
  locale: Locale,
  isRefresh = false
): string {
  return isRefresh
    ? creativeResearchReady(actionType, locale)
    : creativeSearchReady(actionType, locale);
}

export function searchFailedBridge(actionType: ModelAction["type"], locale: Locale): string {
  return creativeSearchFailed(actionType, locale);
}

export function hasLogistics(brief: TripBrief): boolean {
  return Boolean(
    (brief.destination || brief.destinationAirportCode) &&
    brief.originAirportCode &&
    brief.startDate &&
    brief.endDate
  );
}

export function activityLabelForSearch(activity: ActivityKind | undefined, locale: Locale): string {
  if (!activity) return locale === "tr" ? "Aranıyor…" : "Searching…";
  if (locale === "tr") {
    switch (activity) {
      case "flights":
        return "Uçuşlar aranıyor…";
      case "hotels":
        return "Oteller aranıyor…";
      case "flexible_dates":
        return "Tarihler taranıyor…";
      case "restaurants":
        return "Restoranlar aranıyor…";
      case "attractions":
        return "Gezilecek yerler aranıyor…";
      case "events":
        return "Etkinlikler aranıyor…";
      case "destinations":
        return "Rotalar aranıyor…";
      case "day_plan":
        return "Gün planı hazırlanıyor…";
      case "plan":
        return "Plan hazırlanıyor…";
      case "youtube":
        return "Video analiz ediliyor…";
      default:
        return "Aranıyor…";
    }
  }
  switch (activity) {
    case "flights":
      return "Searching flights…";
    case "hotels":
      return "Searching hotels…";
    case "flexible_dates":
      return "Scanning dates…";
    case "restaurants":
      return "Finding restaurants…";
    case "attractions":
      return "Finding things to do…";
    case "events":
      return "Looking up events…";
    case "destinations":
      return "Exploring destinations…";
    case "day_plan":
      return "Building your day…";
    case "plan":
      return "Building your plan…";
    case "youtube":
      return "Analyzing the video…";
    default:
      return "Searching…";
  }
}

/**
 * Turns that already pose a choice — including option cards. While one of these
 * is open, the engine must not stack another checklist question on top.
 */
export function turnAsksAQuestion(turn: AssistantTurn): boolean {
  switch (turn.kind) {
    case "suggestions":
      return turn.chips.length >= 1;
    case "question":
    case "flight_options":
    case "hotel_options":
    case "places":
    case "date_options":
    case "destination_inspiration":
    case "day_plan":
      return true;
    default:
      return false;
  }
}

/** Searches that surface a pick-one card list — never stack a checklist question on top. */
export function isCardSearchAction(action: ModelAction | null | undefined): boolean {
  if (!action) return false;
  switch (action.type) {
    case "search_flights":
    case "search_hotels":
    case "search_flexible_dates":
    case "explore_destinations":
    case "search_places":
    case "search_events":
    case "search_day_plan":
      return true;
    default:
      return false;
  }
}
