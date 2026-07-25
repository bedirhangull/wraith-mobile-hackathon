export const GEMINI_TEXT_MODEL = "gemini-3.6-flash";
/** Used if the account can't serve the primary model (404 / unsupported). */
export const GEMINI_TEXT_MODEL_FALLBACK = "gemini-2.5-flash";
export const GEMINI_IMAGE_MODEL = "gemini-2.5-flash-image";

export const MAX_HISTORY_TURNS = 20;

/** Max SerpAPI search attempts per user message (one automatic adjusted retry). */
export const MAX_SEARCH_ATTEMPTS = 2;

export const SERPAPI_TIMEOUT_MS = 25_000;
/** Whole Gemini round-trip (headers + body). Keep tight so the chat never feels frozen. */
export const GEMINI_TIMEOUT_MS = 28_000;
/** Hard ceiling for one user turn — Gemini only (searches run in background). */
export const GEMINI_TURN_BUDGET_MS = 35_000;

/** How many candidate departure dates a "I'm flexible in <month>" search prices in parallel. */
export const MAX_FLEXIBLE_DATE_PROBES = 6;
export const DEFAULT_TRIP_LENGTH_DAYS = 5;
/** Never probe dates sooner than this — same-day fares are noise. */
export const MIN_BOOKING_LEAD_DAYS = 3;

export const REQUIRED_BRIEF_FIELDS = [
  "destination",
  "budgetTotalUSD",
  "startDate",
  "endDate",
  "accommodationType",
] as const;

export const IMAGE_STYLE_SUFFIX =
  ", 3D Pixar-style character illustration, Apple memoji aesthetic, glossy soft-rounded shapes, friendly expressive design, soft even studio lighting, isolated on a plain solid white background, no scenery, no drop shadow, no cast shadow";
