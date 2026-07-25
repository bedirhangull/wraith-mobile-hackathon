import type {
  DateOption,
  DestinationOption,
  FlightOption,
  HotelOption,
  PlaceOption,
} from "../types";

export type Locale = "tr" | "en";

export type FlightSort = "price" | "duration" | "stops";
export type HotelSort = "price" | "rating";
export type PlaceSort = "rating" | "reviews";
export type DateSort = "price" | "date";
export type DestinationSort = "price" | "name";

export interface SortChoice<T extends string> {
  id: T;
  label: string;
}

const LABELS = {
  price: { tr: "Fiyat", en: "Price" },
  duration: { tr: "Süre", en: "Duration" },
  stops: { tr: "Aktarma", en: "Stops" },
  rating: { tr: "Puan", en: "Rating" },
  reviews: { tr: "Yorum", en: "Reviews" },
  date: { tr: "Tarih", en: "Date" },
  name: { tr: "İsim", en: "Name" },
} as const;

function choice<T extends keyof typeof LABELS>(id: T, locale: Locale): SortChoice<T> {
  return { id, label: LABELS[id][locale] };
}

export function flightSortChoices(locale: Locale): SortChoice<FlightSort>[] {
  return [choice("price", locale), choice("duration", locale), choice("stops", locale)];
}

export function hotelSortChoices(locale: Locale): SortChoice<HotelSort>[] {
  return [choice("price", locale), choice("rating", locale)];
}

export function placeSortChoices(locale: Locale): SortChoice<PlaceSort>[] {
  return [choice("rating", locale), choice("reviews", locale)];
}

export function dateSortChoices(locale: Locale): SortChoice<DateSort>[] {
  return [choice("price", locale), choice("date", locale)];
}

export function destinationSortChoices(locale: Locale): SortChoice<DestinationSort>[] {
  return [choice("price", locale), choice("name", locale)];
}

/** Missing values always sink to the bottom rather than sorting as 0. */
const LAST = Number.POSITIVE_INFINITY;

export function sortFlights(options: FlightOption[], sort: FlightSort): FlightOption[] {
  return [...options].sort((a, b) => {
    if (sort === "duration") return (a.durationMinutes ?? LAST) - (b.durationMinutes ?? LAST);
    if (sort === "stops") return (a.stops ?? LAST) - (b.stops ?? LAST) || a.priceUSD - b.priceUSD;
    return a.priceUSD - b.priceUSD;
  });
}

export function sortHotels(options: HotelOption[], sort: HotelSort): HotelOption[] {
  return [...options].sort((a, b) => {
    if (sort === "rating") return (b.rating ?? -1) - (a.rating ?? -1);
    const priceA = a.pricePerNightUSD ?? a.totalPriceUSD ?? LAST;
    const priceB = b.pricePerNightUSD ?? b.totalPriceUSD ?? LAST;
    return priceA - priceB;
  });
}

export function sortPlaces(options: PlaceOption[], sort: PlaceSort): PlaceOption[] {
  return [...options].sort((a, b) => {
    if (sort === "reviews") return (b.reviewCount ?? -1) - (a.reviewCount ?? -1);
    return (b.rating ?? -1) - (a.rating ?? -1);
  });
}

export function sortDestinations(
  options: DestinationOption[],
  sort: DestinationSort
): DestinationOption[] {
  return [...options].sort((a, b) => {
    if (sort === "name") return a.name.localeCompare(b.name);
    return (a.estimatedPriceUSD ?? LAST) - (b.estimatedPriceUSD ?? LAST);
  });
}

export function sortDates(options: DateOption[], sort: DateSort): DateOption[] {
  return [...options].sort((a, b) => {
    if (sort === "date") return a.startDate.localeCompare(b.startDate);
    return (a.priceUSD ?? LAST) - (b.priceUSD ?? LAST);
  });
}
