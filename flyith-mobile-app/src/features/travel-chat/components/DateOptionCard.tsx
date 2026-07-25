import { Card, Chip, Typography } from "heroui-native";
import type { JSX } from "react";
import { Image, Pressable, View } from "react-native";

import type { DateOption } from "../types";
import { formatDurationMinutes, formatShortDate, nightsBetween } from "../utils/dates";
import { OPTION_CARD_WIDTH } from "./optionCardWidth";

export function DateOptionCard({
  option,
  locale,
  onPress,
}: {
  option: DateOption;
  locale: "tr" | "en";
  onPress: (option: DateOption) => void;
}): JSX.Element {
  const nights = nightsBetween(option.startDate, option.endDate);
  const nightsLabel = locale === "tr" ? `${nights} gece` : `${nights} nights`;
  const cheapestLabel = locale === "tr" ? "En uygun" : "Cheapest";
  const stopsLabel =
    option.stops === undefined
      ? null
      : option.stops === 0
        ? locale === "tr"
          ? "Aktarmasız"
          : "Nonstop"
        : locale === "tr"
          ? `${option.stops} aktarma`
          : `${option.stops} stop`;

  const meta = [nightsLabel, option.airline, stopsLabel].filter(Boolean).join(" · ");

  return (
    <Pressable style={{ width: OPTION_CARD_WIDTH }} onPress={() => onPress(option)}>
      <Card className={option.isCheapest ? "border-accent" : undefined}>
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
          {option.isCheapest ? (
            <Chip variant="soft" color="success" size="sm">
              <Chip.Label>{cheapestLabel}</Chip.Label>
            </Chip>
          ) : null}
        </Card.Header>
        <Card.Body>
          <Card.Title className="text-lg">
            {formatShortDate(option.startDate)} – {formatShortDate(option.endDate)}
          </Card.Title>
          <Card.Description>{meta}</Card.Description>
          {option.durationMinutes ? (
            <Card.Description>{formatDurationMinutes(option.durationMinutes)}</Card.Description>
          ) : null}
        </Card.Body>
        {option.priceUSD ? (
          <Card.Footer>
            <Typography.Paragraph className="text-xl font-semibold text-accent">
              ${option.priceUSD}
            </Typography.Paragraph>
          </Card.Footer>
        ) : null}
      </Card>
    </Pressable>
  );
}

/** Full-width row under the carousel — as a trailing card it was hidden off the
 * right edge, so nobody found the calendar. */
export function PickExactDatesButton({
  locale,
  onPress,
}: {
  locale: "tr" | "en";
  onPress: () => void;
}): JSX.Element {
  return (
    <Pressable className="mx-4" onPress={onPress}>
      <Card>
        <Card.Body className="flex-row items-center gap-3">
          <View className="size-10 items-center justify-center rounded-full bg-accent/10">
            <Typography.Paragraph className="text-xl">🗓️</Typography.Paragraph>
          </View>
          <View className="flex-1">
            <Card.Title>{locale === "tr" ? "Takvimden seç" : "Pick exact dates"}</Card.Title>
            <Card.Description>
              {locale === "tr" ? "Kendi tarihlerini seç" : "Choose your own dates"}
            </Card.Description>
          </View>
        </Card.Body>
      </Card>
    </Pressable>
  );
}
