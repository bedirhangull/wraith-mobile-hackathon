import { ThinkingOrb } from "expo-thinking-orbs";
import { Typography } from "heroui-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Check } from "lucide-react-native";
import { type JSX, useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";

type Locale = "tr" | "en";

const STEPS: Record<Locale, string[]> = {
  tr: [
    "Tercihlerin okunuyor",
    "Uçuş ve konaklama eşleştiriliyor",
    "Mekanlar güne dağıtılıyor",
    "Bütçe hesaplanıyor",
    "Plan derleniyor",
  ],
  en: [
    "Reading your preferences",
    "Matching flights and stays",
    "Spreading places across the days",
    "Crunching the budget",
    "Assembling your plan",
  ],
};

const STEP_MS = 700;

/**
 * Full-screen mock "building your custom plan" experience.
 * TravelChatScreen keeps running prepareItinerary() in parallel while this animates.
 */
export default function GeneratingPlanScreen(): JSX.Element {
  const router = useRouter();
  const params = useLocalSearchParams<{ locale?: string }>();
  const locale: Locale = params.locale === "tr" ? "tr" : "en";
  const steps = useMemo(() => STEPS[locale], [locale]);
  const [completedCount, setCompletedCount] = useState(0);

  useEffect(() => {
    if (completedCount >= steps.length) {
      const timer = setTimeout(() => {
        if (router.canGoBack()) router.back();
        else router.replace("/");
      }, 500);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(() => setCompletedCount((count) => count + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [completedCount, router, steps.length]);

  const title =
    locale === "tr"
      ? "Senin için özelleştirilmiş plan oluşuyor"
      : "Building a plan tailored for you";
  const subtitle =
    locale === "tr"
      ? "Birkaç saniye — parçaları bir araya getiriyorum."
      : "Just a moment — putting the pieces together.";

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-background">
      <View className="flex-1 items-center justify-center gap-8 px-8">
        <ThinkingOrb state="composing" size={72} theme="light" />
        <Animated.View entering={FadeIn.duration(280)} className="items-center gap-2">
          <Typography.Heading className="text-center text-2xl font-semibold text-foreground">
            {title}
          </Typography.Heading>
          <Typography.Paragraph className="text-center text-muted">{subtitle}</Typography.Paragraph>
        </Animated.View>

        <View className="w-full max-w-sm gap-3">
          {steps.map((label, index) => {
            const done = index < completedCount;
            const active = index === completedCount;
            return (
              <View key={label} className="flex-row items-center gap-3">
                <View
                  className={`size-7 items-center justify-center rounded-full ${
                    done ? "bg-accent" : active ? "bg-accent/20" : "bg-surface-secondary"
                  }`}
                >
                  {done ? (
                    <Check size={14} color="#fff" />
                  ) : (
                    <Typography.Paragraph className="text-xs text-muted">
                      {index + 1}
                    </Typography.Paragraph>
                  )}
                </View>
                <Typography.Paragraph
                  className={`flex-1 text-base ${done || active ? "text-foreground" : "text-muted"}`}
                >
                  {label}
                  {active ? "…" : ""}
                </Typography.Paragraph>
              </View>
            );
          })}
        </View>
      </View>
    </SafeAreaView>
  );
}
