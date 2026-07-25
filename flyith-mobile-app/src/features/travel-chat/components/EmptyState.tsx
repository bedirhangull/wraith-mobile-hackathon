import { Typography } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

type Locale = "tr" | "en";

export function EmptyState({ locale = "en" }: { locale?: Locale }): JSX.Element {
  const tr = locale === "tr";
  return (
    <View className="flex-1 items-center justify-center px-8">
      <Animated.View entering={FadeIn.duration(300)} className="items-center">
        <Typography.Heading className="text-center text-4xl font-semibold text-foreground">
          {tr ? "Nereye gidelim?" : "Where to?"}
        </Typography.Heading>
        <Typography.Paragraph className="mt-2 text-center text-lg text-muted">
          {tr
            ? "Hayalindeki geziden bahset — birlikte planlayalım."
            : "Tell me about the trip you're dreaming up — I'll help you plan it."}
        </Typography.Paragraph>
      </Animated.View>
    </View>
  );
}
