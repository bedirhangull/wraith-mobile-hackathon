import { Typography, useThemeColor } from "heroui-native";
import { ArrowUpDown } from "lucide-react-native";
import type { JSX } from "react";
import { Pressable, ScrollView, View } from "react-native";

import type { SortChoice } from "../utils/sorting";

export function SortBar<T extends string>({
  title,
  choices,
  value,
  onChange,
}: {
  title?: string;
  choices: SortChoice<T>[];
  value: T;
  onChange: (next: T) => void;
}): JSX.Element {
  const [mutedColor, accentColor] = useThemeColor(["muted", "accent"]);

  return (
    <View className="gap-1.5 px-4">
      {title ? (
        <Typography.Paragraph className="font-semibold text-foreground">
          {title}
        </Typography.Paragraph>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="items-center gap-2"
      >
        <ArrowUpDown size={14} color={mutedColor} />
        {choices.map((option) => {
          const isActive = option.id === value;
          return (
            <Pressable
              key={option.id}
              onPress={() => onChange(option.id)}
              className="rounded-full px-3 py-1"
              style={{
                backgroundColor: isActive ? accentColor : "transparent",
                borderWidth: isActive ? 0 : 1,
                borderColor: `${mutedColor}55`,
              }}
            >
              <Typography.Paragraph
                className="text-xs font-medium"
                style={{ color: isActive ? "#ffffff" : mutedColor }}
              >
                {option.label}
              </Typography.Paragraph>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
