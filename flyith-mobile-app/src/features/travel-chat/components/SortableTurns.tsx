import { type JSX, useMemo, useState } from "react";
import { View } from "react-native";

import type {
  DateOption,
  DestinationOption,
  FlightOption,
  HotelOption,
  PlaceOption,
} from "../types";
import {
  type DateSort,
  type DestinationSort,
  type FlightSort,
  type HotelSort,
  type Locale,
  type PlaceSort,
  dateSortChoices,
  destinationSortChoices,
  flightSortChoices,
  hotelSortChoices,
  placeSortChoices,
  sortDates,
  sortDestinations,
  sortFlights,
  sortHotels,
  sortPlaces,
} from "../utils/sorting";
import { DateOptionCard, PickExactDatesButton } from "./DateOptionCard";
import { DestinationCard } from "./DestinationCard";
import { FlightOptionCard } from "./FlightOptionCard";
import { HotelOptionCard } from "./HotelOptionCard";
import { OptionCardCarousel } from "./OptionCardCarousel";
import { PlaceCard } from "./PlaceCard";
import { SortBar } from "./SortBar";

const TITLES = {
  flights: { tr: "Uçuşlar", en: "Flights" },
  hotels: { tr: "Oteller", en: "Hotels" },
  destinations: { tr: "Rotalar", en: "Destinations" },
} as const;

export function FlightOptionsTurn({
  options,
  locale,
  onSelect,
  onViewBooking,
  selectedFlightId,
}: {
  options: FlightOption[];
  locale: Locale;
  onSelect: (option: FlightOption) => void;
  onViewBooking: (option: FlightOption) => void;
  selectedFlightId?: string;
}): JSX.Element {
  const [sort, setSort] = useState<FlightSort>("price");
  const sorted = useMemo(() => sortFlights(options, sort), [options, sort]);
  const hasSelection = Boolean(selectedFlightId);

  return (
    <View className="gap-2">
      <SortBar
        title={TITLES.flights[locale]}
        choices={flightSortChoices(locale)}
        value={sort}
        onChange={setSort}
      />
      <OptionCardCarousel>
        {sorted.map((option) => {
          const isSelected = option.id === selectedFlightId;
          return (
            <FlightOptionCard
              key={option.id}
              option={option}
              locale={locale}
              isSelected={isSelected}
              isDimmed={hasSelection && !isSelected}
              onPress={() => onSelect(option)}
              onViewBooking={onViewBooking}
            />
          );
        })}
      </OptionCardCarousel>
    </View>
  );
}

export function HotelOptionsTurn({
  options,
  locale,
  onSelect,
  onViewDetails,
  selectedHotelId,
}: {
  options: HotelOption[];
  locale: Locale;
  onSelect: (option: HotelOption) => void;
  onViewDetails: (option: HotelOption) => void;
  selectedHotelId?: string;
}): JSX.Element {
  const [sort, setSort] = useState<HotelSort>("price");
  const sorted = useMemo(() => sortHotels(options, sort), [options, sort]);
  const hasSelection = Boolean(selectedHotelId);

  return (
    <View className="gap-2">
      <SortBar
        title={TITLES.hotels[locale]}
        choices={hotelSortChoices(locale)}
        value={sort}
        onChange={setSort}
      />
      <OptionCardCarousel>
        {sorted.map((option) => {
          const isSelected = option.id === selectedHotelId;
          return (
            <HotelOptionCard
              key={option.id}
              option={option}
              locale={locale}
              isSelected={isSelected}
              isDimmed={hasSelection && !isSelected}
              onPress={() => onSelect(option)}
              onViewDetails={onViewDetails}
            />
          );
        })}
      </OptionCardCarousel>
    </View>
  );
}

export function PlacesTurn({
  label,
  options,
  locale,
  onOpenDetail,
  onSelect,
}: {
  label: string;
  options: PlaceOption[];
  locale: Locale;
  onOpenDetail: (option: PlaceOption) => void;
  onSelect?: (option: PlaceOption) => void;
}): JSX.Element {
  const [sort, setSort] = useState<PlaceSort>("rating");
  const sorted = useMemo(() => sortPlaces(options, sort), [options, sort]);

  return (
    <View className="gap-2">
      <SortBar title={label} choices={placeSortChoices(locale)} value={sort} onChange={setSort} />
      <OptionCardCarousel>
        {sorted.map((option) => (
          <PlaceCard
            key={option.id}
            option={option}
            locale={locale}
            onSelect={onSelect ?? onOpenDetail}
            onOpenDetail={onOpenDetail}
          />
        ))}
      </OptionCardCarousel>
    </View>
  );
}

export function DateOptionsTurn({
  label,
  options,
  locale,
  onSelect,
  onOpenCalendar,
}: {
  label: string;
  options: DateOption[];
  locale: Locale;
  onSelect: (option: DateOption) => void;
  onOpenCalendar: () => void;
}): JSX.Element {
  const [sort, setSort] = useState<DateSort>("price");
  const sorted = useMemo(() => sortDates(options, sort), [options, sort]);

  return (
    <View className="gap-2">
      <SortBar title={label} choices={dateSortChoices(locale)} value={sort} onChange={setSort} />
      <OptionCardCarousel>
        {sorted.map((option) => (
          <DateOptionCard key={option.id} option={option} locale={locale} onPress={onSelect} />
        ))}
      </OptionCardCarousel>
      <PickExactDatesButton locale={locale} onPress={onOpenCalendar} />
    </View>
  );
}

export function DestinationsTurn({
  options,
  locale,
  onSelect,
}: {
  options: DestinationOption[];
  locale: Locale;
  onSelect: (option: DestinationOption) => void;
}): JSX.Element {
  const [sort, setSort] = useState<DestinationSort>("price");
  const sorted = useMemo(() => sortDestinations(options, sort), [options, sort]);

  return (
    <View className="gap-2">
      <SortBar
        title={TITLES.destinations[locale]}
        choices={destinationSortChoices(locale)}
        value={sort}
        onChange={setSort}
      />
      <OptionCardCarousel>
        {sorted.map((option) => (
          <DestinationCard key={option.id} option={option} onPress={onSelect} />
        ))}
      </OptionCardCarousel>
    </View>
  );
}
