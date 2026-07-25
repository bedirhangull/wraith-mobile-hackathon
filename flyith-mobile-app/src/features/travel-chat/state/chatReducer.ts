import type {
  ActivityKind,
  AssistantTurn,
  ChatMessage,
  ChatStatus,
  TripBrief,
  UserTurn,
} from "../types";
import { generateId } from "../utils/ids";
import { initialTripBrief, mergeBriefPatch } from "./tripBrief";

export interface ChatState {
  messages: ChatMessage[];
  brief: TripBrief;
  status: ChatStatus;
  /** What the engine is doing right now, so the indicator can say more than "Thinking". */
  activity?: ActivityKind;
  /** Background SerpAPI work — does NOT lock the composer. */
  searchActivity?: ActivityKind;
  /** Locked from the user's first message — the whole conversation stays in it. */
  locale?: "tr" | "en";
  errorMessage?: string;
}

export type ChatAction =
  | { type: "USER_TURN_ADDED"; turn: UserTurn }
  | { type: "ASSISTANT_TURN_ADDED"; turn: AssistantTurn; id?: string }
  | { type: "BRIEF_PATCHED"; patch: Partial<TripBrief> }
  | { type: "STATUS_CHANGED"; status: ChatStatus; activity?: ActivityKind; errorMessage?: string }
  | { type: "SEARCH_ACTIVITY"; activity?: ActivityKind }
  | { type: "LOCALE_LOCKED"; locale: "tr" | "en" }
  | { type: "RESET"; onboarding?: TripBrief["onboarding"] };

export function createInitialChatState(onboarding?: TripBrief["onboarding"]): ChatState {
  return {
    messages: [],
    brief: initialTripBrief(onboarding),
    status: "idle",
  };
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "USER_TURN_ADDED":
      return {
        ...state,
        messages: [
          ...state.messages,
          { id: generateId(), role: "user", turn: action.turn, createdAt: Date.now() },
        ],
      };
    case "ASSISTANT_TURN_ADDED":
      return {
        ...state,
        messages: [
          ...state.messages,
          {
            id: action.id ?? generateId(),
            role: "assistant",
            turn: action.turn,
            createdAt: Date.now(),
          },
        ],
      };
    case "BRIEF_PATCHED":
      return { ...state, brief: mergeBriefPatch(state.brief, action.patch) };
    case "STATUS_CHANGED":
      return {
        ...state,
        status: action.status,
        activity: action.status === "idle" ? undefined : action.activity,
        errorMessage: action.errorMessage,
      };
    case "SEARCH_ACTIVITY":
      return { ...state, searchActivity: action.activity };
    case "LOCALE_LOCKED":
      return state.locale ? state : { ...state, locale: action.locale };
    case "RESET":
      return createInitialChatState(action.onboarding);
    default:
      return state;
  }
}
