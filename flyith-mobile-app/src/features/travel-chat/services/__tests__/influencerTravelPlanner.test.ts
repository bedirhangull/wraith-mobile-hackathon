import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { Influencer } from "../../../../data/influencers";
import { isReadyForReview } from "../../state/tripBrief";
import type { FlightOption, InfluencerSourceMeta, TripBrief } from "../../types";
import { activityPhrases } from "../../utils/activityLabels";
import { chipsForNextTopic, missingSourceEssentials } from "../../utils/nextTopicTurn";
import {
  briefPatchFromInfluencer,
  influencerPlanResetPatch,
  influencerSourceFromInfluencer,
  isReadyForInfluencerReview,
  INFLUENCER_SKIP_TOPIC_IDS,
} from "../influencerBrief";

/** Fixture only — avoid importing the real dataset (PNG requires break Node). */
const sampleInfluencer: Influencer = {
  id: "batuhan-furkan-5",
  name: "Batuhan Furkan",
  handle: "@batuhanfurkan.5",
  highlight: "Travel, lifestyle & vlogs",
  niche: "Travel & lifestyle creator",
  context: "Historic Delhi and local street-food route.",
  image: 1,
  origin: { city: "Istanbul", countryCode: "TR", flag: "🇹🇷" },
  destination: { city: "Delhi", countryCode: "IN", flag: "🇮🇳" },
  travelPlan: [
    {
      city: "Delhi",
      countryCode: "IN",
      flag: "🇮🇳",
      notes: "Historic Delhi and local street-food route.",
      places: ["India Gate", "Red Fort", "Humayun’s Tomb", "Chandni Chowk"],
    },
  ],
};

const sampleSource: InfluencerSourceMeta = {
  id: "batuhan-furkan-5",
  name: "Batuhan Furkan",
  handle: "@batuhanfurkan.5",
  niche: "Travel & lifestyle creator",
  highlight: "Travel, lifestyle & vlogs",
  context: "Historic Delhi and local street-food route.",
  originCity: "Istanbul",
  originCountryCode: "TR",
  originFlag: "🇹🇷",
  destinationCity: "Delhi",
  destinationCountryCode: "IN",
  destinationFlag: "🇮🇳",
  route: [
    {
      city: "Delhi",
      countryCode: "IN",
      flag: "🇮🇳",
      notes: "Historic Delhi and local street-food route.",
      places: ["India Gate", "Red Fort", "Humayun’s Tomb", "Chandni Chowk"],
    },
  ],
};

const sampleFlight: FlightOption = {
  id: "f1",
  airline: "IndiGo",
  departureAirport: "IST",
  arrivalAirport: "DEL",
  departureTime: "2026-08-01T08:00:00Z",
  arrivalTime: "2026-08-01T16:00:00Z",
  priceUSD: 340,
  durationMinutes: 420,
  stops: 0,
};

describe("influencerSourceFromInfluencer", () => {
  it("builds serializable source meta without the image asset", () => {
    const source = influencerSourceFromInfluencer(sampleInfluencer);
    assert.equal(source.id, "batuhan-furkan-5");
    assert.equal(source.name, "Batuhan Furkan");
    assert.equal(source.route[0]?.city, "Delhi");
    assert.ok(source.route[0]!.places.includes("India Gate"));
    assert.equal("image" in source, false);
  });
});

describe("Influencer brief helpers + readiness", () => {
  it("applies flight defaults and skips hotel/experience topics", () => {
    const patch = briefPatchFromInfluencer(sampleSource, undefined);
    assert.equal(patch.planningMode, "influencer");
    assert.equal(patch.destination, "Delhi");
    assert.equal(patch.travelClass, 1);
    assert.equal(patch.maxStops, 1);
    assert.ok(patch.skippedTopics?.includes("day_plan"));
    assert.ok(patch.skippedTopics?.includes("accommodation_type"));
    assert.ok(INFLUENCER_SKIP_TOPIC_IDS.includes("day_plan"));
    assert.equal(patch.chosenHotel, undefined);
    assert.equal(patch.chosenFlight, undefined);
    assert.equal(patch.onboarding?.favoriteInfluencerId, "batuhan-furkan-5");
    assert.ok((patch.shownAttractionNames?.length ?? 0) > 0);
  });

  it("resets city-bound plan fields when replacing with a new influencer", () => {
    const reset = influencerPlanResetPatch(undefined);
    assert.equal(reset.planningMode, "influencer");
    assert.equal(reset.destination, undefined);
    assert.equal(reset.chosenFlight, undefined);
    assert.equal(reset.influencerSource, undefined);
    assert.equal(reset.shownPlaceOptions, undefined);
  });

  it("requires flight + route places for influencer review readiness", () => {
    const incomplete: TripBrief = {
      status: "planning",
      planningMode: "influencer",
      destination: "Delhi",
      influencerSource: sampleSource,
    };
    assert.equal(isReadyForInfluencerReview(incomplete), false);
    assert.equal(isReadyForReview(incomplete), false);

    const ready: TripBrief = {
      ...incomplete,
      chosenFlight: sampleFlight,
    };
    assert.equal(isReadyForInfluencerReview(ready), true);
    assert.equal(isReadyForReview(ready), true);

    const normal: TripBrief = {
      status: "planning",
      destination: "Delhi",
      chosenFlight: sampleFlight,
    };
    assert.equal(isReadyForReview(normal), false);
  });
});

describe("Influencer chipsForNextTopic", () => {
  const influencerBase: TripBrief = {
    status: "planning",
    planningMode: "influencer",
    destination: "Delhi",
    influencerSource: sampleSource,
    travelClass: 1,
    maxStops: 1,
    carryOnBags: 1,
    children: 0,
    skippedTopics: [...INFLUENCER_SKIP_TOPIC_IDS],
    restaurantsShown: true,
    attractionsShown: true,
    dayPlanShown: true,
  };

  it("asks dates when start/end are missing", () => {
    const withOrigin: TripBrief = {
      ...influencerBase,
      originAirportCode: "IST",
    };
    assert.deepEqual(missingSourceEssentials(withOrigin), ["dates", "travelers"]);
    const next = chipsForNextTopic(withOrigin, "tr");
    assert.equal(next.topicId, "dates");
    assert.equal(
      next.chips.some((chip) => chip.id === "create-travel-plan"),
      false
    );
  });

  it("never emits create-travel-plan in influencer mode", () => {
    const ready: TripBrief = {
      ...influencerBase,
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

  it("offers influencer-route chip from onboarding on destination topic", () => {
    const brief: TripBrief = {
      status: "planning",
      onboarding: {
        favoriteInfluencer: "Batuhan Furkan",
        favoriteInfluencerId: "batuhan-furkan-5",
        favoriteDestination: "Delhi",
        influencerDestinations: ["Delhi"],
      },
    };
    const next = chipsForNextTopic(brief, "en");
    assert.equal(next.topicId, "destination");
    assert.ok(next.chips.some((chip) => chip.id === "influencer-route"));
  });
});

describe("influencer activity labels", () => {
  it("exposes creator-route loading phrases", () => {
    const tr = activityPhrases("influencer", "tr");
    const en = activityPhrases("influencer", "en");
    assert.ok(tr.some((phrase) => /Influencer|Rota|Mekan/i.test(phrase)));
    assert.ok(en.some((phrase) => /creator|route|places/i.test(phrase)));
  });
});
