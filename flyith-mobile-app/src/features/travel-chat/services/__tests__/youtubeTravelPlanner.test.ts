import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  briefPatchFromYouTubeAnalysis,
  isReadyForYouTubeReview,
  youtubePlanResetPatch,
  YOUTUBE_SKIP_TOPIC_IDS,
} from "../youtubeBrief";
import { buildAnalysisText, type YouTubeVideoSource } from "../youtubeIngest";
import { isReadyForReview } from "../../state/tripBrief";
import type {
  FlightOption,
  TripBrief,
  YouTubeSourceMeta,
  YouTubeTravelAnalysis,
} from "../../types";
import { activityPhrases } from "../../utils/activityLabels";
import { detectReplyLocale } from "../../utils/fallbackCopy";
import { chipsForNextTopic, missingYouTubeEssentials } from "../../utils/nextTopicTurn";
import { mapBookingOptions } from "../mappers";
import { extractYouTubeVideoId, isYouTubeUrl, youtubeWatchUrl } from "../../utils/youtubeUrl";
import { parseYouTubeTravelAnalysis } from "../../prompts/youtubeAnalysisSchema";

describe("extractYouTubeVideoId / isYouTubeUrl", () => {
  it("parses watch, youtu.be, shorts, live, and embed URLs", () => {
    assert.equal(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
      "dQw4w9WgXcQ"
    );
    assert.equal(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(
      extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
      "dQw4w9WgXcQ"
    );
    assert.equal(extractYouTubeVideoId("https://www.youtube.com/live/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(extractYouTubeVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
    assert.equal(
      extractYouTubeVideoId("https://m.youtube.com/watch?v=dQw4w9WgXcQ&t=30s"),
      "dQw4w9WgXcQ"
    );
  });

  it("rejects non-YouTube text and builds a canonical watch URL", () => {
    assert.equal(extractYouTubeVideoId("https://vimeo.com/123"), null);
    assert.equal(isYouTubeUrl("paris 5 days please"), false);
    assert.equal(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"), true);
    assert.equal(youtubeWatchUrl("dQw4w9WgXcQ"), "https://www.youtube.com/watch?v=dQw4w9WgXcQ");
  });
});

describe("parseYouTubeTravelAnalysis", () => {
  it("keeps real places and drops empty names", () => {
    const analysis = parseYouTubeTravelAnalysis({
      isTravelRelated: true,
      destination: " Lisbon ",
      summary: "A food weekend",
      places: [
        { name: "Time Out Market", category: "food", sentiment: "positive", note: "great" },
        { name: "  ", category: "sight", sentiment: "neutral" },
        { name: "Belém Tower", category: "sight", sentiment: "positive", startMs: 120000 },
      ],
    });

    assert.equal(analysis.destination, "Lisbon");
    assert.equal(analysis.places.length, 2);
    assert.equal(analysis.places[1]?.startMs, 120000);
  });

  it("marks non-travel videos safely", () => {
    const analysis = parseYouTubeTravelAnalysis({
      isTravelRelated: false,
      summary: "Gaming stream",
      places: [],
    });
    assert.equal(analysis.isTravelRelated, false);
    assert.equal(analysis.places.length, 0);
  });
});

const sampleFlight: FlightOption = {
  id: "f1",
  airline: "TAP",
  departureAirport: "IST",
  arrivalAirport: "LIS",
  departureTime: "2026-08-01T08:00:00Z",
  arrivalTime: "2026-08-01T11:00:00Z",
  priceUSD: 220,
  durationMinutes: 300,
  stops: 0,
};

const sampleSource: YouTubeSourceMeta = {
  videoId: "dQw4w9WgXcQ",
  url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  title: "Lisbon food tour",
  textSource: "transcript",
};

const sampleAnalysis: YouTubeTravelAnalysis = {
  isTravelRelated: true,
  destination: "Lisbon",
  summary: "Food and sights",
  suggestedTripLengthDays: 3,
  places: [
    { name: "Time Out Market", category: "food", sentiment: "positive" },
    { name: "Belém Tower", category: "sight", sentiment: "positive" },
  ],
};

describe("YouTube brief helpers + readiness", () => {
  it("applies flight defaults and skips hotel/experience topics", () => {
    const patch = briefPatchFromYouTubeAnalysis(sampleAnalysis, sampleSource, undefined);
    assert.equal(patch.planningMode, "youtube");
    assert.equal(patch.destination, "Lisbon");
    assert.equal(patch.travelClass, 1);
    assert.equal(patch.maxStops, 1);
    assert.ok(patch.skippedTopics?.includes("day_plan"));
    assert.ok(patch.skippedTopics?.includes("accommodation_type"));
    assert.ok(YOUTUBE_SKIP_TOPIC_IDS.includes("day_plan"));
    assert.equal(patch.chosenHotel, undefined);
    assert.equal(patch.chosenFlight, undefined);
  });

  it("resets city-bound plan fields when replacing with a new video", () => {
    const reset = youtubePlanResetPatch(undefined);
    assert.equal(reset.planningMode, "youtube");
    assert.equal(reset.destination, undefined);
    assert.equal(reset.chosenFlight, undefined);
    assert.equal(reset.youtubeAnalysis, undefined);
    assert.equal(reset.shownPlaceOptions, undefined);
  });

  it("requires flight + travel places for YouTube review readiness", () => {
    const incomplete: TripBrief = {
      status: "planning",
      planningMode: "youtube",
      destination: "Lisbon",
      youtubeAnalysis: sampleAnalysis,
      youtubeSource: sampleSource,
    };
    assert.equal(isReadyForYouTubeReview(incomplete), false);
    assert.equal(isReadyForReview(incomplete), false);

    const ready: TripBrief = {
      ...incomplete,
      chosenFlight: sampleFlight,
    };
    assert.equal(isReadyForYouTubeReview(ready), true);
    assert.equal(isReadyForReview(ready), true);

    // Normal chat still needs hotel + coverage — YouTube path must not falsely unlock it.
    const normal: TripBrief = {
      status: "planning",
      destination: "Lisbon",
      chosenFlight: sampleFlight,
    };
    assert.equal(isReadyForReview(normal), false);
  });
});

describe("YouTube chipsForNextTopic", () => {
  const youtubeBase: TripBrief = {
    status: "planning",
    planningMode: "youtube",
    destination: "Lisbon",
    youtubeAnalysis: sampleAnalysis,
    youtubeSource: sampleSource,
    travelClass: 1,
    maxStops: 1,
    carryOnBags: 1,
    children: 0,
    tripLengthDays: 3,
    skippedTopics: [...YOUTUBE_SKIP_TOPIC_IDS],
    restaurantsShown: true,
    attractionsShown: true,
    dayPlanShown: true,
  };

  it("asks dates when only tripLengthDays is set (no start/end)", () => {
    const withOrigin: TripBrief = {
      ...youtubeBase,
      originAirportCode: "IST",
    };
    assert.deepEqual(missingYouTubeEssentials(withOrigin), ["dates", "travelers"]);
    const next = chipsForNextTopic(withOrigin, "tr");
    assert.equal(next.topicId, "dates");
    assert.ok(next.chips.some((chip) => chip.id.startsWith("days-")));
    assert.equal(
      next.chips.some((chip) => chip.id === "create-travel-plan"),
      false
    );
  });

  it("never emits create-travel-plan in YouTube mode", () => {
    const ready: TripBrief = {
      ...youtubeBase,
      originAirportCode: "IST",
      startDate: "2026-08-01",
      endDate: "2026-08-04",
      adults: 1,
      travelers: 1,
      companionType: "solo",
      chosenFlight: sampleFlight,
    };
    const next = chipsForNextTopic(ready, "tr");
    assert.equal(
      next.chips.some((chip) => chip.id === "create-travel-plan"),
      false
    );
    assert.equal(next.chips.length, 1);
    assert.equal(next.chips[0]?.id, "review-plan");
  });

  it("returns empty chips while waiting on flight (no dead review button)", () => {
    const awaitingFlight: TripBrief = {
      ...youtubeBase,
      originAirportCode: "IST",
      startDate: "2026-08-01",
      endDate: "2026-08-04",
      adults: 1,
      travelers: 1,
      companionType: "solo",
    };
    assert.deepEqual(missingYouTubeEssentials(awaitingFlight), []);
    const next = chipsForNextTopic(awaitingFlight, "en");
    assert.equal(next.chips.length, 0);
    assert.equal(
      next.chips.some((chip) => chip.id === "create-travel-plan"),
      false
    );
  });
});

describe("youtube activity labels", () => {
  it("exposes video loading phrases", () => {
    const tr = activityPhrases("youtube", "tr");
    const en = activityPhrases("youtube", "en");
    assert.ok(tr.some((phrase) => /Video|Transcript|Rota/i.test(phrase)));
    assert.ok(en.some((phrase) => /video|transcript|route/i.test(phrase)));
  });
});

describe("buildAnalysisText fallback", () => {
  const baseVideo: YouTubeVideoSource = {
    videoId: "dQw4w9WgXcQ",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    title: "Lisbon in 48 hours",
    description: "We eat at Time Out Market and visit Belém Tower.",
    chapters: [
      { title: "Food crawl", startMs: 0 },
      { title: "Belém", startMs: 600_000 },
    ],
    hasTranscriptLink: false,
  };

  it("prefers transcript when present", () => {
    const result = buildAnalysisText(baseVideo, {
      languageCode: "en",
      chapters: [],
      segments: [{ startMs: 0, text: "Welcome to Lisbon", startTimeText: "0:00" }],
    });
    assert.equal(result.textSource, "transcript");
    assert.match(result.text, /Welcome to Lisbon/);
  });

  it("falls back to description + chapters", () => {
    const result = buildAnalysisText(baseVideo, null);
    assert.equal(result.textSource, "description_chapters");
    assert.match(result.text, /Time Out Market/);
    assert.match(result.text, /Belém/);
  });

  it("uses metadata_only when nothing else exists", () => {
    const result = buildAnalysisText({ ...baseVideo, description: undefined, chapters: [] }, null);
    assert.equal(result.textSource, "metadata_only");
    assert.match(result.text, /Lisbon in 48 hours/);
  });
});

describe("YouTube language and booking handoff", () => {
  it("detects Turkish transcript copy without relying only on special characters", () => {
    assert.equal(
      detectReplyLocale("Bugun burada bir gezi yapacagiz ve sonra yemek yiyecegiz"),
      "tr"
    );
    assert.equal(detectReplyLocale("Today we are visiting Amsterdam"), "en");
  });

  it("preserves the signed POST payload required by booking providers", () => {
    const [option] = mapBookingOptions({
      booking_options: [
        {
          together: {
            book_with: "Turkish Airlines",
            booking_request: {
              url: "https://www.google.com/travel/clk/f",
              post_data: "u=signed-payload",
            },
          },
        },
      ],
    });

    assert.equal(option?.bookingUrl, "https://www.google.com/travel/clk/f");
    assert.equal(option?.bookingPostData, "u=signed-payload");
  });
});
