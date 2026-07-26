import { env } from "@/config/env";

import {
  GEMINI_IMAGE_MODEL,
  GEMINI_TEXT_MODEL,
  GEMINI_TEXT_MODEL_FALLBACK,
  GEMINI_TIMEOUT_MS,
  IMAGE_STYLE_SUFFIX,
} from "../constants";
import { GEMINI_ITINERARY_SCHEMA, parseItineraryDays } from "../prompts/itinerarySchema";
import { GEMINI_RESPONSE_SCHEMA, parseModelResponse } from "../prompts/responseSchema";
import {
  GEMINI_YOUTUBE_ANALYSIS_SCHEMA,
  parseYouTubeTravelAnalysis,
} from "../prompts/youtubeAnalysisSchema";
import { isTransientNetworkError, withTimeout } from "../utils/withTimeout";
import type { GeminiContent } from "./transcript";
import type { ItineraryDay, ModelTurnResponse, TripBrief, YouTubeTravelAnalysis } from "../types";

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function isRetryableGeminiFailure(error: unknown, status?: number): boolean {
  if (status !== undefined && status >= 500) return true;
  // Timeouts already waited GEMINI_TIMEOUT_MS — retrying doubles the freeze. Skip.
  if (error instanceof Error && error.message.toLowerCase().includes("timed out")) return false;
  return isTransientNetworkError(error);
}

async function callGeminiOnce(model: string, body: Record<string, unknown>): Promise<any> {
  // Timeout must wrap headers AND body — RN can resolve fetch() while
  // response.json() hangs forever, which left the chat stuck on "thinking".
  return withTimeout(
    (async () => {
      const response = await fetch(
        `${GEMINI_BASE_URL}/${model}:generateContent?key=${env.geminiApiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => "");
        const error = new Error(`Gemini request failed (${response.status}): ${errorText}`);
        (error as Error & { status?: number }).status = response.status;
        throw error;
      }
      return response.json();
    })(),
    GEMINI_TIMEOUT_MS,
    "Gemini"
  );
}

/** One automatic retry on network errors / 5xx / timeout. */
async function callGemini(model: string, body: Record<string, unknown>): Promise<any> {
  try {
    return await callGeminiOnce(model, body);
  } catch (error) {
    const status = (error as Error & { status?: number }).status;
    if (!isRetryableGeminiFailure(error, status)) throw error;
    return callGeminiOnce(model, body);
  }
}

// A key without access to the newest model would otherwise 404 every single turn.
let textModel = GEMINI_TEXT_MODEL;

function isModelUnavailable(error: unknown): boolean {
  const status = (error as Error & { status?: number })?.status;
  return status === 404 || status === 400;
}

async function callTextModel(body: Record<string, unknown>): Promise<any> {
  try {
    return await callGemini(textModel, body);
  } catch (error) {
    if (textModel === GEMINI_TEXT_MODEL_FALLBACK || !isModelUnavailable(error)) throw error;
    console.warn(
      `[gemini] ${textModel} unavailable, falling back to ${GEMINI_TEXT_MODEL_FALLBACK}`
    );
    textModel = GEMINI_TEXT_MODEL_FALLBACK;
    return callGemini(textModel, body);
  }
}

export async function generateStructuredTurn(
  systemPrompt: string,
  contents: GeminiContent[]
): Promise<ModelTurnResponse> {
  const json = await callTextModel({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_RESPONSE_SCHEMA,
    },
  });

  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini returned no content");
  }

  return parseModelResponse(JSON.parse(text));
}

export async function generateItinerary(brief: TripBrief): Promise<ItineraryDay[]> {
  if (brief.planningMode === "youtube" && brief.youtubeAnalysis) {
    return generateYouTubeItinerary(brief);
  }
  if (brief.planningMode === "influencer" && brief.influencerSource) {
    return generateInfluencerItinerary(brief);
  }

  const dayCount =
    brief.startDate && brief.endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(brief.endDate).getTime() - new Date(brief.startDate).getTime()) / 86_400_000
          ) + 1
        )
      : 3;

  const restaurants = brief.shownRestaurantNames?.slice(0, 8).join(", ") || "(none shown yet)";
  const attractions = brief.shownAttractionNames?.slice(0, 8).join(", ") || "(none shown yet)";
  const events = brief.shownEventNames?.slice(0, 6).join(", ") || "(none shown yet)";

  const prompt = `Create a ${dayCount}-day trip itinerary for ${brief.destination ?? "the destination"} \
(${brief.startDate ?? "TBD"} → ${brief.endDate ?? "TBD"}).

Travel style: ${brief.travelStyle ?? "mixed"}. Pace: ${brief.pace ?? "balanced"}. \
Accommodation: ${brief.accommodationType ?? "hotel"} (${brief.chosenHotel?.name ?? "TBD"}). \
Flight: ${brief.chosenFlight ? `${brief.chosenFlight.airline} $${brief.chosenFlight.priceUSD}` : "TBD"}. \
Food prefs: ${brief.foodPreferences?.join(", ") ?? brief.cuisineTypes?.join(", ") ?? "none"}. \
Dietary: ${brief.dietaryRestrictions?.join(", ") ?? "none"}. \
Famous vs hidden: ${brief.famousVsHiddenGems ?? "mix"}. Budget total: $${brief.budgetTotalUSD ?? "open"}.

REAL places already shown in chat — prefer these exact names over inventing new ones:
- Restaurants: ${restaurants}
- Attractions: ${attractions}
- Events: ${events}

TIME-OF-DAY STRUCTURE — every day should roughly follow:
- Morning (~09:00–12:00): cafe/brunch or a sight that opens early
- Afternoon (~12:30–17:30): main attraction + lunch
- Evening (~18:30–22:30): dinner and optionally nightlife
Respect realistic opening hours when you know them. Do not invent places that are closed at the assigned time.

Return a JSON array, one object per day, with:
- dayNumber, optional date (YYYY-MM-DD), title, optional summary, optional estimatedDayCostUSD
- activities: 3-5 objects each with optional time ("09:30"), title, kind \
(food|sight|experience|transit|rest|shopping|event), optional placeName (must be a real name from above when possible), \
optional note, optional estimatedCostUSD

Keep costs realistic and in USD. Spread food + sights across the days. Write titles/summaries in the same language the traveler has been using in chat (Turkish or English).`;

  const json = await callTextModel({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_ITINERARY_SCHEMA,
    },
  });

  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no itinerary");
  return parseItineraryDays(JSON.parse(text));
}

export async function analyzeYouTubeTravelSource(params: {
  analysisText: string;
  textSource: "transcript" | "description_chapters" | "metadata_only";
  locale?: "tr" | "en";
}): Promise<YouTubeTravelAnalysis> {
  const locale = params.locale ?? "en";
  const languageName = locale === "tr" ? "Turkish" : "English";
  const prompt = `You extract a travel plan from a YouTube travel video.
Primary source quality: ${params.textSource}.
Write summary/highlights/warnings/notes in ${languageName}.
Only include REAL place names mentioned or clearly implied by the video text.
Do NOT invent places that are not in the source.
Mark isTravelRelated=false when the video is not about traveling to a destination.
Prefer concrete city names for destination.

SOURCE:
${params.analysisText}`;

  const json = await callTextModel({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_YOUTUBE_ANALYSIS_SCHEMA,
    },
  });

  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no YouTube analysis");
  return parseYouTubeTravelAnalysis(JSON.parse(text));
}

async function generateYouTubeItinerary(brief: TripBrief): Promise<ItineraryDay[]> {
  const analysis = brief.youtubeAnalysis!;
  const dayCount =
    brief.startDate && brief.endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(brief.endDate).getTime() - new Date(brief.startDate).getTime()) / 86_400_000
          ) + 1
        )
      : Math.max(1, analysis.suggestedTripLengthDays ?? 3);

  const placeLines = analysis.places
    .map((place, index) => {
      const bits = [
        `${index + 1}. ${place.name}`,
        `category=${place.category}`,
        `sentiment=${place.sentiment}`,
        place.timeHint ? `timeHint=${place.timeHint}` : null,
        place.startMs != null ? `startMs=${place.startMs}` : null,
        place.note ? `note=${place.note}` : null,
      ].filter(Boolean);
      return bits.join(" | ");
    })
    .join("\n");

  const knownNames = [
    ...(brief.shownRestaurantNames ?? []),
    ...(brief.shownAttractionNames ?? []),
    ...(brief.shownEventNames ?? []),
    ...analysis.places.map((place) => place.name),
  ]
    .filter(Boolean)
    .slice(0, 30)
    .join(", ");

  const prompt = `Create a ${dayCount}-day itinerary for ${brief.destination ?? analysis.destination ?? "the destination"} \
(${brief.startDate ?? "TBD"} → ${brief.endDate ?? "TBD"}) based PRIMARILY on this YouTube travel video.

Video summary: ${analysis.summary}
Highlights: ${(analysis.highlights ?? []).join("; ") || "none"}
Warnings / negatives from the creator: ${(analysis.warnings ?? []).join("; ") || "none"}
Style: ${analysis.travelStyle ?? brief.travelStyle ?? "mixed"}; Pace: ${analysis.pace ?? brief.pace ?? "balanced"}
Stay hint from video: ${analysis.accommodationHint ?? brief.accommodationType ?? "hotel"}
Flight: ${brief.chosenFlight ? `${brief.chosenFlight.airline} $${brief.chosenFlight.priceUSD}` : "TBD"}.

VIDEO PLACES IN ORDER (primary source — prefer these exact names, keep creator order where possible):
${placeLines || "(no places extracted)"}

Resolved place names available in chat: ${knownNames || "(none)"}

Rules:
- Do NOT invent places that are not in the video place list above.
- You may only add minimal transit/rest/meal filler WITHOUT new placeName values when needed between stops.
- Reflect negative sentiments as cautious notes, not as "must visit".
- Spread stops across the days following the video order and any time hints.
- Write titles/summaries in the same language as the video summary.

Return a JSON array, one object per day, with:
- dayNumber, optional date (YYYY-MM-DD), title, optional summary, optional estimatedDayCostUSD
- activities: 3-5 objects each with optional time ("09:30"), title, kind \
(food|sight|experience|transit|rest|shopping|event), optional placeName, optional note, optional estimatedCostUSD`;

  const json = await callTextModel({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_ITINERARY_SCHEMA,
    },
  });

  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no YouTube itinerary");
  return parseItineraryDays(JSON.parse(text));
}

async function generateInfluencerItinerary(brief: TripBrief): Promise<ItineraryDay[]> {
  const source = brief.influencerSource!;
  const dayCount =
    brief.startDate && brief.endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(brief.endDate).getTime() - new Date(brief.startDate).getTime()) / 86_400_000
          ) + 1
        )
      : Math.max(1, source.route.length * 2);

  const placeLines = source.route
    .flatMap((stop, stopIndex) =>
      stop.places.map((place, placeIndex) => {
        const bits = [
          `${stopIndex + 1}.${placeIndex + 1}. ${place}`,
          `city=${stop.city}`,
          stop.notes ? `notes=${stop.notes}` : null,
        ].filter(Boolean);
        return bits.join(" | ");
      })
    )
    .join("\n");

  const knownNames = [
    ...(brief.shownAttractionNames ?? []),
    ...source.route.flatMap((stop) => stop.places),
  ]
    .filter(Boolean)
    .slice(0, 30)
    .join(", ");

  const prompt = `Create a ${dayCount}-day itinerary for ${brief.destination ?? source.destinationCity} \
(${brief.startDate ?? "TBD"} → ${brief.endDate ?? "TBD"}) based PRIMARILY on this travel influencer's route.

Creator: ${source.name} (${source.handle}) — ${source.niche}
Creator context: ${source.context}
Highlight: ${source.highlight}
Flight: ${brief.chosenFlight ? `${brief.chosenFlight.airline} $${brief.chosenFlight.priceUSD}` : "TBD"}.

CREATOR ROUTE STOPS IN ORDER (primary source — prefer these exact place names, keep creator order):
${placeLines || "(no places listed)"}

Resolved place names available in chat: ${knownNames || "(none)"}

Rules:
- Do NOT invent places that are not in the creator route list above.
- You may only add minimal transit/rest/meal filler WITHOUT new placeName values when needed between stops.
- Spread stops across the days following the route order and any stop notes.
- Write titles/summaries in the same language as the creator context (or the traveler's chat language).

Return a JSON array, one object per day, with:
- dayNumber, optional date (YYYY-MM-DD), title, optional summary, optional estimatedDayCostUSD
- activities: 3-5 objects each with optional time ("09:30"), title, kind \
(food|sight|experience|transit|rest|shopping|event), optional placeName, optional note, optional estimatedCostUSD`;

  const json = await callTextModel({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: GEMINI_ITINERARY_SCHEMA,
    },
  });

  const text: string | undefined = json?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini returned no influencer itinerary");
  return parseItineraryDays(JSON.parse(text));
}

/** Always appends the app's hard memoji/white-background/no-shadow style rule — never relies on the prompt alone. */
export async function generateStyledImage(subjectPrompt: string): Promise<string> {
  const json = await callGemini(GEMINI_IMAGE_MODEL, {
    contents: [{ parts: [{ text: `${subjectPrompt}${IMAGE_STYLE_SUFFIX}` }] }],
  });

  const parts = json?.candidates?.[0]?.content?.parts as
    { inlineData?: { data: string } }[] | undefined;
  const inlineData = parts?.find((part) => part.inlineData)?.inlineData;
  if (!inlineData?.data) {
    throw new Error("Gemini returned no image data");
  }
  return inlineData.data;
}
