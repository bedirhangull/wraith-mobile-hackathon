import { Ionicons } from "@expo/vector-icons";
import MaskedView from "@react-native-masked-view/masked-view";
import { useRouter } from "expo-router";
import { Button, Card, Input, Surface, Typography, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Image,
  type ImageSourcePropType,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInput as TextInputType,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  Easing,
  interpolate,
  interpolateColor,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { influencers, type Influencer } from "../data/influencers";
import { travelObjects } from "../data/travel-objects";
import { travelerMemojis } from "../data/traveler-memojis";
import { getSession } from "../features/auth/session";
import { upsertOnboardingAnswers } from "../features/auth/profile-api";
import { setUserProfile } from "../features/onboarding/profile";
import { mapAnswersToOnboardingContext } from "../features/onboarding/persistOnboarding";

interface OnboardingOption {
  description: string;
  id: string;
  label: string;
}

interface OnboardingPage {
  description: string;
  input?: {
    label: string;
    placeholder: string;
    supportingText: string;
  };
  isMultiSelect?: boolean;
  kind?: "budget" | "influencers" | "name" | "travelers";
  options: OnboardingOption[];
  title: string;
}

const airplane = require("../../assets/images/airplane-memoji-transparent.png");
const globe = require("../../assets/images/globe-memoji.png");
const location = require("../../assets/images/location-memoji.png");
const passport = require("../../assets/images/passport-memoji.png");
const suitcase = require("../../assets/images/suitcase-memoji.png");

const pageVisuals: Record<number, ImageSourcePropType[]> = {
  0: [travelerMemojis[0], travelObjects[15], travelObjects[16]],
  1: [travelerMemojis[3], travelerMemojis[4], travelerMemojis[5]],
  2: [travelObjects[6], travelObjects[7], travelObjects[8]],
  3: [travelObjects[0], travelObjects[1], travelObjects[2]],
  4: [travelerMemojis[12], travelerMemojis[13], travelObjects[13]],
  5: [travelObjects[16], travelObjects[15], travelerMemojis[17]],
  7: [travelObjects[14], travelObjects[17], travelerMemojis[20]],
};

const optionImages: Record<string, ImageSourcePropType> = {
  "slow-explorer": travelerMemojis[21],
  "adventure-seeker": travelerMemojis[22],
  "culture-lover": travelerMemojis[23],
  "relaxed-vacationer": travelerMemojis[5],
  "food-cafes": travelObjects[6],
  "art-culture": travelObjects[7],
  nature: travelObjects[9],
  nightlife: travelObjects[11],
  "hidden-places": travelObjects[8],
  spontaneous: airplane,
  "light-plan": location,
  "full-itinerary": passport,
  "full-plan": passport,
  shortlist: location,
  "flexible-board": suitcase,
  "surprise-first": globe,
};

const influencersById = new Map(influencers.map((influencer) => [influencer.id, influencer]));

const pages: OnboardingPage[] = [
  {
    description: "Tell us what we should call you during your journey.",
    input: {
      label: "Your name",
      placeholder: "Enter your name",
      supportingText: "This will be used to personalize your experience.",
    },
    kind: "name",
    options: [],
    title: "What’s your name?",
  },
  {
    description: "Choose the pace and energy that feels most like you.",
    options: [
      {
        description: "Fewer stops, deeper experiences.",
        id: "slow-explorer",
        label: "Slow explorer",
      },
      {
        description: "Active days and unexpected discoveries.",
        id: "adventure-seeker",
        label: "Adventure seeker",
      },
      {
        description: "Museums, history, design, and local stories.",
        id: "culture-lover",
        label: "Culture lover",
      },
      {
        description: "Easy plans with plenty of time to unwind.",
        id: "relaxed-vacationer",
        label: "Relaxed vacationer",
      },
    ],
    title: "What kind of traveler are you?",
  },
  {
    description: "Pick everything you would love to see in your recommendations.",
    isMultiSelect: true,
    options: [
      {
        description: "Restaurants, bakeries, and neighborhood coffee.",
        id: "food-cafes",
        label: "Food & cafés",
      },
      {
        description: "Galleries, architecture, and creative spaces.",
        id: "art-culture",
        label: "Art & culture",
      },
      {
        description: "Hikes, coastlines, parks, and scenic routes.",
        id: "nature",
        label: "Nature",
      },
      {
        description: "Bars, music, events, and late-night energy.",
        id: "nightlife",
        label: "Nightlife",
      },
      {
        description: "Quiet corners away from the usual route.",
        id: "hidden-places",
        label: "Hidden places",
      },
    ],
    title: "What do you want to discover?",
  },
  {
    description: "We’ll shape suggestions around your usual comfort range.",
    input: {
      label: "Budget per person",
      placeholder: "0",
      supportingText: "Enter an estimated amount and choose your currency.",
    },
    kind: "budget",
    options: [],
    title: "What’s your usual travel budget?",
  },
  {
    description: "Tell us how many travelers we should plan for.",
    kind: "travelers",
    options: [],
    title: "How many people are going?",
  },
  {
    description: "Tell us how much structure feels comfortable.",
    options: [
      {
        description: "Keep the day open and decide as you go.",
        id: "spontaneous",
        label: "Keep it spontaneous",
      },
      {
        description: "Anchor the day with a few great places.",
        id: "light-plan",
        label: "A few planned stops",
      },
      {
        description: "Make every hour count with a clear route.",
        id: "full-itinerary",
        label: "Full daily itinerary",
      },
    ],
    title: "How do you like your days planned?",
  },
  {
    description: "Search and choose the creators whose recommendations match your taste.",
    isMultiSelect: true,
    kind: "influencers",
    options: influencers.map((influencer) => ({
      description: influencer.handle,
      id: influencer.id,
      label: influencer.name,
    })),
    title: "Choose your travel influencers",
  },
  {
    description: "Choose what you want to see when your personalized experience begins.",
    options: [
      {
        description: "A structured route with activities organized by day.",
        id: "full-plan",
        label: "A complete day-by-day plan",
      },
      {
        description: "A focused collection of places worth saving.",
        id: "shortlist",
        label: "A shortlist of places",
      },
      {
        description: "Ideas you can mix and match whenever you want.",
        id: "flexible-board",
        label: "A flexible inspiration board",
      },
      {
        description: "Let us choose the best starting point for you.",
        id: "surprise-first",
        label: "Surprise me",
      },
    ],
    title: "What should we prepare first?",
  },
];

type Answers = Record<number, string[]>;
type InputAnswers = Record<number, string>;

interface TravelerCounts {
  adults: number;
  children: number;
}

interface TransitionState {
  isBack: boolean;
  overIndex: number;
  targetIndex: number;
  underIndex: number;
}

interface OnboardingProgressProps {
  index: number;
}

function OnboardingProgress({ index }: OnboardingProgressProps): JSX.Element {
  const accentColor = useThemeColor("accent");

  return (
    <Surface className="h-2 flex-1 overflow-hidden rounded-full p-0" variant="tertiary">
      <View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: accentColor,
            transform: [{ scaleX: (index + 1) / pages.length }],
            transformOrigin: "0% 50%",
          },
        ]}
      />
    </Surface>
  );
}

interface PageVisualProps {
  index: number;
}

function PageVisual({ index }: PageVisualProps): JSX.Element | null {
  const visuals = pageVisuals[index];

  if (!visuals) {
    return null;
  }

  return (
    <Surface
      className="h-36 flex-row items-center justify-center overflow-hidden rounded-3xl bg-white p-0"
      variant="default"
      style={
        index === 0
          ? {
              shadowColor: "transparent",
              shadowOpacity: 0,
              shadowRadius: 0,
              elevation: 0,
              // uniwind compiles Tailwind's box-shadow (from Surface's
              // surface__root class) into this RN style key — the legacy
              // shadow*/elevation props above don't touch it.
              boxShadow: "none",
            }
          : undefined
      }
    >
      {visuals.map((source, visualIndex) => (
        <View
          className="h-28 w-28 items-center justify-center"
          key={visualIndex}
          style={{
            marginLeft: visualIndex === 0 ? 0 : -20,
            transform: [
              {
                rotate: visualIndex === 0 ? "-7deg" : visualIndex === 2 ? "7deg" : "0deg",
              },
              { translateY: visualIndex === 1 ? -5 : 5 },
            ],
            zIndex: visualIndex === 1 ? 3 : 2,
          }}
        >
          <Image resizeMode="contain" source={source} style={{ height: 104, width: 104 }} />
        </View>
      ))}
    </Surface>
  );
}

interface OptionCardProps {
  isSelected: boolean;
  onPress: () => void;
  option: OnboardingOption;
}

function OptionCard({ isSelected, onPress, option }: OptionCardProps): JSX.Element {
  const selectedProgress = useSharedValue(isSelected ? 1 : 0);
  const accentColor = useThemeColor("accent");
  const image = optionImages[option.id];

  useEffect(() => {
    selectedProgress.value = withTiming(isSelected ? 1 : 0, {
      duration: 220,
      easing: Easing.inOut(Easing.ease),
    });
  }, [isSelected, selectedProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(selectedProgress.value, [0, 1], ["transparent", accentColor]),
    transform: [
      {
        scale: interpolate(selectedProgress.value, [0, 1], [1, 1.012]),
      },
    ],
  }));

  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected: isSelected }}
      onPress={onPress}
    >
      <Animated.View style={[{ borderRadius: 16, borderWidth: 2 }, animatedStyle]}>
        <Card variant={isSelected ? "secondary" : "default"}>
          <Card.Body className="flex-row items-center gap-4">
            {image ? (
              <Surface
                className="h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-white p-0"
                variant="default"
              >
                <Image resizeMode="contain" source={image} style={{ height: 50, width: 50 }} />
              </Surface>
            ) : null}

            <View className="flex-1 gap-1">
              <Card.Title>{option.label}</Card.Title>
            </View>

            {isSelected ? (
              <Ionicons
                accessibilityLabel="Selected"
                color={accentColor}
                name="checkmark-circle"
                size={24}
              />
            ) : null}
          </Card.Body>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

interface InfluencerCardProps {
  influencer: Influencer;
  isSelected: boolean;
  onPress: () => void;
}

function InfluencerCard({ influencer, isSelected, onPress }: InfluencerCardProps): JSX.Element {
  const selectedProgress = useSharedValue(isSelected ? 1 : 0);
  const accentColor = useThemeColor("accent");
  const resolvedImage = Image.resolveAssetSource(influencer.image);
  const imageScale = Math.min(144 / resolvedImage.width, 160 / resolvedImage.height);
  const imageSize = {
    height: resolvedImage.height * imageScale,
    width: resolvedImage.width * imageScale,
  };

  useEffect(() => {
    selectedProgress.value = withTiming(isSelected ? 1 : 0, {
      duration: 220,
      easing: Easing.inOut(Easing.ease),
    });
  }, [isSelected, selectedProgress]);

  const animatedStyle = useAnimatedStyle(() => ({
    borderColor: interpolateColor(selectedProgress.value, [0, 1], ["transparent", accentColor]),
    transform: [{ scale: interpolate(selectedProgress.value, [0, 1], [1, 1.012]) }],
  }));

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: isSelected }}
      onPress={onPress}
    >
      <Animated.View style={[{ borderRadius: 16, borderWidth: 2 }, animatedStyle]}>
        <Card variant={isSelected ? "secondary" : "default"}>
          <Card.Body className="flex-row items-stretch gap-3 p-3">
            <Surface
              className="h-40 w-36 items-center justify-end overflow-hidden rounded-2xl bg-white p-0"
              variant="default"
            >
              <Image
                accessibilityLabel={`${influencer.name} memoji`}
                resizeMode="contain"
                source={influencer.image}
                style={imageSize}
              />
            </Surface>

            <View className="flex-1 justify-between py-1">
              <View className="items-start gap-2">
                <Surface className="rounded-full px-2.5 py-1" variant="secondary">
                  <Typography type="body-xs">
                    {influencer.origin.flag} → {influencer.destination.flag}
                  </Typography>
                </Surface>

                <Typography color="muted" type="body-xs">
                  {influencer.origin.city} → {influencer.destination.city}
                </Typography>
              </View>

              <View className="gap-0.5">
                <Card.Title>{influencer.name}</Card.Title>
                <Card.Description>{influencer.handle}</Card.Description>
              </View>
            </View>

            {isSelected ? (
              <View className="absolute right-3 top-3">
                <Ionicons
                  accessibilityLabel="Selected"
                  color={accentColor}
                  name="checkmark-circle"
                  size={23}
                />
              </View>
            ) : null}
          </Card.Body>
        </Card>
      </Animated.View>
    </Pressable>
  );
}

interface TravelerCounterProps {
  count: number;
  label: string;
  onDecrease: () => void;
  onIncrease: () => void;
  supportingText: string;
}

function TravelerCounter({
  count,
  label,
  onDecrease,
  onIncrease,
  supportingText,
}: TravelerCounterProps): JSX.Element {
  return (
    <Card>
      <Card.Body className="flex-row items-center gap-4">
        <View className="flex-1 gap-1">
          <Card.Title>{label}</Card.Title>
          <Card.Description>{supportingText}</Card.Description>
        </View>

        <View className="flex-row items-center gap-3">
          <Button
            accessibilityLabel={`Decrease ${label}`}
            isIconOnly
            onPress={onDecrease}
            size="sm"
            variant="secondary"
          >
            <Button.Label>−</Button.Label>
          </Button>
          <Typography className="min-w-6 text-center" weight="semibold">
            {count}
          </Typography>
          <Button
            accessibilityLabel={`Increase ${label}`}
            isIconOnly
            onPress={onIncrease}
            size="sm"
            variant="secondary"
          >
            <Button.Label>+</Button.Label>
          </Button>
        </View>
      </Card.Body>
    </Card>
  );
}

interface PageContentProps {
  answers: Answers;
  influencerSearch: string;
  index: number;
  inputAnswers?: InputAnswers;
  onBack: () => void;
  onFinish: () => void;
  onInputChange: (value: string) => void;
  onNext: () => void;
  onSearchChange: (value: string) => void;
  onSelect: (optionId: string) => void;
  onTravelerChange: (type: keyof TravelerCounts, change: number) => void;
  shouldAutoFocusInput?: boolean;
  travelerCounts: TravelerCounts;
}

function PageContent({
  answers,
  influencerSearch,
  index,
  inputAnswers,
  onBack,
  onFinish,
  onInputChange,
  onNext,
  onSearchChange,
  onSelect,
  onTravelerChange,
  shouldAutoFocusInput = false,
  travelerCounts,
}: PageContentProps): JSX.Element {
  const insets = useSafeAreaInsets();
  const inputRef = useRef<TextInputType>(null);
  const page = pages[index];
  const selectedOptions = answers[index] ?? [];
  const inputValue = inputAnswers?.[index] ?? "";
  const isLastPage = index === pages.length - 1;
  const canContinue =
    page.kind === "name"
      ? inputValue.trim().length >= 2
      : page.kind === "budget"
        ? Number(inputValue) > 0
        : page.kind === "travelers"
          ? travelerCounts.adults > 0
          : selectedOptions.length > 0;
  const visibleOptions =
    page.kind === "influencers"
      ? page.options.filter((option) => {
          const influencer = influencersById.get(option.id);
          const searchText = [
            option.label,
            option.description,
            influencer?.origin.city,
            influencer?.destination.city,
            influencer?.niche,
            influencer?.highlight,
          ].join(" ");

          return searchText
            .toLocaleLowerCase()
            .includes(influencerSearch.trim().toLocaleLowerCase());
        })
      : page.options;

  useEffect(() => {
    if (!page.input || !shouldAutoFocusInput) {
      return;
    }

    const focusTimer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);

    return () => clearTimeout(focusTimer);
  }, [index, page.input, shouldAutoFocusInput]);

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 gap-6 px-6 pb-24" style={{ paddingTop: insets.top + 16 }}>
        <View className="gap-4">
          <View className="flex-row items-center justify-between">
            <OnboardingProgress index={index} />

            <Typography className="ml-4" color="muted" type="body-xs">
              {index + 1} / {pages.length}
            </Typography>
          </View>

          <Typography type="h1">{page.title}</Typography>
        </View>

        {page.kind === "influencers" ? (
          <Surface
            className="flex-1 overflow-hidden rounded-3xl border border-border p-0"
            variant="default"
          >
            <View className="border-b border-border p-3">
              <View className="h-14">
                <Input
                  className="flex-1"
                  onChangeText={onSearchChange}
                  placeholder="Search influencers"
                  returnKeyType="search"
                  value={influencerSearch}
                />
              </View>
            </View>

            <ScrollView
              className="flex-1"
              contentContainerClassName="gap-3 p-3 pb-6"
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
            >
              {visibleOptions.map((option) => {
                const influencer = influencersById.get(option.id);

                return influencer ? (
                  <InfluencerCard
                    influencer={influencer}
                    isSelected={selectedOptions.includes(option.id)}
                    key={option.id}
                    onPress={() => onSelect(option.id)}
                  />
                ) : null;
              })}

              {visibleOptions.length === 0 ? (
                <Typography className="py-8 text-center" color="muted">
                  No influencers found.
                </Typography>
              ) : null}
            </ScrollView>
          </Surface>
        ) : (
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-3 px-1 pb-4 pt-2"
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <PageVisual index={index} />

            {page.kind === "name" && page.input ? (
              <View className="gap-2">
                <Typography type="body-sm" weight="medium">
                  {page.input.label}
                </Typography>
                <View className="h-14">
                  <Input
                    autoCapitalize="words"
                    autoCorrect={false}
                    autoFocus={shouldAutoFocusInput}
                    className="flex-1"
                    onChangeText={onInputChange}
                    placeholder={page.input.placeholder}
                    ref={inputRef}
                    returnKeyType="done"
                    showSoftInputOnFocus
                    value={inputValue}
                  />
                </View>
              </View>
            ) : page.kind === "budget" && page.input ? (
              <View className="gap-2">
                <Typography type="body-sm" weight="medium">
                  {page.input.label}
                </Typography>
                <View className="h-14 flex-row gap-3">
                  <View className="flex-1">
                    <Input
                      autoFocus={shouldAutoFocusInput}
                      className="flex-1"
                      keyboardType="number-pad"
                      onChangeText={(value) => onInputChange(value.replace(/[^0-9]/g, ""))}
                      placeholder={page.input.placeholder}
                      ref={inputRef}
                      returnKeyType="done"
                      showSoftInputOnFocus
                      value={inputValue}
                    />
                  </View>

                  <Surface
                    className="h-14 w-28 flex-row items-center justify-center gap-1 rounded-2xl p-0"
                    variant="secondary"
                  >
                    <Typography type="h3" weight="semibold">
                      $
                    </Typography>
                    <Typography weight="semibold">USD</Typography>
                  </Surface>
                </View>
              </View>
            ) : page.kind === "travelers" ? (
              <View className="gap-3">
                <TravelerCounter
                  count={travelerCounts.adults}
                  label="Adults"
                  onDecrease={() => onTravelerChange("adults", -1)}
                  onIncrease={() => onTravelerChange("adults", 1)}
                  supportingText="Age 13 and above"
                />
                <TravelerCounter
                  count={travelerCounts.children}
                  label="Children"
                  onDecrease={() => onTravelerChange("children", -1)}
                  onIncrease={() => onTravelerChange("children", 1)}
                  supportingText="Age 0–12"
                />
              </View>
            ) : (
              visibleOptions.map((option) => (
                <OptionCard
                  isSelected={selectedOptions.includes(option.id)}
                  key={option.id}
                  onPress={() => onSelect(option.id)}
                  option={option}
                />
              ))
            )}
          </ScrollView>
        )}
      </View>

      {index > 0 ? (
        <View
          style={{
            bottom: -22,
            left: -16,
            position: "absolute",
          }}
        >
          <Button className="h-28 w-28 rounded-full" onPress={onBack} variant="secondary">
            Back
          </Button>
        </View>
      ) : null}

      <View
        style={{
          bottom: -22,
          position: "absolute",
          right: -16,
        }}
      >
        <Button
          className="h-28 w-28 rounded-full"
          isDisabled={!canContinue}
          onPress={isLastPage ? onFinish : onNext}
        >
          {isLastPage ? "Finish" : "Next"}
        </Button>
      </View>
    </View>
  );
}

export default function OnboardingScreen(): JSX.Element {
  const router = useRouter();
  const { height, width } = useWindowDimensions();
  const [answers, setAnswers] = useState<Answers>({});
  const [inputAnswers, setInputAnswers] = useState<InputAnswers>({});
  const [influencerSearch, setInfluencerSearch] = useState("");
  const [travelerCounts, setTravelerCounts] = useState<TravelerCounts>({
    adults: 1,
    children: 0,
  });
  const [currentIndex, setCurrentIndex] = useState(0);
  const [transition, setTransition] = useState<TransitionState | null>(null);
  const transitionProgress = useSharedValue(0);

  const finishTransition = (targetIndex: number): void => {
    setCurrentIndex(targetIndex);
    setTransition(null);

    setTimeout(() => {
      transitionProgress.value = 0;
    }, 50);
  };

  const startTransition = (targetIndex: number, isBack: boolean): void => {
    if (transition) {
      return;
    }

    setTransition({
      isBack,
      overIndex: isBack ? currentIndex : targetIndex,
      targetIndex,
      underIndex: isBack ? targetIndex : currentIndex,
    });
    transitionProgress.value = isBack ? 1 : 0;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        transitionProgress.value = withTiming(
          isBack ? 0 : 1,
          {
            duration: 460,
            easing: Easing.bezier(0.45, 0, 0.2, 1),
          },
          (finished) => {
            if (finished) {
              runOnJS(finishTransition)(targetIndex);
            }
          }
        );
      });
    });
  };

  const handleSelect = (pageIndex: number, optionId: string): void => {
    const page = pages[pageIndex];

    setAnswers((currentAnswers) => {
      const currentSelection = currentAnswers[pageIndex] ?? [];
      const nextSelection = page.isMultiSelect
        ? currentSelection.includes(optionId)
          ? currentSelection.filter((id) => id !== optionId)
          : [...currentSelection, optionId]
        : [optionId];

      return {
        ...currentAnswers,
        [pageIndex]: nextSelection,
      };
    });
  };

  const handleTravelerChange = (type: keyof TravelerCounts, change: number): void => {
    setTravelerCounts((current) => ({
      ...current,
      [type]: Math.max(type === "adults" ? 1 : 0, current[type] + change),
    }));
  };

  const maskDiameter = Math.hypot(width, height) * 2;
  const maskRadius = maskDiameter / 2;
  const maskAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: transitionProgress.value }],
  }));

  const visibleIndex = transition?.underIndex ?? currentIndex;

  return (
    <View className="flex-1 bg-white">
      <PageContent
        answers={answers}
        influencerSearch={influencerSearch}
        index={visibleIndex}
        inputAnswers={inputAnswers}
        onBack={() => startTransition(visibleIndex - 1, true)}
        onFinish={() => {
          const { context, fullName } = mapAnswersToOnboardingContext({
            answers,
            inputAnswers,
            travelerCounts,
          });
          setUserProfile(context);

          const session = getSession();
          if (session) {
            void upsertOnboardingAnswers(
              session.user.id,
              { answers, inputAnswers, travelerCounts },
              fullName
            ).catch((err) => {
              console.warn("[onboarding] failed to persist to Supabase", err);
            });
          }

          router.replace("/paywall");
        }}
        onInputChange={(value) =>
          setInputAnswers((current) => ({
            ...current,
            [visibleIndex]: value,
          }))
        }
        onNext={() => startTransition(visibleIndex + 1, false)}
        onSearchChange={setInfluencerSearch}
        onSelect={(optionId) => handleSelect(visibleIndex, optionId)}
        onTravelerChange={handleTravelerChange}
        shouldAutoFocusInput={!transition}
        travelerCounts={travelerCounts}
      />

      {transition ? (
        <MaskedView
          androidRenderingMode="software"
          maskElement={
            <View style={StyleSheet.absoluteFill}>
              <Animated.View
                style={[
                  {
                    backgroundColor: "black",
                    borderRadius: maskRadius,
                    height: maskDiameter,
                    left: transition.isBack ? -maskRadius : width - maskRadius,
                    position: "absolute",
                    top: height - maskRadius,
                    width: maskDiameter,
                  },
                  maskAnimatedStyle,
                ]}
              />
            </View>
          }
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        >
          <PageContent
            answers={answers}
            influencerSearch={influencerSearch}
            index={transition.overIndex}
            inputAnswers={inputAnswers}
            onBack={() => undefined}
            onFinish={() => undefined}
            onInputChange={() => undefined}
            onNext={() => undefined}
            onSearchChange={() => undefined}
            onSelect={() => undefined}
            onTravelerChange={() => undefined}
            shouldAutoFocusInput={false}
            travelerCounts={travelerCounts}
          />
        </MaskedView>
      ) : null}
    </View>
  );
}
