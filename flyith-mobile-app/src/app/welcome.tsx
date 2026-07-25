import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Button, Typography } from "heroui-native";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  type ImageSourcePropType,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { SocialAuthButtons } from "@/components/social-auth-buttons";
import { travelObjects } from "@/data/travel-objects";
import { travelerMemojis } from "@/data/traveler-memojis";

const airplane = require("../../assets/images/airplane-topdown-memoji.png");

const routeDashes = [
  { left: 3, rotate: "-18deg", threshold: 0.27, top: 224 },
  { left: 12, rotate: "-21deg", threshold: 0.34, top: 212 },
  { left: 21, rotate: "-25deg", threshold: 0.42, top: 198 },
  { left: 30, rotate: "-29deg", threshold: 0.49, top: 181 },
  { left: 39, rotate: "-32deg", threshold: 0.57, top: 161 },
  { left: 48, rotate: "-33deg", threshold: 0.64, top: 140 },
  { left: 57, rotate: "-32deg", threshold: 0.71, top: 119 },
  { left: 66, rotate: "-29deg", threshold: 0.78, top: 100 },
  { left: 75, rotate: "-25deg", threshold: 0.83, top: 83 },
  { left: 84, rotate: "-19deg", threshold: 0.89, top: 70 },
] as const;

const travelStops = [
  { left: 2, size: 66, source: travelObjects[17], threshold: 0.15, top: 126 },
  { left: 4, size: 58, source: travelObjects[12], threshold: 0.18, top: 258 },
  { left: 15, size: 64, source: travelObjects[0], threshold: 0.24, top: 40 },
  { left: 24, size: 60, source: travelObjects[13], threshold: 0.3, top: 246 },
  { left: 31, size: 62, source: travelObjects[15], threshold: 0.35, top: 108 },
  { left: 34, size: 58, source: travelObjects[8], threshold: 0.47, top: 188 },
  { left: 47, size: 68, source: travelerMemojis[8], threshold: 0.46, top: 28 },
  { left: 50, size: 62, source: travelObjects[9], threshold: 0.51, top: 258 },
  { left: 62, size: 70, source: travelObjects[6], threshold: 0.58, top: 99 },
  { left: 63, size: 56, source: travelObjects[1], threshold: 0.63, top: 188 },
  { left: 73, size: 60, source: travelObjects[14], threshold: 0.65, top: 240 },
  { left: 77, size: 64, source: travelObjects[16], threshold: 0.69, top: 24 },
  { left: 83, size: 66, source: travelerMemojis[22], threshold: 0.78, top: 137 },
] as const;

interface TravelIconProps {
  left: number;
  progress: Animated.Value;
  size: number;
  source: ImageSourcePropType;
  threshold: number;
  top: number;
}

function TravelIcon({
  left,
  progress,
  size,
  source,
  threshold,
  top,
}: TravelIconProps): JSX.Element {
  const revealEnd = Math.min(threshold + 0.09, 0.94);

  return (
    <Animated.Image
      accessibilityIgnoresInvertColors
      resizeMode="contain"
      source={source}
      style={{
        height: size,
        left: `${left}%`,
        opacity: progress.interpolate({
          extrapolate: "clamp",
          inputRange: [threshold, revealEnd, 0.94, 0.99, 1],
          outputRange: [0, 1, 1, 0, 0],
        }),
        position: "absolute",
        top,
        transform: [
          {
            scale: progress.interpolate({
              extrapolate: "clamp",
              inputRange: [threshold, revealEnd],
              outputRange: [0.5, 1],
            }),
          },
          {
            translateY: progress.interpolate({
              extrapolate: "clamp",
              inputRange: [threshold, revealEnd],
              outputRange: [8, 0],
            }),
          },
        ],
        width: size,
      }}
    />
  );
}

export default function WelcomeScreen(): JSX.Element {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [flightProgress] = useState(() => new Animated.Value(0));
  const [buttonEntrance] = useState(() => new Animated.Value(0));
  const sceneWidth = Math.min(width - 32, 430);

  useEffect(() => {
    const flightAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(flightProgress, {
          duration: 6200,
          easing: Easing.inOut(Easing.ease),
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.delay(1100),
        Animated.timing(flightProgress, {
          duration: 0,
          toValue: 0,
          useNativeDriver: true,
        }),
      ])
    );
    const buttonAnimation = Animated.timing(buttonEntrance, {
      delay: 350,
      duration: 700,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    });

    flightAnimation.start();
    buttonAnimation.start();

    return () => {
      flightAnimation.stop();
      buttonAnimation.stop();
    };
  }, [buttonEntrance, flightProgress]);

  return (
    <LinearGradient
      colors={["#F8FBFF", "#EEF4FF", "#FFF6F1"]}
      end={{ x: 0.85, y: 1 }}
      locations={[0, 0.58, 1]}
      start={{ x: 0.1, y: 0 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View className="flex-1 justify-between px-4 pb-6 pt-1">
          <View className="self-center overflow-hidden" style={{ height: 330, width: sceneWidth }}>
            {routeDashes.map((dash) => (
              <Animated.View
                key={dash.left}
                style={{
                  backgroundColor: "rgba(68, 138, 255, 0.42)",
                  borderRadius: 2,
                  height: 3,
                  left: `${dash.left}%`,
                  opacity: flightProgress.interpolate({
                    extrapolate: "clamp",
                    inputRange: [
                      dash.threshold,
                      Math.min(dash.threshold + 0.05, 0.94),
                      0.94,
                      0.99,
                      1,
                    ],
                    outputRange: [0, 1, 1, 0, 0],
                  }),
                  position: "absolute",
                  top: dash.top,
                  transform: [{ rotate: dash.rotate }],
                  width: 21,
                }}
              />
            ))}

            {travelStops.map((stop) => (
              <TravelIcon
                key={stop.threshold}
                left={stop.left}
                progress={flightProgress}
                size={stop.size}
                source={stop.source}
                threshold={stop.threshold}
                top={stop.top}
              />
            ))}

            <Animated.View
              style={{
                height: 112,
                opacity: flightProgress.interpolate({
                  inputRange: [0, 0.05, 0.94, 0.99, 1],
                  outputRange: [0, 1, 1, 0, 0],
                }),
                position: "absolute",
                transform: [
                  {
                    translateX: flightProgress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-112, sceneWidth - 40],
                    }),
                  },
                  {
                    translateY: flightProgress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: [178, 82, 8],
                    }),
                  },
                  {
                    rotate: flightProgress.interpolate({
                      inputRange: [0, 0.5, 1],
                      outputRange: ["15deg", "12deg", "16deg"],
                    }),
                  },
                ],
                width: 112,
              }}
            >
              <Image
                accessibilityLabel="Blue and white airplane flying from left to right"
                resizeMode="contain"
                source={airplane}
                style={{
                  height: 112,
                  width: 112,
                }}
              />
            </Animated.View>
          </View>

          <Animated.View
            className="gap-4 px-2"
            style={{
              opacity: buttonEntrance,
              transform: [
                {
                  translateY: buttonEntrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [14, 0],
                  }),
                },
              ],
            }}
          >
            <View className="gap-2">
              <Typography align="center" type="h1">
                Plan less. Experience more.
              </Typography>
              <Typography align="center" color="muted">
                Personal travel ideas shaped around your budget, taste, and favorite creators.
              </Typography>
            </View>

            <View className="gap-3">
              <Button onPress={() => router.push("/auth")} size="lg">
                Get started
              </Button>
              <SocialAuthButtons action="Continue" />
            </View>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}
