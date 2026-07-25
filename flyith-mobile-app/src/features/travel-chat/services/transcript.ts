import { MAX_HISTORY_TURNS } from "../constants";
import type { ChatMessage } from "../types";

export interface GeminiContent {
  role: "user" | "model";
  parts: { text: string }[];
}

const OUTCOME_LABEL: Record<"ok" | "empty" | "missing_info" | "failed", string> = {
  ok: "OK",
  empty: "NO RESULTS",
  missing_info: "MISSING INFO",
  failed: "FAILED",
};

function describeMessage(message: ChatMessage): string {
  const { turn } = message;
  if (message.role === "user") {
    switch (turn.kind) {
      case "text":
        return turn.text;
      case "chip_selection":
        return turn.label;
      case "card_selection":
        return turn.label
          ? `[User selected this ${turn.cardKind}: ${turn.label}]`
          : `[User selected a ${turn.cardKind} option]`;
      case "review_action":
        return turn.action === "start"
          ? "[User confirmed the plan]"
          : "[User went back to keep editing]";
      default:
        return "";
    }
  }

  switch (turn.kind) {
    case "text":
      return turn.text;
    case "question":
      return turn.text;
    case "suggestions":
      return `${turn.prompt ? `${turn.prompt} ` : ""}[Assistant showed option cards: ${turn.chips
        .map((c) => c.label)
        .join(", ")}]`;
    case "flight_options":
      return `[Assistant showed ${turn.options.length} flight option(s): ${turn.options
        .slice(0, 5)
        .map((o) => `${o.airline} ${o.departureAirport}→${o.arrivalAirport} $${o.priceUSD}`)
        .join("; ")}]`;
    case "hotel_options":
      return `[Assistant showed ${turn.options.length} hotel option(s): ${turn.options
        .slice(0, 5)
        .map((o) => `${o.name}${o.pricePerNightUSD != null ? ` $${o.pricePerNightUSD}/night` : ""}`)
        .join("; ")}]`;
    case "destination_inspiration":
      return `[Assistant showed ${turn.options.length} destination idea(s): ${turn.options.map((o) => o.name).join(", ")}]`;
    case "places":
      return `[Assistant showed ${turn.options.length} ${turn.category} place(s): ${turn.options
        .slice(0, 5)
        .map((o) => o.name)
        .join(", ")}]`;
    case "day_plan":
      return `[Assistant showed a day plan: ${turn.slots
        .map(
          (slot) =>
            `${slot.id}=${slot.options
              .slice(0, 3)
              .map((o) => o.name)
              .join("/")}`
        )
        .join("; ")}]`;
    case "date_options":
      return `[Assistant showed ${turn.options.length} priced date range(s) for ${turn.month}: ${turn.options
        .map((o) => `${o.startDate}→${o.endDate}${o.priceUSD ? ` $${o.priceUSD}` : ""}`)
        .join(", ")}]`;
    case "itinerary_review":
      return "[Assistant showed the trip review]";
    case "image":
      return `[Assistant generated an image: ${turn.prompt}]`;
    case "youtube_video":
      return `[Assistant showed a YouTube travel video: ${turn.title}${
        turn.channelName ? ` by ${turn.channelName}` : ""
      }${turn.placeNames?.length ? ` — places: ${turn.placeNames.slice(0, 8).join(", ")}` : ""}]`;
    case "system_notice":
      return turn.text;
    case "tool_outcome":
      return `[SEARCH ${turn.action} → ${OUTCOME_LABEL[turn.outcome]}: ${turn.detail}]`;
    case "context_note":
      return turn.text;
    default:
      return "";
  }
}

/** Serializes recent chat history into Gemini `contents` — always derived from `messages`, never dual-written. */
export function buildModelContents(messages: ChatMessage[]): GeminiContent[] {
  return messages
    .slice(-MAX_HISTORY_TURNS)
    .map((message) => {
      const text = describeMessage(message);
      if (!text) return null;
      return {
        role: message.role === "user" ? ("user" as const) : ("model" as const),
        parts: [{ text }],
      };
    })
    .filter((content): content is GeminiContent => content !== null);
}

/** Compact one-liner for feeding a live search outcome back into the current cycle's contents. */
export function describeToolOutcome(
  action: string,
  outcome: "ok" | "empty" | "missing_info" | "failed",
  detail: string,
  canSearchAgain: boolean
): string {
  const base = `[SEARCH ${action} → ${OUTCOME_LABEL[outcome]}: ${detail}]`;
  if (canSearchAgain) {
    return `${base}\nYou may try ONE adjusted search (different dates, nearby airport, broader query) OR send a "suggestions" turn with concrete option cards. Never restate the raw error.`;
  }
  return `${base}\nNo further searches are allowed this turn. Send a "suggestions" turn with 2-4 concrete option cards so they can choose what to try next.`;
}
