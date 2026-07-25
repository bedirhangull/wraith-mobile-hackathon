import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { ItineraryDay, PlaceOption } from "../../types";
import {
  activityStableId,
  buildGoogleMapsDirectionsUrl,
  buildSeedPlace,
  matchKnownPlace,
  normalizePlaceName,
} from "../placeResolution";
import { parseActivityDateTime, reminderFireAt, tripReminderKey } from "../tripReminderSchedule";

describe("normalizePlaceName / matchKnownPlace", () => {
  it("normalizes accents and punctuation", () => {
    assert.equal(normalizePlaceName("Café de l'Île!"), "cafe de l ile");
  });

  it("matches exact and fuzzy known places", () => {
    const known: PlaceOption[] = [
      {
        id: "1",
        name: "Louvre Museum",
        category: "attractions",
        latitude: 48.86,
        longitude: 2.33,
        phone: "+33 1",
      },
      {
        id: "2",
        name: "Café de Flore",
        category: "restaurants",
        latitude: 48.85,
        longitude: 2.33,
      },
    ];

    assert.equal(matchKnownPlace("Louvre Museum", known)?.id, "1");
    assert.equal(matchKnownPlace("louvre", known)?.id, "1");
    assert.equal(matchKnownPlace("Cafe de Flore", known)?.id, "2");
    assert.equal(matchKnownPlace("Unknown Spot", known), undefined);
  });
});

describe("buildGoogleMapsDirectionsUrl", () => {
  it("returns null with fewer than two points", () => {
    assert.equal(buildGoogleMapsDirectionsUrl([]), null);
    assert.equal(buildGoogleMapsDirectionsUrl([{ latitude: 1, longitude: 2 }]), null);
  });

  it("preserves origin, destination, and waypoint order", () => {
    const url = buildGoogleMapsDirectionsUrl([
      { latitude: 48.86, longitude: 2.33 },
      { latitude: 48.85, longitude: 2.34 },
      { latitude: 48.84, longitude: 2.35 },
      { latitude: 48.83, longitude: 2.36 },
    ]);
    assert.ok(url);
    const parsed = new URL(url!);
    assert.equal(parsed.searchParams.get("origin"), "48.86,2.33");
    assert.equal(parsed.searchParams.get("destination"), "48.83,2.36");
    assert.equal(parsed.searchParams.get("waypoints"), "48.85,2.34|48.84,2.35");
    assert.equal(parsed.searchParams.get("travelmode"), "walking");
  });
});

describe("buildSeedPlace matching", () => {
  it("enriches itinerary activities from known cards in plan order", () => {
    const day: ItineraryDay = {
      dayNumber: 1,
      date: "2026-08-01",
      title: "Day 1",
      activities: [
        { time: "10:00", title: "Museum", kind: "sight", placeName: "Louvre Museum" },
        { time: "13:00", title: "Lunch", kind: "food", placeName: "Hidden Bistro" },
      ],
    };
    const known: PlaceOption[] = [
      {
        id: "louvre",
        name: "Louvre Museum",
        category: "attractions",
        latitude: 48.8606,
        longitude: 2.3376,
        phone: "+331",
        address: "Rue de Rivoli",
      },
    ];

    const first = buildSeedPlace(day, day.activities[0]!, 0, known);
    const second = buildSeedPlace(day, day.activities[1]!, 1, known);

    assert.equal(first.source, "known");
    assert.equal(first.status, "resolved");
    assert.equal(first.latitude, 48.8606);
    assert.equal(second.source, "none");
    assert.equal(second.status, "unresolved");
    assert.equal(activityStableId(day, day.activities[0]!, 0).includes("Louvre"), true);
  });
});

describe("reminder date/key helpers", () => {
  it("parses local date+time and builds stable keys", () => {
    const at = parseActivityDateTime("2026-08-10", "09:30");
    assert.ok(at);
    assert.equal(at!.getFullYear(), 2026);
    assert.equal(at!.getMonth(), 7);
    assert.equal(at!.getDate(), 10);
    assert.equal(at!.getHours(), 9);
    assert.equal(at!.getMinutes(), 30);
    assert.equal(
      tripReminderKey("paris|a|b", "day-1:09:30:Louvre"),
      "paris|a|b::day-1:09:30:Louvre"
    );
  });

  it("disables past and incomplete reminders", () => {
    const now = new Date(2026, 7, 10, 12, 0, 0);
    assert.equal(reminderFireAt(undefined, "09:00", 30, now).reasonDisabled, "no_datetime");
    assert.equal(reminderFireAt("2026-08-10", undefined, 30, now).reasonDisabled, "no_datetime");
    assert.equal(reminderFireAt("2026-08-10", "12:10", 30, now).reasonDisabled, "past");

    const future = reminderFireAt("2026-08-10", "14:00", 30, now);
    assert.ok(future.fireAt);
    assert.equal(future.fireAt!.getHours(), 13);
    assert.equal(future.fireAt!.getMinutes(), 30);
  });
});
