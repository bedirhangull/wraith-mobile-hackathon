import { ThinkingOrb, type OrbState } from "expo-thinking-orbs";
import { Image } from "expo-image";
import { Typography } from "heroui-native";
import { type JSX, useEffect, useState } from "react";
import { View } from "react-native";
import Animated, { FadeIn, FadeOut } from "react-native-reanimated";

import type { ActivityKind } from "../types";
import Shimmer from "./shimmer";

const PHRASE_INTERVAL_MS = 2200;

const YOUTUBE_LOGO = require("../../../../assets/platform/youtube.png");

/** Cycles through several phrases so a long search reads like progress. */
export function TypingIndicator({
  phrases,
  orbState = "working",
  activity,
}: {
  phrases: string[];
  orbState?: OrbState;
  activity?: ActivityKind | null;
}): JSX.Element {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (phrases.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % phrases.length);
    }, PHRASE_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [phrases]);

  const label = phrases[index % phrases.length] ?? phrases[0];
  const showYouTubeLogo = activity === "youtube";

  return (
    <Animated.View
      entering={FadeIn.duration(150)}
      className="w-full flex-row items-center gap-2 px-4"
    >
      {showYouTubeLogo ? (
        <Image
          source={YOUTUBE_LOGO}
          accessibilityLabel="YouTube"
          style={{ width: 24, height: 18 }}
          contentFit="contain"
        />
      ) : (
        <ThinkingOrb state={orbState} size={20} theme="light" />
      )}
      <View className="min-w-0 flex-1">
        <Shimmer>
          <Shimmer.Mask
            background={<View className="flex-1 bg-foreground" />}
            overlay={
              <Shimmer.Overlay width="60%" duration={1400}>
                <View
                  className="flex-1"
                  style={{
                    experimental_backgroundImage:
                      "linear-gradient(to right, transparent 0%, #ffffff 45%, #ffffff 55%, transparent 100%)",
                  }}
                />
              </Shimmer.Overlay>
            }
          >
            <Animated.View
              key={label}
              entering={FadeIn.duration(260)}
              exiting={FadeOut.duration(160)}
            >
              <Typography.Paragraph className="text-base font-medium text-black">
                {label}
              </Typography.Paragraph>
            </Animated.View>
          </Shimmer.Mask>
        </Shimmer>
      </View>
    </Animated.View>
  );
}
