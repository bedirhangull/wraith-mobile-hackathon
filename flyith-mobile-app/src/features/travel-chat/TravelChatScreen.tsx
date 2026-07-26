import type { JSX } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KeyboardStickyView } from "react-native-keyboard-controller";
import { useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { useToast } from "heroui-native";

import { influencerById, type Influencer } from "@/data/influencers";
import { useUserProfile } from "@/features/onboarding/profile";
import {
  consumePendingPremiumAction,
  paywallPathForAction,
  setPendingPremiumAction,
} from "@/features/subscription/premiumChatGate";
import { usePremium } from "@/features/subscription/usePremium";
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
import { claimNormalChatUsage } from "./services/persistence";
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
import { isYouTubeUrl } from "./utils/youtubeUrl";

export function TravelChatScreen({ conversationId }: { conversationId: string }): JSX.Element {
  const profile = useUserProfile();
  const engine = useTravelChatEngine(profile, conversationId);
  const router = useRouter();
  const { toast } = useToast();
  const { isPremium, isLoading: isPremiumLoading } = usePremium();
  const [isReviewSheetOpen, setIsReviewSheetOpen] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [bookingFlight, setBookingFlight] = useState<FlightOption | null>(null);
  const [hotelDetail, setHotelDetail] = useState<HotelOption | null>(null);
  const [placeDetail, setPlaceDetail] = useState<PlaceOption | null>(null);
  const [isStickyViewEnabled, setIsStickyViewEnabled] = useState(false);
  const [isPreparingPlan, setIsPreparingPlan] = useState(false);
  const [isClaimingUsage, setIsClaimingUsage] = useState(false);
  const awaitingPlanAnnounceRef = useRef(false);
  const announcePlanReadyRef = useRef(engine.announcePlanReady);
  const pendingConsumedRef = useRef(false);

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

  const openPaywall = useCallback(
    (kind: "normal_text" | "youtube" | "influencer") => {
      router.push({
        pathname: paywallPathForAction(kind),
        params: { returnConversationId: conversationId },
      });
    },
    [conversationId, router]
  );

  // After purchase/restore, apply the one-shot action that was blocked.
  useFocusEffect(
    useCallback(() => {
      if (isPremiumLoading || !isPremium || pendingConsumedRef.current) return;

      const action = consumePendingPremiumAction(conversationId);
      if (!action) return;
      pendingConsumedRef.current = true;

      if (action.kind === "youtube") {
        engine.sendText(action.url);
        return;
      }
      if (action.kind === "normal_text") {
        engine.sendText(action.text);
        return;
      }
      if (action.kind === "influencer") {
        const influencer = influencerById(action.influencerId);
        if (influencer) void engine.startInfluencerPlan(influencer);
      }
    }, [conversationId, engine, isPremium, isPremiumLoading])
  );

  useEffect(() => {
    // Allow consuming again if the user leaves and comes back with a new pending action.
    pendingConsumedRef.current = false;
  }, [conversationId]);

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

  const handleSelectInfluencer = useCallback(
    (influencer: Influencer): boolean => {
      if (isPremiumLoading) return false;
      if (!isPremium) {
        setPendingPremiumAction({
          kind: "influencer",
          conversationId,
          influencerId: influencer.id,
        });
        openPaywall("influencer");
        return false;
      }
      void engine.startInfluencerPlan(influencer);
      return true;
    },
    [conversationId, engine, isPremium, isPremiumLoading, openPaywall]
  );

  const handleSend = useCallback(
    async (text: string) => {
      if (isPremiumLoading || isClaimingUsage) return;
      const trimmed = text.trim();
      if (!trimmed) return;

      if (isYouTubeUrl(trimmed)) {
        if (!isPremium) {
          setPendingPremiumAction({
            kind: "youtube",
            conversationId,
            url: trimmed,
          });
          openPaywall("youtube");
          return;
        }
        engine.sendText(trimmed);
        return;
      }

      const mode = engine.brief.planningMode ?? "chat";
      if (!isPremium && mode === "chat") {
        setIsClaimingUsage(true);
        try {
          const claimed = await claimNormalChatUsage(conversationId);
          if (!claimed) {
            setPendingPremiumAction({
              kind: "normal_text",
              conversationId,
              text: trimmed,
            });
            openPaywall("normal_text");
            return;
          }
        } finally {
          setIsClaimingUsage(false);
        }
      }

      engine.sendText(trimmed);
    },
    [
      conversationId,
      engine,
      isClaimingUsage,
      isPremium,
      isPremiumLoading,
      openPaywall,
    ]
  );

  const handleSelectChip = useCallback(
    (chipId: string, label: string) => {
      if (isPreparingPlan || isPremiumLoading) return;

      if (chipId === "influencer-route") {
        if (!isPremium) {
          const influencerId = engine.brief.onboarding?.favoriteInfluencerId;
          if (influencerId) {
            setPendingPremiumAction({
              kind: "influencer",
              conversationId,
              influencerId,
            });
          }
          openPaywall("influencer");
          return;
        }
      }

      if (chipId === "create-travel-plan" || chipId === "review-plan") {
        // Source-driven modes skip day-plan interrogation; readiness is flight + places.
        if (
          engine.brief.planningMode !== "youtube" &&
          engine.brief.planningMode !== "influencer" &&
          !engine.isDayPlanSettled()
        ) {
          engine.requestDayPlan();
          return;
        }
        if (
          (engine.brief.planningMode === "youtube" ||
            engine.brief.planningMode === "influencer") &&
          !engine.readyForReview
        ) {
          engine.requestMissingForReview(chipId, label);
          return;
        }
      }

      // "Gerek yok / Skip for now" on day plan → settle day_plan and build the itinerary.
      if (chipId === "skip-day-plan") {
        engine.selectChip(chipId, label);
        awaitingPlanAnnounceRef.current = true;
        void engine.prepareItinerary();
        router.push({ pathname: "/generating-plan", params: { locale: engine.locale } });
        return;
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
    [
      conversationId,
      engine,
      isPreparingPlan,
      isPremium,
      isPremiumLoading,
      openPaywall,
      router,
      toast,
    ]
  );

  const loadingActivity = (() => {
    if (isPreparingPlan) return "plan" as const;
    return (
      engine.searchActivity ?? (engine.status === "awaiting_model" ? engine.activity : undefined)
    );
  })();

  const loadingPhrases = loadingActivity ? activityPhrases(loadingActivity, engine.locale) : null;

  const orbState = orbStateForActivity(loadingActivity);
  const composerBusy =
    loadingActivity !== undefined || isPremiumLoading || isClaimingUsage;

  return (
    // SafeAreaView (react-native-safe-area-context) isn't styled by Uniwind's className
    // interception (that only patches imports from the "react-native" package itself), so
    // layout-critical sizing must go through `style`, not `className`.
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <View className="flex-1 bg-background">
        <ChatHeader locale={engine.locale} onSelectInfluencer={handleSelectInfluencer} />
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
            onSend={(text) => {
              void handleSend(text);
            }}
            isSending={composerBusy}
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
