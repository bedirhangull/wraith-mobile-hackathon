import type { FlightOption, HotelOption, TripBrief } from "../types";

/** Short "why this matches you" line for a flight, derived from collected preferences. */
export function flightMatchReason(flight: FlightOption, brief: TripBrief): string | undefined {
  const reasons: string[] = [];
  if (brief.maxStops === 0 && flight.stops === 0) reasons.push("nonstop as you wanted");
  if (brief.maxStops !== undefined && brief.maxStops > 0 && flight.stops <= brief.maxStops) {
    reasons.push(`≤${brief.maxStops} stop${brief.maxStops === 1 ? "" : "s"}`);
  }
  if (brief.maxFlightPriceUSD && flight.priceUSD <= brief.maxFlightPriceUSD) {
    reasons.push(`under your $${brief.maxFlightPriceUSD} cap`);
  }
  if (brief.maxDurationMinutes && flight.durationMinutes <= brief.maxDurationMinutes) {
    reasons.push("within your max duration");
  }
  if (brief.preferLowEmissions) reasons.push("lower-emissions friendly pick");
  if (brief.preferredAirlines?.length) {
    const hit = brief.preferredAirlines.find((code) =>
      flight.airline.toLowerCase().includes(code.toLowerCase())
    );
    if (hit) reasons.push(`matches ${hit}`);
  }
  return reasons.length > 0 ? reasons.slice(0, 2).join(" · ") : undefined;
}

export function hotelMatchReason(hotel: HotelOption, brief: TripBrief): string | undefined {
  const reasons: string[] = [];
  if (brief.hotelMinRating === 9 && (hotel.rating ?? 0) >= 4.5) reasons.push("4.5+ rating");
  else if (brief.hotelMinRating === 8 && (hotel.rating ?? 0) >= 4.0) reasons.push("4.0+ rating");
  else if (brief.hotelMinRating === 7 && (hotel.rating ?? 0) >= 3.5) reasons.push("3.5+ rating");

  if (
    brief.hotelClasses?.length &&
    hotel.hotelClass &&
    brief.hotelClasses.includes(hotel.hotelClass)
  ) {
    reasons.push(`${hotel.hotelClass}★ class`);
  }
  if (
    brief.maxPricePerNightUSD &&
    hotel.pricePerNightUSD &&
    hotel.pricePerNightUSD <= brief.maxPricePerNightUSD
  ) {
    reasons.push(`under $${brief.maxPricePerNightUSD}/night`);
  }
  if (brief.mustHaveAmenities?.length && hotel.amenities?.length) {
    const hits = brief.mustHaveAmenities.filter((want) =>
      hotel.amenities!.some((have) => have.toLowerCase().includes(want.toLowerCase()))
    );
    if (hits.length > 0) reasons.push(hits.slice(0, 2).join(" + "));
  }
  if (brief.freeCancellationRequired) reasons.push("free cancellation preferred");
  if (brief.ecoCertifiedPreferred) reasons.push("eco-friendly lean");
  return reasons.length > 0 ? reasons.slice(0, 2).join(" · ") : undefined;
}

export function annotateFlights(options: FlightOption[], brief: TripBrief): FlightOption[] {
  return options.map((option) => ({ ...option, matchReason: flightMatchReason(option, brief) }));
}

export function annotateHotels(options: HotelOption[], brief: TripBrief): HotelOption[] {
  return options.map((option) => ({ ...option, matchReason: hotelMatchReason(option, brief) }));
}
