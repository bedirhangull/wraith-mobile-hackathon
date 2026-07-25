import { BottomSheet, Button, Card, Skeleton, Typography } from "heroui-native";
import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { type JSX, useEffect, useState } from "react";
import { ActivityIndicator, Image, Modal, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { getBookingOptions, searchFlights } from "../services/serpapi";
import { mapBookingOptions, mapFlights } from "../services/mappers";
import { flightParamsFromBrief } from "../services/searchParams";
import type { BookingOption, FlightOption, TripBrief } from "../types";

type Locale = "tr" | "en";

interface BookingOptionsSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  flight: FlightOption | null;
  brief: TripBrief;
  locale?: Locale;
}

function BookingOptionRow({
  option,
  locale,
  onOpen,
}: {
  option: BookingOption;
  locale: Locale;
  onOpen: (option: BookingOption) => void;
}): JSX.Element {
  const tr = locale === "tr";
  return (
    <Card variant="secondary">
      <Card.Header className="flex-row items-center justify-between">
        {option.airlineLogoUrl ? (
          <Image
            source={{ uri: option.airlineLogoUrl }}
            className="h-6 w-10"
            resizeMode="contain"
          />
        ) : (
          <View />
        )}
        {option.priceUSD ? (
          <Typography.Paragraph className="font-semibold text-accent">
            ${option.priceUSD}
          </Typography.Paragraph>
        ) : null}
      </Card.Header>
      <Card.Body>
        <Card.Title>{option.bookWith}</Card.Title>
        {option.optionTitle ? <Card.Description>{option.optionTitle}</Card.Description> : null}
        {option.extensions && option.extensions.length > 0 ? (
          <Card.Description>{option.extensions.join(" · ")}</Card.Description>
        ) : null}
      </Card.Body>
      {option.bookingUrl ? (
        <Card.Footer>
          <Button variant="secondary" onPress={() => onOpen(option)}>
            {tr ? "Rezervasyona devam et" : "Continue to booking"}
          </Button>
        </Card.Footer>
      ) : null}
    </Card>
  );
}

function BookingOptionsBody({
  flight,
  brief,
  locale,
}: {
  flight: FlightOption;
  brief: TripBrief;
  locale: Locale;
}): JSX.Element {
  const tr = locale === "tr";
  const [options, setOptions] = useState<BookingOption[] | null>(null);
  const [requestFailed, setRequestFailed] = useState(false);
  const [requestKey, setRequestKey] = useState(0);
  const [checkoutOption, setCheckoutOption] = useState<BookingOption | null>(null);

  const origin = brief.originAirportCode;
  const destination = brief.destinationAirportCode;
  const outboundDate = brief.startDate;
  const missingTripInfo = !origin || !destination || !outboundDate;

  useEffect(() => {
    if (missingTripInfo) return;
    let cancelled = false;

    async function loadBookingOptions(): Promise<BookingOption[]> {
      let bookingToken = flight.bookingToken;
      if (!bookingToken && flight.departureToken) {
        const returnLegResponse = await searchFlights(
          flightParamsFromBrief(
            {
              origin: origin!,
              destination: destination!,
              outboundDate: outboundDate!,
              returnDate: brief.endDate,
              departureToken: flight.departureToken,
            },
            brief
          )
        );
        bookingToken = mapFlights(returnLegResponse)[0]?.bookingToken;
      }
      if (!bookingToken) throw new Error("No booking token available for this flight");

      const response = await getBookingOptions({ bookingToken });
      return mapBookingOptions(response);
    }

    loadBookingOptions()
      .then((nextOptions) => {
        if (!cancelled) setOptions(nextOptions);
      })
      .catch((error) => {
        console.warn("[BookingOptionsSheet] Failed to load booking options:", error);
        if (!cancelled) setRequestFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [
    brief,
    destination,
    flight.bookingToken,
    flight.departureToken,
    missingTripInfo,
    origin,
    outboundDate,
    requestKey,
  ]);

  return (
    <>
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 24, paddingTop: 12, gap: 12 }}>
        {missingTripInfo || requestFailed ? (
          <View className="gap-3">
            <Typography.Paragraph className="text-muted">
              {tr
                ? "Rezervasyon seçenekleri şu an yüklenemedi."
                : "Couldn't load booking options right now."}
            </Typography.Paragraph>
            {!missingTripInfo ? (
              <Button
                variant="secondary"
                onPress={() => {
                  setOptions(null);
                  setRequestFailed(false);
                  setRequestKey((key) => key + 1);
                }}
              >
                {tr ? "Tekrar dene" : "Try again"}
              </Button>
            ) : null}
          </View>
        ) : options === null ? (
          <>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </>
        ) : options.length === 0 ? (
          <Typography.Paragraph className="text-muted">
            {tr ? "Rezervasyon seçeneği bulunamadı." : "No booking options found."}
          </Typography.Paragraph>
        ) : (
          options.map((option) => (
            <BookingOptionRow
              key={option.id}
              option={option}
              locale={locale}
              onOpen={setCheckoutOption}
            />
          ))
        )}
      </BottomSheetScrollView>

      <BookingCheckoutModal
        option={checkoutOption}
        locale={locale}
        onClose={() => setCheckoutOption(null)}
      />
    </>
  );
}

function BookingCheckoutModal({
  option,
  locale,
  onClose,
}: {
  option: BookingOption | null;
  locale: Locale;
  onClose: () => void;
}): JSX.Element {
  const tr = locale === "tr";
  const source =
    option?.bookingUrl && option.bookingPostData
      ? {
          uri: option.bookingUrl,
          method: "POST" as const,
          body: option.bookingPostData,
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
        }
      : option?.bookingUrl
        ? { uri: option.bookingUrl }
        : undefined;

  return (
    <Modal
      visible={option !== null}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-row items-center justify-between border-b border-divider px-4 py-3">
          <View className="min-w-0 flex-1">
            <Typography.Heading numberOfLines={1}>
              {tr ? "Rezervasyon" : "Booking"}
            </Typography.Heading>
            <Typography.Paragraph className="text-sm text-muted" numberOfLines={1}>
              {option?.bookWith}
            </Typography.Paragraph>
          </View>
          <Button size="sm" variant="tertiary" onPress={onClose}>
            {tr ? "Kapat" : "Close"}
          </Button>
        </View>
        {source ? (
          <WebView
            source={source}
            startInLoadingState
            renderLoading={() => (
              <View className="absolute inset-0 items-center justify-center bg-background">
                <ActivityIndicator />
              </View>
            )}
          />
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

export function BookingOptionsSheet({
  isOpen,
  onOpenChange,
  flight,
  brief,
  locale = "en",
}: BookingOptionsSheetProps): JSX.Element {
  const tr = locale === "tr";
  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["60%", "90%"]}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
        >
          <BottomSheet.Close />
          <BottomSheet.Title>
            {tr ? "Bu uçuş nasıl alınır" : "How to book this flight"}
          </BottomSheet.Title>
          {flight ? (
            <BottomSheet.Description>
              {flight.airline} · {flight.departureAirport} → {flight.arrivalAirport}
            </BottomSheet.Description>
          ) : null}

          {flight ? (
            <BookingOptionsBody key={flight.id} flight={flight} brief={brief} locale={locale} />
          ) : null}
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
