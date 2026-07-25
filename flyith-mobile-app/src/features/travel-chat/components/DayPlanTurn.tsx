import { Chip, Typography } from "heroui-native";
import type { JSX } from "react";
import { Pressable, View } from "react-native";

import type { DayPlanSlot, DayPlanSlotId, PlaceOption } from "../types";
import { OptionCardCarousel } from "./OptionCardCarousel";
import { PlaceCard } from "./PlaceCard";

export function DayPlanTurn({
  label,
  slots,
  locale,
  selectedBySlot,
  onSelectSlotPlace,
  onOpenPlace,
  onRefreshSlot,
}: {
  label: string;
  slots: DayPlanSlot[];
  locale: "tr" | "en";
  selectedBySlot?: Partial<Record<DayPlanSlotId, PlaceOption>>;
  onSelectSlotPlace: (slotId: DayPlanSlotId, place: PlaceOption) => void;
  onOpenPlace: (place: PlaceOption) => void;
  onRefreshSlot?: (slotId: DayPlanSlot["id"]) => void;
}): JSX.Element {
  const refreshLabel = locale === "tr" ? "Bu slotu değiştir" : "Refresh this slot";

  return (
    <View className="gap-3">
      <Typography.Paragraph className="px-4 font-semibold text-foreground">
        {label}
      </Typography.Paragraph>
      {slots.map((slot) => {
        const selected = selectedBySlot?.[slot.id];
        return (
          <View key={slot.id} className="gap-2">
            <View className="flex-row items-center justify-between px-4">
              <View className="flex-1 pr-2">
                <Typography.Paragraph className="font-semibold text-accent">
                  {slot.label}
                </Typography.Paragraph>
                <Typography.Paragraph className="text-xs text-muted">
                  {slot.timeRange}
                </Typography.Paragraph>
                {selected ? (
                  <Typography.Paragraph
                    className="mt-0.5 text-xs text-foreground"
                    numberOfLines={1}
                  >
                    {locale === "tr" ? `Seçilen: ${selected.name}` : `Picked: ${selected.name}`}
                  </Typography.Paragraph>
                ) : null}
              </View>
              {onRefreshSlot ? (
                <Pressable onPress={() => onRefreshSlot(slot.id)}>
                  <Chip size="sm" variant="soft">
                    <Chip.Label>{refreshLabel}</Chip.Label>
                  </Chip>
                </Pressable>
              ) : null}
            </View>
            {slot.options.length > 0 ? (
              <OptionCardCarousel>
                {slot.options.map((option) => (
                  <PlaceCard
                    key={option.id}
                    option={option}
                    locale={locale}
                    isSelected={selected?.id === option.id}
                    isDimmed={Boolean(selected && selected.id !== option.id)}
                    onSelect={(place) => onSelectSlotPlace(slot.id, place)}
                    onOpenDetail={onOpenPlace}
                  />
                ))}
              </OptionCardCarousel>
            ) : (
              <Typography.Paragraph className="px-4 text-sm text-muted">
                {locale === "tr"
                  ? "Bu saat için sonuç bulunamadı."
                  : "No places found for this slot."}
              </Typography.Paragraph>
            )}
          </View>
        );
      })}
    </View>
  );
}
