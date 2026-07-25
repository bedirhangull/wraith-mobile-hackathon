import type { JSX, ReactNode } from "react";
import { ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

export function OptionCardCarousel({ children }: { children: ReactNode }): JSX.Element {
  return (
    <Animated.View entering={FadeIn.duration(220)}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        contentContainerClassName="gap-3 px-4"
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}
