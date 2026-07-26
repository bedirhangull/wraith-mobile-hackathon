import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useToast } from "heroui-native";

import { useUserProfile } from "@/features/onboarding/profile";
import { BookingOptionsSheet } from "./components/BookingOptionsSheet";
import { CalendarSheet } from "./components/CalendarSheet";
import { ChatHeader } from "./components/ChatHeader";
import { Composer } from "./components/Composer";
import { EmptyState } from "./components/EmptyState";
import { HotelDetailSheet } from "./components/HotelDetailSheet";
import { MessageList } from "./components/MessageList";
import { PlaceDetailSheet } from "./components/PlaceDetailSheet";
import { ReviewPlanSheet } from "./components/ReviewPlanSheet";
import { useTravelChatEngine } from "./hooks/useTravelChatEngine";
import type { DayPlanSlot, FlightOption, HotelOption, PlaceOption } from "./types";
import { activityPhrases, orbStateForActivity } from "./utils/activityLabels";
import { canOfferDateChips } from "./utils/normalizeTurn";
import {
  changeActionLabel,
  flightSelectedToast,
  hotelSelectedToast,
  placeSelectedToast,
  planPrepareFailedToast,
  slotToastLabel,
} from "./utils/selectionFeedback";

export function TravelChatScreen(): JSX.Element {
  const profile = useUserProfile();
  const engine = useTravelChatEngine(profile);
  const router = useRouter();
  const { toast } = useToast();
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [bookingFlight, setBookingFlight] = useState<FlightOption | null>(null);
  const [hotelDetail, setHotelDetail] = useState<HotelOption | null>(null);
  const [placeDetail, setPlaceDetail] = useState<PlaceOption | null>(null);
  const [isStickyViewEnabled, setIsStickyViewEnabled] = useState(false);
  const [isPreparingPlan, setIsPreparingPlan] = useState(false);
  const awaitingPlanAnnounceRef = useRef(false);
  const announcePlanReadyRef = useRef(engine.announcePlanReady);

  useEffect(() => {
    announcePlanReadyRef.current = engine.announcePlanReady;
  }, [engine.announcePlanReady]);

  useFocusEffect(
    useCallback(() => {
      if (!awaitingPlanAnnounceRef.current) return;
      awaitingPlanAnnounceRef.current = false;
      announcePlanReadyRef.current();
    }, [])
  );

  const handleSelectFlight = useCallback(
    (flight: FlightOption) => {
      engine.selectFlight(flight);
      void Haptics.selectionAsync();
      toast.show({
        variant: "success",
        label: flightSelectedToast(engine.locale).label,
        description: `${flight.airline} · $${flight.priceUSD}`,
      });
    },
    [engine, toast]
  );

  const handleSelectHotel = useCallback(
    (hotel: HotelOption) => {
      engine.selectHotel(hotel);
      void Haptics.selectionAsync();
      toast.show({
        variant: "success",
        label: hotelSelectedToast(engine.locale).label,
        description: hotel.name,
      });
    },
    [engine, toast]
  );

  const handleSelectPlace = useCallback(
    (place: PlaceOption) => {
      engine.selectPlace(place);
      void Haptics.selectionAsync();
      toast.show({
        variant: "success",
        label: placeSelectedToast(engine.locale).label,
        description: place.name,
      });
    },
    [engine, toast]
  );

  const handleSelectDayPlanPlace = useCallback(
    (slotId: DayPlanSlot["id"], place: PlaceOption) => {
      engine.selectDayPlanPlace(slotId, place);
      void Haptics.selectionAsync();
      toast.show({
        variant: "success",
        label: slotToastLabel(slotId, engine.locale),
        description: place.name,
        actionLabel: changeActionLabel(engine.locale),
        onActionPress: ({ hide }) => {
          hide();
          engine.refreshDayPlanSlot(slotId);
        },
      });
    },
    [engine, toast]
  );

  const handleSelectChip = useCallback(
    (chipId: string, label: string) => {
      if (isPreparingPlan) return;

      if (chipId === "create-travel-plan" || chipId === "review-plan") {
        // YouTube mode skips day-plan interrogation; readiness is flight + video places.
        if (engine.brief.planningMode !== "youtube" && !engine.isDayPlanSettled()) {
          engine.requestDayPlan();
          return;
        }
        if (engine.brief.planningMode === "youtube" && !engine.readyForReview) {
          return;
        }
      }

      if (chipId === "create-travel-plan") {
        engine.acknowledgeChip(chipId, label);
        awaitingPlanAnnounceRef.current = true;
        void engine.prepareItinerary();
        router.push({ pathname: "/generating-plan", params: { locale: engine.locale } });
        return;
      }
      if (chipId === "review-plan") {
        engine.acknowledgeChip(chipId, label);
        setIsPreparingPlan(true);
        void engine
          .prepareItinerary()
          .then((days) => {
            if (!days || days.length === 0) {
              const copy = planPrepareFailedToast(engine.locale);
              toast.show({ variant: "danger", label: copy.label, description: copy.description });
              return;
            }
            setIsReviewSheetOpen(true);
          })
          .catch(() => {
            const copy = planPrepareFailedToast(engine.locale);
            toast.show({ variant: "danger", label: copy.label, description: copy.description });
          })
          .finally(() => setIsPreparingPlan(false));
        return;
      }
      if (chipId === "pick-dates") {
        if (!canOfferDateChips(engine.brief)) {
          engine.selectChip(chipId, label);
          return;
        }
        setIsCalendarOpen(true);
        return;
      }
      engine.selectChip(chipId, label);
    },
    [engine, isPreparingPlan, router, toast]
  );

  const loadingActivity = (() => {
    if (isPreparingPlan) return "plan" as const;
    return (
      engine.searchActivity ?? (engine.status === "awaiting_model" ? engine.activity : undefined)
    );
  })();

  const loadingPhrases = loadingActivity ? activityPhrases(loadingActivity, engine.locale) : null;

  const orbState = orbStateForActivity(loadingActivity);

  return (
    // SafeAreaView (react-native-safe-area-context) isn't styled by Uniwind's className
    // interception (that only patches imports from the "react-native" package itself), so
    // layout-critical sizing must go through `style`, not `className`.
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View className="flex-1 bg-background">
        <ChatHeader locale={engine.locale} />
        {engine.messages.length === 0 ? (
          <EmptyState locale={engine.locale} />
        ) : (
          <MessageList
            messages={engine.messages}
            loadingPhrases={loadingPhrases}
            orbState={orbState}
            activity={loadingActivity}
            locale={engine.locale}
            destination={engine.brief.destination}
            selectedFlightId={engine.brief.chosenFlight?.id}
            selectedHotelId={engine.brief.chosenHotel?.id}
            dayPlanSelections={engine.brief.dayPlanSelections}
            onSelectChip={handleSelectChip}
            onSelectFlight={handleSelectFlight}
            onViewBooking={setBookingFlight}
            onSelectHotel={handleSelectHotel}
            onViewHotelDetails={setHotelDetail}
            onSelectDestination={engine.selectDestination}
            onOpenPlaceDetail={setPlaceDetail}
            onSelectPlace={handleSelectPlace}
            onSelectDayPlanPlace={handleSelectDayPlanPlace}
            onSelectDateOption={engine.selectDateOption}
            onOpenCalendar={() => setIsCalendarOpen(true)}
            onRefreshDayPlanSlot={engine.refreshDayPlanSlot}
          />
        )}
        <KeyboardStickyView
          enabled={isStickyViewEnabled}
          offset={{ closed: 0, opened: 0 }}
          onLayout={() => setTimeout(() => setIsStickyViewEnabled(true), 100)}
        >
          <Composer
            onSend={engine.sendText}
            isSending={loadingActivity !== undefined}
            locale={engine.locale}
          />
        </KeyboardStickyView>

        <ReviewPlanSheet
          isOpen={isReviewSheetOpen}
          onOpenChange={setIsReviewSheetOpen}
          brief={engine.brief}
          days={engine.brief.itineraryDays ?? []}
          locale={engine.locale}
          onReorderDays={engine.reorderItineraryDays}
          onStart={engine.confirmPlan}
        />

        <BookingOptionsSheet
          isOpen={bookingFlight !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setBookingFlight(null);
          }}
          flight={bookingFlight}
          brief={engine.brief}
          locale={engine.locale}
        />

        <HotelDetailSheet
          isOpen={hotelDetail !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setHotelDetail(null);
          }}
          hotel={hotelDetail}
          locale={engine.locale}
          onContextNote={engine.noteContext}
        />

        <CalendarSheet
          isOpen={isCalendarOpen}
          onOpenChange={setIsCalendarOpen}
          locale={engine.locale}
          initialStartDate={engine.brief.startDate}
          onConfirm={engine.selectDateRange}
        />

        <PlaceDetailSheet
          isOpen={placeDetail !== null}
          onOpenChange={(isOpen) => {
            if (!isOpen) setPlaceDetail(null);
          }}
          place={placeDetail}
          onConfirmSelection={handleSelectPlace}
          locale={engine.locale}
          onContextNote={engine.noteContext}
        />
      </View>
    </SafeAreaView>
  );
}
