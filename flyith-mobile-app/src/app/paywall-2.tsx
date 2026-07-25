import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, Radio, RadioGroup, Surface, Typography, useThemeColor } from "heroui-native";
import type { ComponentProps, JSX } from "react";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface TrialStep {
  description: string;
  icon: ComponentProps<typeof Ionicons>["name"];
  label: string;
  title: string;
}

const trialSteps: TrialStep[] = [
  {
    description: "Your personal itinerary and creator picks unlock instantly.",
    icon: "checkmark",
    label: "TODAY",
    title: "Start exploring with Flyith",
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

export default function PaywallTwoScreen(): JSX.Element {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [accentColor, foregroundColor, mutedColor] = useThemeColor([
    "accent",
    "foreground",
    "muted",
  ]);
  const [selectedPlan, setSelectedPlan] = useState("yearly");
  const [showAllPlans, setShowAllPlans] = useState(false);

  const closePaywall = (): void => router.back();
  const continueToProfile = (): void => router.replace("/profile");

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
          <Typography type="h1">Try Flyith Premium free</Typography>
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
          <RadioGroup className="gap-3" value={selectedPlan} onValueChange={setSelectedPlan}>
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
                      $29.99 / year
                    </Typography>
                    <Typography color="muted" type="body-xs">
                      Only $2.50 per month after trial
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
                      $9.99 / month
                    </Typography>
                    <Typography color="muted" type="body-xs">
                      Flexible monthly billing
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
                7 DAYS FREE
              </Typography>
            </Surface>

            <View className="gap-1">
              <View className="flex-row items-baseline gap-2">
                <Typography type="h1" weight="bold">
                  $0
                </Typography>
                <Typography color="muted">today</Typography>
              </View>
              <Typography weight="semibold">Then $29.99 per year</Typography>
              <Typography color="muted" type="body-sm">
                That’s just $2.50/month. Cancel anytime.
              </Typography>
            </View>
          </Surface>
        )}
      </ScrollView>

      <Surface
        className="gap-2 rounded-none border-t border-border bg-white px-5 pt-4"
        style={{ paddingBottom: insets.bottom + 10 }}
        variant="default"
      >
        <Button onPress={continueToProfile} size="lg">
          <Button.Label className="font-bold">Start 7-Day Free Trial</Button.Label>
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

        <Typography className="text-center" color="muted" type="body-xs">
          No charge today · Cancel anytime
        </Typography>
      </Surface>
    </View>
  );
}
