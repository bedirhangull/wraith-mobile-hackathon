import type { AssistantTurn } from "../types";

/**
 * Interactive turns demand a user response before the next one may appear.
 * Non-interactive turns (text bridges, images, tool_outcome) always flush immediately.
 */
export function isInteractiveTurn(turn: AssistantTurn): boolean {
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

/**
 * Topic questions are queued as recipes, not concrete turns, so flush can
 * rebuild them against the latest brief (avoids stale "where to go?" after
 * the user already named a city).
 *
 * `topicId` on turn steps lets selection handlers drop queued preference
 * questions for a group that was just locked (e.g. cabin/stops after flight pick).
 */
export type QueuedStep =
  { kind: "turn"; turn: AssistantTurn; topicId?: string } | { kind: "next_topic"; prompt?: string };
