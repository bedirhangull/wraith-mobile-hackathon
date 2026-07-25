import { autocompleteFlights } from "./serpapi";

const IATA_CODE_PATTERN = /^[A-Z]{3}$/;
const KGMID_PATTERN = /^\/[mg]\//;

/**
 * Gemini sometimes puts a free-text city name (e.g. "İzmir") in a flight-search
 * action instead of an IATA code, which google_flights rejects outright. Resolve
 * through SerpAPI's autocomplete endpoint rather than trusting the model's text.
 *
 * google_flights/google_travel_explore's departure_id/arrival_id accept either a
 * 3-letter IATA code OR a location kgmid (Freebase id starting with "/m/" or
 * "/g/") directly — so a city suggestion is usable even without a nested airport.
 */
export async function resolveAirportCode(query: string): Promise<string | null> {
  const trimmed = query.trim().toUpperCase();
  if (IATA_CODE_PATTERN.test(trimmed)) return trimmed;

  try {
    const response = await autocompleteFlights(query);
    const suggestion = response.suggestions?.[0];
    if (!suggestion) return null;

    const airportId = suggestion.airports?.[0]?.id;
    if (airportId && IATA_CODE_PATTERN.test(airportId)) return airportId;

    if (suggestion.id && IATA_CODE_PATTERN.test(suggestion.id)) return suggestion.id;

    if (suggestion.id && KGMID_PATTERN.test(suggestion.id)) return suggestion.id;

    return null;
  } catch {
    return null;
  }
}
