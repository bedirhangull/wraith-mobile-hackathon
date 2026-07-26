import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Radio, RadioGroup, Surface, Typography, useThemeColor, useToast } from "heroui-native";
import type { ComponentProps, JSX } from "react";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import type { PurchasesPackage } from "react-native-purchases";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { PaywallLegalFooter } from "@/features/subscription/PaywallLegalFooter";
import { PaywallOfferError } from "@/features/subscription/PaywallOfferError";
import { clearPendingPremiumAction } from "@/features/subscription/premiumChatGate";
import { usePremium } from "@/features/subscription/usePremium";

interface TrialStep {
  description: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  title: string;
}

type PlanKey = "yearly" | "monthly" | "weekly";

const trialSteps: TrialStep[] = [
  {
    description: "Your personal itinerary and creator picks unlock instantly.",
    icon: "checkmark",
    label: "TODAY",
    title: "Start exploring with Flyaith",
  },
  {
    description: "We’ll remind you before your free trial ends.",
    icon: "notifications-outline",
    label: "DAY 5",
    title: "Get a friendly reminder",
  },
  {
    description: "Continue with Premium or cancel anytime before this date.",
    icon: "sparkles-outline",
    label: "DAY 7",
    title: "Your trial ends",
  },
];

function hasFreeTrial(pkg: PurchasesPackage | null): boolean {
  return Boolean(pkg?.product.introPrice);
}

export default function PaywallTwoScreen(): JSX.Element {
  const router = useRouter();
  const { returnConversationId } = useLocalSearchParams<{ returnConversationId?: string }>();
  const returnChatId =
    typeof returnConversationId === "string" && returnConversationId.length > 0
      ? returnConversationId
      : undefined;
  const insets = useSafeAreaInsets();
  const { toast } = useToast();
  const [accentColor, foregroundColor, mutedColor] = useThemeColor([
    "accent",
    "foreground",
    "muted",
  ]);
  const [selectedPlan, setSelectedPlan] = useState<PlanKey>("yearly");
  const [showAllPlans, setShowAllPlans] = useState(false);
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

  const selectedPackage = useMemo(() => {
    if (selectedPlan === "weekly") return packages.weekly;
    if (selectedPlan === "monthly") return packages.monthly;
    return packages.annual;
  }, [packages, selectedPlan]);

  // In mock mode: offers are always "available".
  const offersUnavailable = isMockMode
    ? false
    : Boolean(error) || (!isLoading && !packages.annual && !packages.monthly && !packages.weekly);
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
  const isBusy = isPurchasing || isLoading;
  const buttonDisabled = isMockMode ? isPurchasing : (isBusy || offersUnavailable);
  // In mock mode: no free trial, show demo prices.
  const annualHasTrial = isMockMode ? false : hasFreeTrial(packages.annual);
  const annualPrice = isMockMode ? "$29.99" : packages.annual?.product.priceString;
  const monthlyPrice = isMockMode ? "$12.99" : packages.monthly?.product.priceString;
  const weeklyPrice = isMockMode ? "$6.99" : packages.weekly?.product.priceString;

  async function handlePurchase(): Promise<void> {
    if (isMockMode) {
      const result = await activateMockPremium();
      if (result === "success") {
        toast.show({ label: "Welcome to Flyaith Premium" });
        leaveAfterSuccess();
      }
      return;
    }

    if (!selectedPackage) {
      toast.show({
        variant: "danger",
        label: "Offer unavailable",
        description: error ?? "Subscription packages haven't loaded yet. Try again in a moment.",
      });
      return;
    }

    const result = await purchase(selectedPackage);
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

  const ctaLabel = (() => {
    if (isPurchasing) return "Purchasing…";
    if (selectedPlan === "yearly" && annualHasTrial) return "Start 7-Day Free Trial";
    return "Continue";
  })();

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-7 px-5 pb-8"
        contentContainerStyle={{ paddingTop: insets.top + 12 }}
        showsVerticalScrollIndicator={false}
      >
        <Button
          accessibilityLabel="Close paywall"
          isIconOnly
          onPress={closePaywall}
          size="sm"
          variant="ghost"
        >
          <Ionicons color={foregroundColor} name="close" size={23} />
        </Button>

        <View className="gap-2">
          <Typography type="h1">Try Flyaith Premium free</Typography>
          <Typography color="muted">
            Plan smarter trips with a trial that keeps you in control.
          </Typography>
        </View>

        <View>
          {trialSteps.map((step, index) => {
            const isFirst = index === 0;
            const isLast = index === trialSteps.length - 1;

            return (
              <View className="flex-row" key={step.label}>
                <View className="items-center">
                  <Surface
                    className="h-12 w-12 items-center justify-center rounded-full p-0"
                    variant={isFirst ? "default" : "secondary"}
                  >
                    <Ionicons
                      color={isFirst ? accentColor : mutedColor}
                      name={step.icon}
                      size={21}
                    />
                  </Surface>
                  {isLast ? null : <View className="h-14 w-px bg-border" />}
                </View>

                <View className="ml-4 flex-1 pt-0.5">
                  <Typography
                    className="text-accent tracking-[1.5px]"
                    type="body-xs"
                    weight="bold"
                  >
                    {step.label}
                  </Typography>
                  <Typography className="mt-1" weight="semibold">
                    {step.title}
                  </Typography>
                  <Typography className="mt-1" color="muted" type="body-sm">
                    {step.description}
                  </Typography>
                </View>
              </View>
            );
          })}
        </View>

        {showAllPlans ? (
          <RadioGroup
            className="gap-3"
            value={selectedPlan}
            onValueChange={(value) => setSelectedPlan(value as PlanKey)}
          >
            <RadioGroup.Item className="p-0" value="yearly">
              {({ isSelected }) => (
                <Surface
                  className={`relative flex-row items-center rounded-2xl border px-4 py-4 ${
                    isSelected ? "border-accent" : "border-border"
                  }`}
                  variant={isSelected ? "secondary" : "default"}
                >
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-center gap-2">
                      <Typography weight="semibold">Yearly</Typography>
                      <Surface className="rounded-full bg-accent px-2 py-1" variant="default">
                        <Typography className="text-white" type="body-xs" weight="bold">
                          SAVE 75%
                        </Typography>
                      </Surface>
                    </View>
                    <Typography type="h3" weight="semibold">
                      {annualPrice ? `${annualPrice} / year` : "Price loading…"}
                    </Typography>
                    <Typography color="muted" type="body-xs">
                      {annualHasTrial ? "Includes 7-day free trial" : "Best value billed yearly"}
                    </Typography>
                  </View>
                  <Radio />
                </Surface>
              )}
            </RadioGroup.Item>

            <RadioGroup.Item className="p-0" value="monthly">
              {({ isSelected }) => (
                <Surface
                  className={`flex-row items-center rounded-2xl border px-4 py-4 ${
                    isSelected ? "border-accent" : "border-border"
                  }`}
                  variant={isSelected ? "secondary" : "default"}
                >
                  <View className="flex-1 gap-1">
                    <Typography weight="semibold">Monthly</Typography>
                    <Typography type="h3" weight="semibold">
                      {monthlyPrice ? `${monthlyPrice} / month` : "Price loading…"}
                    </Typography>
                    <Typography color="muted" type="body-xs">
                      Flexible monthly billing
                    </Typography>
                  </View>
                  <Radio />
                </Surface>
              )}
            </RadioGroup.Item>

            <RadioGroup.Item className="p-0" value="weekly">
              {({ isSelected }) => (
                <Surface
                  className={`flex-row items-center rounded-2xl border px-4 py-4 ${
                    isSelected ? "border-accent" : "border-border"
                  }`}
                  variant={isSelected ? "secondary" : "default"}
                >
                  <View className="flex-1 gap-1">
                    <Typography weight="semibold">Weekly</Typography>
                    <Typography type="h3" weight="semibold">
                      {weeklyPrice ? `${weeklyPrice} / week` : "Price loading…"}
                    </Typography>
                    <Typography color="muted" type="body-xs">
                      Short trips, short commitment
                    </Typography>
                  </View>
                  <Radio />
                </Surface>
              )}
            </RadioGroup.Item>
          </RadioGroup>
        ) : (
          <Surface className="gap-4 rounded-2xl border border-border px-5 py-5" variant="default">
            <Surface className="self-start rounded-full bg-accent px-3 py-1" variant="default">
              <Typography className="text-white" type="body-xs" weight="bold">
                {annualHasTrial ? "7 DAYS FREE" : "YEARLY"}
              </Typography>
            </Surface>

            <View className="gap-1">
              {annualHasTrial ? (
                <View className="flex-row items-baseline gap-2">
                  <Typography type="h1" weight="bold">
                    $0
                  </Typography>
                  <Typography color="muted">today</Typography>
                </View>
              ) : null}
              <Typography weight="semibold">
                {annualHasTrial
                  ? `Then ${annualPrice ?? "—"} per year`
                  : `${annualPrice ?? "—"} per year`}
              </Typography>
              <Typography color="muted" type="body-sm">
                Cancel anytime.
              </Typography>
            </View>
          </Surface>
        )}
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
          <Button.Label className="font-bold">{ctaLabel}</Button.Label>
        </Button>

        <Pressable
          accessibilityRole="button"
          className="items-center py-2"
          onPress={() => setShowAllPlans((current) => !current)}
        >
          <Typography color="muted" type="body-sm" weight="medium">
            {showAllPlans ? "Back to trial offer" : "See all plans"}
          </Typography>
        </Pressable>

        <PaywallLegalFooter isBusy={isBusy} onRestore={() => void handleRestore()} />
      </Surface>
    </View>
  );
}
