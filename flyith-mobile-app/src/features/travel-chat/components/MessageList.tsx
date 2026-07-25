import type { OrbState } from "expo-thinking-orbs";
import { type JSX, useMemo, useRef } from "react";
import { FlatList, type ListRenderItemInfo, View } from "react-native";

import type {
  ChatMessage,
  DateOption,
  DayPlanSlot,
  DestinationOption,
  FlightOption,
  HotelOption,
  PlaceOption,
  UserTurn,
  ActivityKind,
} from "../types";
import { DayPlanTurn } from "./DayPlanTurn";
import { AssistantTextBubble, UserTextBubble } from "./TextBubble";
import { ImageTurn } from "./ImageTurn";
import {
  DateOptionsTurn,
  DestinationsTurn,
  FlightOptionsTurn,
  HotelOptionsTurn,
  PlacesTurn,
} from "./SortableTurns";
import { SuggestionCardList } from "./SuggestionCardList";
import { SuggestionChipRow } from "./SuggestionChipRow";
import { SystemNoticeTurn } from "./SystemNoticeTurn";
import { TypingIndicator } from "./TypingIndicator";
import { YouTubeVideoTurn } from "./YouTubeVideoTurn";

interface MessageListProps {
  messages: ChatMessage[];
  loadingPhrases: string[] | null;
  orbState?: OrbState;
  activity?: ActivityKind | null;
  locale: "tr" | "en";
  destination?: string;
  selectedFlightId?: string;
  selectedHotelId?: string;
  dayPlanSelections?: Partial<Record<DayPlanSlot["id"], PlaceOption>>;
  onSelectChip: (chipId: string, label: string) => void;
  onSelectFlight: (flight: FlightOption) => void;
  onViewBooking: (flight: FlightOption) => void;
  onSelectHotel: (hotel: HotelOption) => void;
  onViewHotelDetails: (hotel: HotelOption) => void;
  onSelectDestination: (destination: DestinationOption) => void;
  onOpenPlaceDetail: (place: PlaceOption) => void;
  onSelectPlace?: (place: PlaceOption) => void;
  onSelectDayPlanPlace?: (slotId: DayPlanSlot["id"], place: PlaceOption) => void;
  onSelectDateOption: (option: DateOption) => void;
  onOpenCalendar: () => void;
  onRefreshDayPlanSlot?: (slotId: DayPlanSlot["id"]) => void;
}

function userTurnLabel(turn: UserTurn): string | null {
  switch (turn.kind) {
    case "text":
      return turn.text;
    case "chip_selection":
      return turn.label;
    case "card_selection":
      return turn.label ?? null;
    default:
      return null;
  }
}

function isVisibleMessage(message: ChatMessage): boolean {
  if (message.role === "user") return userTurnLabel(message.turn) !== null;
  return message.turn.kind !== "tool_outcome" && message.turn.kind !== "context_note";
}

export function MessageList({
  messages,
  loadingPhrases,
  orbState = "working",
  activity,
  locale,
  destination,
  selectedFlightId,
  selectedHotelId,
  dayPlanSelections,
  onSelectChip,
  onSelectFlight,
  onViewBooking,
  onSelectHotel,
  onViewHotelDetails,
  onSelectDestination,
  onOpenPlaceDetail,
  onSelectPlace,
  onSelectDayPlanPlace,
  onSelectDateOption,
  onOpenCalendar,
  onRefreshDayPlanSlot,
}: MessageListProps): JSX.Element {
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const visibleMessages = useMemo(() => messages.filter(isVisibleMessage), [messages]);

  const renderItem = ({ item }: ListRenderItemInfo<ChatMessage>) => {
    if (item.role === "user") {
      const label = userTurnLabel(item.turn);
      return label ? <UserTextBubble text={label} locale={locale} /> : null;
    }

    const { turn } = item;
    switch (turn.kind) {
      case "text":
        return <AssistantTextBubble text={turn.text} locale={locale} />;
      case "question":
        return (
          <View className="gap-2">
            <AssistantTextBubble text={turn.text} locale={locale} />
            {turn.quickReplies && turn.quickReplies.length > 0 ? (
              <SuggestionChipRow
                chips={turn.quickReplies.map((reply) => ({ id: reply, label: reply }))}
                onSelect={(chip) => onSelectChip(chip.id, chip.label)}
              />
            ) : null}
          </View>
        );
      case "suggestions":
        return (
          <View className="gap-2">
            {turn.prompt ? <AssistantTextBubble text={turn.prompt} locale={locale} /> : null}
            <SuggestionCardList
              chips={turn.chips}
              onSelect={(chip) => onSelectChip(chip.id, chip.label)}
            />
          </View>
        );
      case "date_options":
        return (
          <DateOptionsTurn
            label={turn.label}
            options={turn.options}
            locale={locale}
            onSelect={onSelectDateOption}
            onOpenCalendar={onOpenCalendar}
          />
        );
      case "flight_options":
        return (
          <FlightOptionsTurn
            options={turn.options}
            locale={locale}
            selectedFlightId={selectedFlightId}
            onSelect={onSelectFlight}
            onViewBooking={onViewBooking}
          />
        );
      case "hotel_options":
        return (
          <HotelOptionsTurn
            options={turn.options}
            locale={locale}
            selectedHotelId={selectedHotelId}
            onSelect={onSelectHotel}
            onViewDetails={onViewHotelDetails}
          />
        );
      case "destination_inspiration":
        return (
          <DestinationsTurn options={turn.options} locale={locale} onSelect={onSelectDestination} />
        );
      case "places":
        return (
          <PlacesTurn
            label={turn.label}
            options={turn.options}
            locale={locale}
            onOpenDetail={onOpenPlaceDetail}
            onSelect={onSelectPlace}
          />
        );
      case "day_plan":
        return (
          <DayPlanTurn
            label={turn.label}
            slots={turn.slots}
            locale={locale}
            selectedBySlot={dayPlanSelections}
            onSelectSlotPlace={onSelectDayPlanPlace ?? ((_slot, place) => onOpenPlaceDetail(place))}
            onOpenPlace={onOpenPlaceDetail}
            onRefreshSlot={onRefreshDayPlanSlot}
          />
        );
      case "image":
        return <ImageTurn prompt={turn.prompt} caption={turn.caption} destination={destination} />;
      case "youtube_video":
        return (
          <YouTubeVideoTurn
            videoId={turn.videoId}
            url={turn.url}
            title={turn.title}
            thumbnailUrl={turn.thumbnailUrl}
            channelName={turn.channelName}
            placeNames={turn.placeNames}
            summary={turn.summary}
            locale={locale}
          />
        );
      case "system_notice":
        return <SystemNoticeTurn text={turn.text} />;
      default:
        return null;
    }
  };

  return (
    <FlatList
      ref={listRef}
      className="flex-1"
      data={visibleMessages}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      contentContainerClassName="gap-3 py-4"
      onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
      ListFooterComponent={
        loadingPhrases ? (
          <TypingIndicator phrases={loadingPhrases} orbState={orbState} activity={activity} />
        ) : null
      }
    />
  );
}
