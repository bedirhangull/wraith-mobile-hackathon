import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Surface, Switch, Typography, useThemeColor, useToast } from "heroui-native";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { Animated, Easing, Image, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaywallLegalFooter } from "@/features/subscription/PaywallLegalFooter";
import { PaywallOfferError } from "@/features/subscription/PaywallOfferError";
import { clearPendingPremiumAction } from "@/features/subscription/premiumChatGate";
import { usePremium } from "@/features/subscription/usePremium";

interface TravelerReview {
  comment: string;
  date: string;
  name: string;
}

const travelerReviews: TravelerReview[] = [
  {
    comment:
      "Flyaith turned a vague weekend idea into a route that felt completely made for me.",
    date: "2 days ago",
    name: "Maya K.",
  },
  {
    comment:
      "The creator recommendations helped us find places we would never have discovered alone.",
    date: "1 week ago",
    name: "Daniel R.",
  },
  {
    comment:
      "My plan stayed inside my budget without making the trip feel limited. I loved that.",
    date: "3 weeks ago",
    name: "Sofia A.",
  },
];

const travelerAvatars = [
  require("../../assets/avatars/avatar1.png"),
  require("../../assets/avatars/avatar7.png"),
  require("../../assets/avatars/avatar4.png"),
];

export default function PaywallThreeScreen(): JSX.Element {
  const router = useRouter();
  const { returnConversationId } = useLocalSearchParams<{ returnConversationId?: string }>();
  const returnChatId =
    typeof returnConversationId === "string" && returnConversationId.length > 0
      ? returnConversationId
      : undefined;
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const [foregroundColor, accentColor] = useThemeColor(["foreground", "accent"]);
  const [reviewIndex, setReviewIndex] = useState(0);
  const [isReminderEnabled, setIsReminderEnabled] = useState(true);
  const [reviewOpacity] = useState(() => new Animated.Value(1));
  const [reviewOffset] = useState(() => new Animated.Value(0));
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
  // In mock mode: no free trial, show demo prices, offers always "available".
  const hasTrial = isMockMode ? false : Boolean(annual?.product.introPrice);
  const priceLabel = isMockMode ? "$29.99" : annual?.product.priceString;
  const isBusy = isPurchasing || isLoading;
  const offersUnavailable = isMockMode ? false : (Boolean(error) || (!isLoading && !annual));
  const buttonDisabled = isMockMode ? isPurchasing : (isBusy || offersUnavailable);

  useEffect(() => {
    const interval = setInterval(() => {
      Animated.parallel([
        Animated.timing(reviewOpacity, {
          duration: 240,
          easing: Easing.inOut(Easing.quad),
          toValue: 0,
          useNativeDriver: true,
        }),
        Animated.timing(reviewOffset, {
          duration: 240,
          easing: Easing.inOut(Easing.quad),
          toValue: -6,
          useNativeDriver: true,
        }),
      ]).start(() => {
        setReviewIndex((current) => (current + 1) % travelerReviews.length);
        reviewOffset.setValue(6);

        Animated.parallel([
          Animated.timing(reviewOpacity, {
            duration: 240,
            easing: Easing.inOut(Easing.quad),
            toValue: 1,
            useNativeDriver: true,
          }),
          Animated.timing(reviewOffset, {
            duration: 240,
            easing: Easing.inOut(Easing.quad),
            toValue: 0,
            useNativeDriver: true,
          }),
        ]).start();
      });
    }, 3500);

    return () => clearInterval(interval);
  }, [reviewOffset, reviewOpacity]);

  const currentReview = travelerReviews[reviewIndex];

  const leaveAfterSuccess = (): void => {
    if (returnChatId) {
      router.replace(`/chat?id=${returnChatId}`);
      return;
    }
    router.replace("/profile");
  };

  const closePaywall = (): void => {
    clearPendingPremiumAction();
    if (returnChatId) {
      router.replace(`/chat?id=${returnChatId}`);
      return;
    }
    router.back();
  };

  async function handlePurchase(): Promise<void> {
    if (isMockMode) {
      const result = await activateMockPremium();
      if (result === "success") {
        toast.show({ label: "Welcome to Flyaith Premium" });
        leaveAfterSuccess();
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
      leaveAfterSuccess();
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
      leaveAfterSuccess();
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

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-5 pb-6"
        contentContainerStyle={{ paddingTop: insets.top + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="relative overflow-hidden rounded-3xl px-4 pb-16 pt-10">
          <LinearGradient
            colors={["#FFFFFF", accentColor, "#FFFFFF"]}
            locations={[0, 0.5, 1]}
            style={{
              bottom: 0,
              left: 0,
              opacity: 0.13,
              position: "absolute",
              right: 0,
              top: 0,
            }}
          />

          <View className="absolute left-0 top-0">
            <Button
              accessibilityLabel="Close paywall"
              isIconOnly
              onPress={closePaywall}
              size="sm"
              variant="ghost"
            >
              <Ionicons color={foregroundColor} name="close" size={23} />
            </Button>
          </View>

          <View
            className="flex-row items-center justify-center"
            style={{ transform: [{ translateY: -10 }] }}
          >
            {travelerAvatars.map((avatar, index) => (
              <Surface
                className={`h-24 w-24 items-center justify-center overflow-hidden rounded-2xl border-2 border-background p-0 ${
                  index === 0 ? "-rotate-6" : index === 2 ? "rotate-6" : ""
                }`}
                key={index}
                style={{
                  marginLeft: index === 0 ? 0 : -10,
                  transform: [
                    { rotate: index === 0 ? "-6deg" : index === 2 ? "6deg" : "0deg" },
                  ],
                  zIndex: index === 1 ? 3 : 2,
                }}
                variant="secondary"
              >
                <Image resizeMode="cover" source={avatar} style={{ height: 88, width: 88 }} />
              </Surface>
            ))}
          </View>

          <View className="absolute bottom-0 left-0 right-0 flex-row items-center justify-center">
            <Image
              resizeMode="contain"
              source={require("../../assets/images/laurel.png")}
              style={{ height: 58, tintColor: accentColor, width: 58 }}
            />
            <View className="items-center px-2">
              <Typography className="text-accent" type="h2" weight="bold">
                12,000+
              </Typography>
              <Typography className="tracking-[1.3px]" color="muted" type="body-xs" weight="bold">
                HAPPY TRAVELERS
              </Typography>
            </View>
            <Image
              resizeMode="contain"
              source={require("../../assets/images/laurel.png")}
              style={{
                height: 58,
                tintColor: accentColor,
                transform: [{ scaleX: -1 }],
                width: 58,
              }}
            />
          </View>
        </View>

        <View className="items-center gap-2">
          <Typography className="text-center" type="h1">
            Travel like it was planned for you
          </Typography>
          <Typography className="max-w-80 text-center" color="muted">
            Personal routes, creator-approved places, and smarter budgets in one trip plan.
          </Typography>
        </View>

        <View className="h-44 justify-center">
          <Animated.View
            style={{
              opacity: reviewOpacity,
              transform: [{ translateY: reviewOffset }],
            }}
          >
            <Surface className="gap-4 rounded-2xl px-5 py-5" variant="secondary">
              <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                  <Typography weight="semibold">{currentReview.name}</Typography>
                  <Typography color="muted" type="body-xs">
                    {currentReview.date}
                  </Typography>
                </View>
                <View className="flex-row">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <Ionicons color={accentColor} key={index} name="star" size={15} />
                  ))}
                </View>
              </View>
              <Typography color="muted" type="body-sm">
                “{currentReview.comment}”
              </Typography>
            </Surface>
          </Animated.View>
        </View>

        <Surface className="gap-4 rounded-2xl border border-border px-5 py-5" variant="default">
          <View className="flex-row items-center gap-2">
            <Typography type="h3" weight="semibold">
              Yearly Premium
            </Typography>
            <Surface className="rounded-full bg-accent px-2 py-1" variant="default">
              <Typography className="text-white" type="body-xs" weight="bold">
                SAVE 50%
              </Typography>
            </Surface>
          </View>

          <View className="gap-1">
            <View className="flex-row items-baseline gap-2">
              <Typography color="muted" style={{ textDecorationLine: "line-through" }}>
                $59.99
              </Typography>
              <Typography type="h2" weight="bold">
                {priceLabel ? `${priceLabel} / year` : "Price loading…"}
              </Typography>
            </View>
            <Typography color="muted" type="body-xs">
              Cancel anytime
            </Typography>
          </View>
        </Surface>

        <Surface
          className="flex-row items-center justify-between rounded-2xl px-5 py-4"
          variant="secondary"
        >
          <View className="mr-4 flex-1 gap-1">
            <Typography weight="semibold">Trial ending reminder</Typography>
            <Typography color="muted" type="body-xs">
              Notify me before the free trial ends
            </Typography>
          </View>
          <Switch isSelected={isReminderEnabled} onSelectedChange={setIsReminderEnabled} />
        </Surface>
        {!isMockMode && offersUnavailable ? (
          <PaywallOfferError
            isBusy={isBusy}
            message={error ?? "Subscription plans aren't available yet. Please try again in a moment."}
            onRetry={() => void refresh()}
          />
        ) : null}
      </ScrollView>

      <Surface
        className="gap-2 rounded-none border-t border-border bg-white px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 10 }}
        variant="default"
      >
        <Button isDisabled={buttonDisabled} onPress={() => void handlePurchase()} size="lg">
          <Button.Label className="font-bold">
            {isPurchasing ? "Purchasing…" : hasTrial ? "Start My Free Trial" : "Unlock Premium"}
          </Button.Label>
        </Button>

        <Typography className="text-center" color="muted" type="body-xs">
          {hasTrial
            ? `7 days free, then ${priceLabel ?? "—"}/year`
            : `${priceLabel ?? "—"}/year · Cancel anytime`}
        </Typography>

        <PaywallLegalFooter isBusy={isBusy} onRestore={() => void handleRestore()} />
      </Surface>
    </View>
  );
}
