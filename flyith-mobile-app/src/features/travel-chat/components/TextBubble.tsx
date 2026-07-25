import type { JSX } from "react";
import { View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { DetectedText } from "./DetectedText";

export function UserTextBubble({
  text,
  locale = "en",
}: {
  text: string;
  locale?: "tr" | "en";
}): JSX.Element {
  return (
    <View className="w-full flex-row justify-end px-4">
      <Animated.View
        entering={FadeIn.duration(220)}
        className="max-w-[78%] rounded-2xl bg-accent px-4 py-2.5"
      >
        <DetectedText
          text={text}
          locale={locale}
          className="text-base text-accent-foreground"
          linkClassName="underline text-accent-foreground"
        />
      </Animated.View>
    </View>
  );
}

export function AssistantTextBubble({
  text,
  locale = "en",
}: {
  text: string;
  locale?: "tr" | "en";
}): JSX.Element {
  return (
    <Animated.View entering={FadeIn.duration(220)} className="w-full px-4">
      <DetectedText text={text} locale={locale} className="text-base text-foreground" />
    </Animated.View>
  );
}
