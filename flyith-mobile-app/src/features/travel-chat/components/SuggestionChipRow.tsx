import { Chip } from "heroui-native";
import { type JSX, useState } from "react";
import { ScrollView } from "react-native";
import Animated, { FadeInRight } from "react-native-reanimated";

import type { SuggestionChip } from "../types";

/** Chips stay mounted after a pick so the row's height never changes — a
 * disappearing row leaves a stale measured gap in the parent FlatList. */
export function SuggestionChipRow({
  chips,
  onSelect,
}: {
  chips: SuggestionChip[];
  onSelect: (chip: SuggestionChip) => void;
}): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 px-4"
    >
      {chips.map((chip, index) => {
        const isSelected = selectedId === chip.id;
        const isDimmed = selectedId !== null && !isSelected;

        return (
          <Animated.View
            key={chip.id}
            entering={FadeInRight.delay(index * 60)
              .duration(240)
              .springify()
              .damping(18)}
            style={{ opacity: isDimmed ? 0.4 : 1 }}
          >
            <Chip
              variant={isSelected ? "primary" : "soft"}
              color="accent"
              disabled={selectedId !== null}
              onPress={() => {
                setSelectedId(chip.id);
                onSelect(chip);
              }}
            >
              <Chip.Label>{chip.label}</Chip.Label>
            </Chip>
          </Animated.View>
        );
      })}
    </ScrollView>
  );
}
