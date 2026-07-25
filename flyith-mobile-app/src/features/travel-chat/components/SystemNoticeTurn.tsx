import { Typography } from "heroui-native";
import type { JSX } from "react";
import Animated, { FadeIn } from "react-native-reanimated";

export function SystemNoticeTurn({ text }: { text: string }): JSX.Element {
  return (
    <Animated.View entering={FadeIn.duration(200)} className="w-full items-center px-4">
      <Typography.Paragraph className="text-center text-sm text-muted">{text}</Typography.Paragraph>
    </Animated.View>
  );
}
