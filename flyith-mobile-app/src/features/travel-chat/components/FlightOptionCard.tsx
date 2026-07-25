import { Card, Chip, Typography } from "heroui-native";
import type { JSX } from "react";
import { Image, Pressable, View } from "react-native";

import type { FlightOption } from "../types";
import { formatDurationMinutes, formatTime } from "../utils/dates";
import { OPTION_CARD_WIDTH } from "./optionCardWidth";

export function FlightOptionCard({
  option,
  onPress,
  onViewBooking,
  isSelected = false,
  isDimmed = false,
  locale = "en",
}: {
  option: FlightOption;
  onPress: (option: FlightOption) => void;
  onViewBooking?: (option: FlightOption) => void;
  isSelected?: boolean;
  isDimmed?: boolean;
  locale?: "tr" | "en";
}): JSX.Element {
  const selectedLabel = locale === "tr" ? "Seçildi" : "Selected";
  const stopsLabel =
    option.stops === 0
      ? locale === "tr"
        ? "Aktarmasız"
        : "Nonstop"
      : locale === "tr"
        ? `${option.stops} aktarma`
        : `${option.stops} stop(s)`;

  return (
    <Pressable
      style={{ width: OPTION_CARD_WIDTH, opacity: isDimmed ? 0.45 : 1 }}
      disabled={isDimmed}
      onPress={() => onPress(option)}
    >
      <Card className={isSelected ? "border-accent" : undefined}>
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
          {isSelected ? (
            <Chip size="sm" variant="soft" color="success">
              <Chip.Label>{selectedLabel}</Chip.Label>
            </Chip>
          ) : (
            <Typography.Paragraph className="font-semibold text-accent">
              ${option.priceUSD}
            </Typography.Paragraph>
          )}
        </Card.Header>
        <Card.Body>
          <Card.Title>{option.airline}</Card.Title>
          <View className="mt-1 flex-row items-center gap-2">
            <Typography.Paragraph className="text-foreground">
              {formatTime(option.departureTime)} {option.departureAirport}
            </Typography.Paragraph>
            <Typography.Paragraph className="text-muted">→</Typography.Paragraph>
            <Typography.Paragraph className="text-foreground">
              {formatTime(option.arrivalTime)} {option.arrivalAirport}
            </Typography.Paragraph>
          </View>
          <Card.Description>
            {formatDurationMinutes(option.durationMinutes)} · {stopsLabel}
            {!isSelected ? ` · $${option.priceUSD}` : ""}
          </Card.Description>
          {option.matchReason ? (
            <Typography.Paragraph className="mt-1 text-xs text-accent">
              {option.matchReason}
            </Typography.Paragraph>
          ) : null}
        </Card.Body>
        {onViewBooking && (option.bookingToken || option.departureToken) ? (
          <Card.Footer>
            <Pressable
              className="rounded-full bg-surface-secondary px-3 py-1.5"
              onPress={() => onViewBooking(option)}
            >
              <Typography.Paragraph className="text-xs font-medium text-accent">
                {locale === "tr" ? "Nasıl rezervasyon yaparım?" : "How do I book this?"}
              </Typography.Paragraph>
            </Pressable>
          </Card.Footer>
        ) : null}
      </Card>
    </Pressable>
  );
}
