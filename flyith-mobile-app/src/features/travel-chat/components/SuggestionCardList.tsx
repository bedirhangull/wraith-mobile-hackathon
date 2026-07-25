import { Card, Typography } from "heroui-native";
import { type JSX, useState } from "react";
import { Pressable, View } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";

import type { SuggestionChip } from "../types";

/** Large tappable option cards — the model fills in emoji + description so a
 * choice reads like a real card instead of a cramped chip.
 *
 * Cards stay mounted after a pick (selected one highlighted, rest dimmed): the
 * chat keeps its context, and the row's height never changes, which would
 * otherwise leave a stale measured gap in the surrounding FlatList. */
export function SuggestionCardList({
  chips,
  onSelect,
}: {
  chips: SuggestionChip[];
  onSelect: (chip: SuggestionChip) => void;
}): JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <View className="gap-2 px-4">
      {chips.map((chip, index) => {
        const isSelected = selectedId === chip.id;
        const isDimmed = selectedId !== null && !isSelected;
        const isReusableAction = chip.id === "review-plan";

        return (
          <Animated.View
            key={chip.id}
            entering={FadeInDown.delay(index * 70)
              .duration(260)
              .springify()
              .damping(18)}
            style={{ opacity: isDimmed ? 0.4 : 1 }}
          >
            <Pressable
              disabled={selectedId !== null && !isReusableAction}
              onPress={() => {
                if (!isReusableAction) setSelectedId(chip.id);
                onSelect(chip);
              }}
            >
              <Card className={isSelected ? "border-accent" : undefined}>
                <Card.Body className="flex-row items-center gap-3">
                  {chip.emoji ? (
                    <View className="size-11 items-center justify-center rounded-full bg-accent/10">
                      <Typography.Paragraph className="text-2xl">{chip.emoji}</Typography.Paragraph>
                    </View>
                  ) : null}
                  <View className="flex-1 gap-0.5">
                    <Card.Title>{chip.label}</Card.Title>
                    {chip.description ? (
                      <Card.Description>{chip.description}</Card.Description>
                    ) : null}
                  </View>
                </Card.Body>
              </Card>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}
