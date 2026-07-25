import { Card, Chip, Typography } from "heroui-native";
import type { JSX } from "react";
import { Image, Pressable, View } from "react-native";

import type { HotelOption } from "../types";
import { formatReviewCount } from "../utils/formatReviewCount";
import { OPTION_CARD_WIDTH } from "./optionCardWidth";

export function HotelOptionCard({
  option,
  onPress,
  onViewDetails,
  isSelected = false,
  isDimmed = false,
  locale = "en",
}: {
  option: HotelOption;
  onPress: (option: HotelOption) => void;
  onViewDetails?: (option: HotelOption) => void;
  isSelected?: boolean;
  isDimmed?: boolean;
  locale?: "tr" | "en";
}): JSX.Element {
  const selectedLabel = locale === "tr" ? "Seçildi" : "Selected";
  const reviewCount = formatReviewCount(option.reviewCount, locale);

  return (
    <Pressable
      style={{ width: OPTION_CARD_WIDTH, opacity: isDimmed ? 0.45 : 1 }}
      disabled={isDimmed}
      onPress={() =>
        onViewDetails && option.propertyToken ? onViewDetails(option) : onPress(option)
      }
    >
      <Card className={isSelected ? "border-accent" : undefined}>
        {option.thumbnailUrl ? (
          <Image
            source={{ uri: option.thumbnailUrl }}
            className="h-32 w-full rounded-t-2xl"
            resizeMode="cover"
          />
        ) : null}
        <Card.Body>
          <View className="flex-row items-start justify-between gap-2">
            <Card.Title numberOfLines={1} className="flex-1">
              {option.name}
            </Card.Title>
            {isSelected ? (
              <Chip size="sm" variant="soft" color="success">
                <Chip.Label>{selectedLabel}</Chip.Label>
              </Chip>
            ) : null}
          </View>
          {(() => {
            const meta = [
              option.rating ? `★ ${option.rating}` : null,
              reviewCount ? `${reviewCount} ${locale === "tr" ? "yorum" : "reviews"}` : null,
            ]
              .filter(Boolean)
              .join(" ");
            return meta ? <Card.Description numberOfLines={2}>{meta}</Card.Description> : null;
          })()}
          {option.matchReason ? (
            <Typography.Paragraph className="mt-1 text-xs text-accent">
              {option.matchReason}
            </Typography.Paragraph>
          ) : null}
        </Card.Body>
        <Card.Footer className="flex-row items-center justify-between">
          <Typography.Paragraph className="font-semibold text-accent">
            {option.pricePerNightUSD
              ? `$${option.pricePerNightUSD}/${locale === "tr" ? "gece" : "night"}`
              : locale === "tr"
                ? "Fiyata bak"
                : "See price"}
          </Typography.Paragraph>
          <View className="flex-row items-center gap-2">
            {option.hotelClass ? (
              <Chip size="sm" variant="soft">
                <Chip.Label>
                  {option.hotelClass}★ {locale === "tr" ? "otel" : "hotel"}
                </Chip.Label>
              </Chip>
            ) : null}
            {onViewDetails && option.propertyToken ? (
              <Pressable
                className="rounded-full bg-accent px-4 py-2"
                onPress={(event) => {
                  event.stopPropagation?.();
                  onPress(option);
                }}
              >
                <Typography.Paragraph className="text-xs font-semibold text-accent-foreground">
                  {isSelected
                    ? selectedLabel
                    : locale === "tr"
                      ? "Bu oteli seç"
                      : "Choose this hotel"}
                </Typography.Paragraph>
              </Pressable>
            ) : null}
          </View>
        </Card.Footer>
      </Card>
    </Pressable>
  );
}
