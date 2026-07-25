import { Card, Chip, Typography, useThemeColor } from "heroui-native";
import { MapPin } from "lucide-react-native";
import type { JSX } from "react";
import { Image, Linking, Pressable, View } from "react-native";

import type { PlaceOption } from "../types";
import { formatReviewCount } from "../utils/formatReviewCount";
import { OPTION_CARD_WIDTH } from "./optionCardWidth";

function mapsUrl(place: PlaceOption): string {
  if (place.latitude !== undefined && place.longitude !== undefined) {
    return `https://www.google.com/maps/search/?api=1&query=${place.latitude},${place.longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
}

export function PlaceCard({
  option,
  onSelect,
  onOpenDetail,
  isSelected = false,
  isDimmed = false,
  locale = "en",
}: {
  option: PlaceOption;
  /** Primary tap — select this place for the current slot / list. */
  onSelect: (option: PlaceOption) => void;
  /** Optional detail sheet opener (small "Detail" chip). */
  onOpenDetail?: (option: PlaceOption) => void;
  isSelected?: boolean;
  isDimmed?: boolean;
  locale?: "tr" | "en";
}): JSX.Element {
  const accentColor = useThemeColor("accent");
  const tr = locale === "tr";
  const selectedLabel = tr ? "Seçildi" : "Selected";
  const mapsLabel = tr ? "Harita" : "Maps";
  const reviewCount = formatReviewCount(option.reviewCount, locale);

  return (
    <Pressable
      style={{ width: OPTION_CARD_WIDTH, opacity: isDimmed ? 0.45 : 1 }}
      disabled={isDimmed}
      onPress={() => (onOpenDetail ? onOpenDetail(option) : onSelect(option))}
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
              <Chip size="sm" variant="soft" color="accent">
                <Chip.Label>{selectedLabel}</Chip.Label>
              </Chip>
            ) : null}
          </View>
          {(() => {
            const parts = [
              option.rating ? `★ ${option.rating}` : null,
              reviewCount ? `${reviewCount} ${tr ? "yorum" : "reviews"}` : null,
              option.priceLevel ?? null,
              option.address ?? null,
            ].filter(Boolean);
            return parts.length > 0 ? (
              <Card.Description numberOfLines={2}>{parts.join(" · ")}</Card.Description>
            ) : null;
          })()}
        </Card.Body>
        <Card.Footer className="flex-row items-center justify-between">
          <Chip size="sm" variant="soft">
            <Chip.Label>{option.category}</Chip.Label>
          </Chip>
          <View className="flex-row items-center gap-2">
            <Pressable
              className="flex-row items-center gap-1 rounded-full bg-surface-secondary px-3 py-1.5"
              onPress={(event) => {
                event.stopPropagation?.();
                void Linking.openURL(mapsUrl(option));
              }}
            >
              <MapPin size={13} color={accentColor} />
              <Typography.Paragraph className="text-xs font-medium text-accent">
                {mapsLabel}
              </Typography.Paragraph>
            </Pressable>
            {onOpenDetail ? (
              <Pressable
                className="rounded-full bg-accent px-4 py-2"
                onPress={(event) => {
                  event.stopPropagation?.();
                  onSelect(option);
                }}
              >
                <Typography.Paragraph className="text-xs font-semibold text-accent-foreground">
                  {isSelected ? selectedLabel : tr ? "Burayı seç" : "Choose"}
                </Typography.Paragraph>
              </Pressable>
            ) : null}
          </View>
        </Card.Footer>
      </Card>
    </Pressable>
  );
}
