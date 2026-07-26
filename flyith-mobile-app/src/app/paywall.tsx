import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, Surface, Typography, useThemeColor, useToast } from "heroui-native";
import type { ComponentProps, JSX } from "react";
import { useEffect, useState } from "react";
import { Image, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaywallLegalFooter } from "@/features/subscription/PaywallLegalFooter";
import { PaywallOfferError } from "@/features/subscription/PaywallOfferError";
import { usePremium } from "@/features/subscription/usePremium";

interface PremiumFeature {
  description: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  title: string;
}

const premiumFeatures: PremiumFeature[] = [
  {
    description: "Day-by-day routes shaped around your pace and interests.",
    icon: "map-outline",
    title: "Personal itineraries",
  },
  {
    description: "Save places recommended by the creators you selected.",
    icon: "sparkles-outline",
    title: "Creator-powered places",
  },
  {
    description: "Build better trips around your real travel budget.",
    icon: "wallet-outline",
    title: "Smarter budget planning",
  },
];

const memberAvatars = [
  require("../../assets/avatars/avatar1.png"),
  require("../../assets/avatars/avatar2.png"),
  require("../../assets/avatars/avatar3.png"),
  require("../../assets/avatars/avatar4.png"),
];

function formatCountdown(totalSeconds: number): string[] {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return [hours, minutes, seconds].map((value) => value.toString().padStart(2, "0"));
}

export default function PaywallScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const [backgroundColor, foregroundColor, accentColor] = useThemeColor([
    "background",
    "foreground",
    "accent",
  ]);
  const [secondsLeft, setSecondsLeft] = useState(63_252);
  const {
    packages,
    purchase,
    restore,
    refresh,
    isPurchasing,
    isLoading,
    error,
    isMockMode,
    activateMockPremium,
  } = usePremium();
  const annual = packages.annual;
  // In mock mode: offers are always "available" — we show demo prices instead.
  const offersUnavailable = isMockMode ? false : (Boolean(error) || (!isLoading && !annual));
  // Demo prices shown when mock mode is active.
  const effectiveAnnualPrice = isMockMode ? "$29.99" : annual?.product.priceString;

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const countdown = formatCountdown(secondsLeft);
  const skipToPlanner = (): void => router.replace("/chat");

  async function handlePurchase(): Promise<void> {
    if (isMockMode) {
      const result = await activateMockPremium();
      if (result === "success") {
        toast.show({ label: "Welcome to Flyaith Premium" });
        router.replace("/chat");
      }
      return;
    }

    if (!annual) {
      toast.show({
        variant: "danger",
        label: "Offer unavailable",
        description: error ?? "Subscription packages haven't loaded yet. Try again in a moment.",
      });
      return;
    }

    const result = await purchase(annual);
    if (result === "success") {
      toast.show({ label: "Welcome to Flyaith Premium" });
      router.replace("/chat");
      return;
    }
    if (result === "error" || result === "unavailable") {
      toast.show({
        variant: "danger",
        label: "Purchase failed",
        description: "Please try again or restore previous purchases.",
      });
    }
  }

  async function handleRestore(): Promise<void> {
    const result = await restore();
    if (result === "success") {
      toast.show({ label: "Purchases restored" });
      router.replace("/chat");
      return;
    }
    if (result !== "cancelled") {
      toast.show({
        variant: "danger",
        label: "Nothing to restore",
        description: "No active Premium subscription was found for this Apple ID.",
      });
    }
  }

  const isBusy = isPurchasing || isLoading;
  const buttonDisabled = isMockMode ? isPurchasing : (isBusy || offersUnavailable);

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="overflow-hidden rounded-3xl" style={{ height: 210 }}>
          <Image
            resizeMode="cover"
            source={require("../../assets/images/paywall-limited-hero.png")}
            style={{ height: "100%", width: "100%" }}
          />

          <View className="absolute left-3 top-3">
            <Button
              accessibilityLabel="Close offer"
              isIconOnly
              onPress={skipToPlanner}
              size="sm"
              variant="secondary"
            >
              <Ionicons color={foregroundColor} name="close" size={20} />
            </Button>
          </View>
        </View>

        <View className="flex-row items-center justify-center">
          <Image
            resizeMode="contain"
            source={require("../../assets/images/laurel.png")}
            style={{ height: 48, width: 48 }}
          />
          <View className="items-center px-1">
            <Typography className="tracking-[2px]" type="body-xs" weight="semibold">
              TRAVEL, PERSONALIZED
            </Typography>
            <Typography color="muted" type="body-xs">
              Built around you
            </Typography>
          </View>
          <Image
            resizeMode="contain"
            source={require("../../assets/images/laurel.png")}
            style={{ height: 48, transform: [{ scaleX: -1 }], width: 48 }}
          />
        </View>

        <View className="items-center gap-2">
          <Typography className="text-center" type="h1">
            Your trip is ready to take off
          </Typography>
          <Typography className="max-w-80 text-center" color="muted">
            Unlock the personalized experience created from your onboarding choices.
          </Typography>
        </View>

        <View className="items-center gap-1">
          <Typography className="text-accent" type="h1" weight="bold">
            50% OFF
          </Typography>
          <Typography color="muted" weight="medium">
            Limited welcome offer
          </Typography>
        </View>

        <View className="flex-row items-center justify-center gap-2">
          {countdown.map((value, index) => (
            <View className="flex-row items-center gap-2" key={`${index}-${value}`}>
              <Surface
                className="h-12 w-16 items-center justify-center rounded-xl p-0"
                variant="secondary"
              >
                <Typography type="h3" weight="semibold">
                  {value}
                </Typography>
              </Surface>
              {index < countdown.length - 1 ? (
                <Typography color="muted" type="h3">
                  :
                </Typography>
              ) : null}
            </View>
          ))}
        </View>

        <View className="flex-row items-center justify-center gap-2">
          <Typography weight="medium">Only</Typography>
          <Typography color="muted" style={{ textDecorationLine: "line-through" }} weight="medium">
            $59.99
          </Typography>
          <Typography type="h3" weight="semibold">
            {effectiveAnnualPrice ? `${effectiveAnnualPrice} / year` : "Price loading…"}
          </Typography>
        </View>

        {!isMockMode && offersUnavailable ? (
          <PaywallOfferError
            isBusy={isBusy}
            message={error ?? "Subscription plans aren't available yet. Please try again in a moment."}
            onRetry={() => void refresh()}
          />
        ) : null}

        <View className="gap-2">
          {premiumFeatures.map((feature) => (
            <Surface
              className="flex-row items-center gap-4 rounded-2xl px-4 py-3"
              key={feature.title}
              variant="transparent"
            >
              <Surface
                className="h-11 w-11 items-center justify-center rounded-xl p-0"
                variant="secondary"
              >
                <Ionicons color={accentColor} name={feature.icon} size={21} />
              </Surface>
              <View className="flex-1 gap-0.5">
                <Typography weight="semibold">{feature.title}</Typography>
                <Typography color="muted" type="body-xs">
                  {feature.description}
                </Typography>
              </View>
            </Surface>
          ))}
        </View>
      </ScrollView>

      <Surface
        className="gap-3 rounded-none border-t border-border px-5 pt-3"
        style={{ paddingBottom: insets.bottom + 12 }}
        variant="default"
      >
        <View className="items-center gap-1">
          <View className="flex-row">
            {memberAvatars.map((avatar, index) => (
              <Image
                key={index}
                source={avatar}
                style={{
                  borderColor: backgroundColor,
                  borderRadius: 20,
                  borderWidth: 2,
                  height: 40,
                  marginLeft: index === 0 ? 0 : -12,
                  width: 40,
                  zIndex: memberAvatars.length - index,
                }}
              />
            ))}
          </View>
          <Typography className="max-w-72 text-center" type="body-sm" weight="medium">
            Join 12,000+ travelers planning with their favorite creators
          </Typography>
        </View>

        <Button isDisabled={buttonDisabled} onPress={() => void handlePurchase()} size="lg">
          <Button.Label className="font-bold">
            {isPurchasing ? "Purchasing…" : "Unlock Flyaith Premium"}
          </Button.Label>
        </Button>

        <PaywallLegalFooter isBusy={isBusy} onRestore={() => void handleRestore()} />
      </Surface>
    </View>
  );
}
