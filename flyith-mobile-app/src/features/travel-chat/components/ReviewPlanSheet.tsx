import * as Haptics from "expo-haptics";
import { Button, Card, Chip, Typography, useThemeColor } from "heroui-native";
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  GripVertical,
} from "lucide-react-native";
import { type JSX, useCallback, useMemo, useState } from "react";
import { Image, Modal, Pressable, ScrollView, View } from "react-native";
import DraggableFlatList, {
  type RenderItemParams,
  ScaleDecorator,
} from "react-native-draggable-flatlist";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import type { ItineraryActivity, ItineraryDay, TripBrief } from "../types";
import { formatDateRange, formatTime, nightsBetween } from "../utils/dates";
import { findLocalTripImage } from "../utils/localTripImages";
import { TripContactDirectory } from "./TripContactDirectory";
import { TripReminders } from "./TripReminders";
import { TripRouteMap } from "./TripRouteMap";

type Locale = "tr" | "en";
type TabId = "summary" | "days" | "map" | "contacts" | "reminders" | "budget";

interface ReviewPlanSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  brief: TripBrief;
  days: ItineraryDay[];
  locale?: Locale;
  onReorderDays: (days: ItineraryDay[]) => void;
  onStart: () => void;
}

const KIND_EMOJI: Record<ItineraryActivity["kind"], string> = {
  food: "🍽",
  sight: "🏛",
  experience: "✨",
  transit: "🚇",
  rest: "☕",
  shopping: "🛍",
  event: "🎟",
};

const REVIEW_SECTIONS: { id: TabId; tr: string; en: string }[] = [
  { id: "summary", tr: "Özet", en: "Summary" },
  { id: "days", tr: "Gün gün", en: "Day by day" },
  { id: "map", tr: "Harita", en: "Map" },
  { id: "contacts", tr: "Rehber", en: "Directory" },
  { id: "reminders", tr: "Hatırlatmalar", en: "Reminders" },
  { id: "budget", tr: "Bütçe", en: "Budget" },
];

function SectionPicker({
  value,
  locale,
  onChange,
}: {
  value: TabId;
  locale: Locale;
  onChange: (value: TabId) => void;
}): JSX.Element {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerClassName="gap-2 pr-4"
      className="mt-2"
    >
      {REVIEW_SECTIONS.map((section) => {
        const selected = value === section.id;
        return (
          <Pressable
            key={section.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(section.id)}
            className={`rounded-full border px-4 py-2.5 ${
              selected ? "border-accent bg-accent" : "border-divider bg-surface-secondary"
            }`}
          >
            <Typography.Paragraph
              className={`text-sm font-semibold ${selected ? "text-accent-foreground" : "text-muted"}`}
            >
              {locale === "tr" ? section.tr : section.en}
            </Typography.Paragraph>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function nightCount(brief: TripBrief): number {
  if (!brief.startDate || !brief.endDate) return 1;
  return Math.max(1, nightsBetween(brief.startDate, brief.endDate));
}

function budgetBreakdown(brief: TripBrief, days: ItineraryDay[]) {
  const flight = brief.chosenFlight?.priceUSD ?? 0;
  const hotelPerNight = brief.chosenHotel?.pricePerNightUSD ?? 0;
  const hotel = hotelPerNight * nightCount(brief);
  const activitiesFromDays = days.reduce((sum, day) => {
    if (day.estimatedDayCostUSD != null) return sum + day.estimatedDayCostUSD;
    return (
      sum + day.activities.reduce((inner, activity) => inner + (activity.estimatedCostUSD ?? 0), 0)
    );
  }, 0);
  const total = flight + hotel + activitiesFromDays;
  const budget = brief.budgetTotalUSD;
  const overBudget = budget != null && total > budget;
  return { flight, hotel, activitiesFromDays, total, budget, overBudget };
}

function slotForTime(time?: string): "morning" | "afternoon" | "evening" {
  if (!time) return "afternoon";
  const hour = Number.parseInt(time.slice(0, 2), 10);
  if (!Number.isFinite(hour)) return "afternoon";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function groupActivities(activities: ItineraryActivity[], locale: Locale) {
  const labels = {
    morning: locale === "tr" ? "Sabah" : "Morning",
    afternoon: locale === "tr" ? "Öğleden sonra" : "Afternoon",
    evening: locale === "tr" ? "Akşam" : "Evening",
  };
  const groups: {
    id: "morning" | "afternoon" | "evening";
    label: string;
    items: ItineraryActivity[];
  }[] = [
    { id: "morning", label: labels.morning, items: [] },
    { id: "afternoon", label: labels.afternoon, items: [] },
    { id: "evening", label: labels.evening, items: [] },
  ];
  for (const activity of activities) {
    const slot = slotForTime(activity.time);
    groups.find((group) => group.id === slot)?.items.push(activity);
  }
  return groups.filter((group) => group.items.length > 0);
}

function DayTimelineRow({
  day,
  locale,
  drag,
  isActive,
}: {
  day: ItineraryDay;
  locale: Locale;
  drag: () => void;
  isActive: boolean;
}): JSX.Element {
  const [expanded, setExpanded] = useState(true);
  const muted = useThemeColor("muted");
  const accent = useThemeColor("accent");
  const groups = useMemo(() => groupActivities(day.activities, locale), [day.activities, locale]);

  const handleDrag = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    drag();
  };

  return (
    <View>
      <Card variant="secondary" className={isActive ? "border-accent" : undefined}>
        <Card.Body className="gap-3">
          <View className="flex-row items-start gap-3">
            <View className="rounded-xl bg-accent/10 px-3 py-2">
              <Typography.Paragraph className="text-xs font-semibold uppercase text-accent">
                {locale === "tr" ? "Gün" : "Day"}
              </Typography.Paragraph>
              <Typography.Paragraph className="text-center text-xl font-semibold text-accent">
                {day.dayNumber}
              </Typography.Paragraph>
            </View>
            <Pressable className="flex-1 gap-1" onPress={() => setExpanded((value) => !value)}>
              <View className="flex-row items-start gap-2">
                <Card.Title numberOfLines={2} className="flex-1">
                  {day.title}
                </Card.Title>
                {expanded ? (
                  <ChevronUp size={18} color={muted} />
                ) : (
                  <ChevronDown size={18} color={muted} />
                )}
              </View>
              {day.summary ? (
                <Card.Description numberOfLines={expanded ? 3 : 1}>{day.summary}</Card.Description>
              ) : null}
            </Pressable>
            <Pressable
              accessibilityLabel={
                locale === "tr" ? "Günü sürükleyerek sırala" : "Drag to reorder day"
              }
              delayLongPress={120}
              disabled={isActive}
              hitSlop={10}
              onLongPress={handleDrag}
              className={`rounded-xl p-2.5 ${isActive ? "bg-accent/10" : "bg-background"}`}
            >
              <GripVertical size={19} color={isActive ? accent : muted} />
            </Pressable>
          </View>

          {expanded
            ? groups.map((group) => (
                <View key={group.id} className="gap-2 rounded-xl bg-background/70 p-3">
                  <Typography.Paragraph className="text-xs font-semibold uppercase tracking-wide text-accent">
                    {group.label}
                  </Typography.Paragraph>
                  {group.items.map((activity, i) => (
                    <View key={`${group.id}-${i}`} className="flex-row items-start gap-2">
                      <Typography.Paragraph className="w-12 text-xs font-semibold text-muted">
                        {activity.time ?? "—"}
                      </Typography.Paragraph>
                      <Typography.Paragraph className="text-base">
                        {KIND_EMOJI[activity.kind]}
                      </Typography.Paragraph>
                      <View className="flex-1">
                        <Typography.Paragraph className="text-sm font-medium text-foreground">
                          {activity.title}
                        </Typography.Paragraph>
                        {activity.placeName || activity.estimatedCostUSD != null ? (
                          <Typography.Paragraph className="text-xs text-muted">
                            {[
                              activity.placeName,
                              activity.estimatedCostUSD != null
                                ? `~$${activity.estimatedCostUSD}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Typography.Paragraph>
                        ) : null}
                      </View>
                    </View>
                  ))}
                </View>
              ))
            : null}

          {day.estimatedDayCostUSD != null ? (
            <Typography.Paragraph
              className="border-t pt-3 text-xs text-muted"
              style={{ borderTopColor: "#D1D5DB" }}
            >
              {locale === "tr" ? "Gün tahmini" : "Day estimate"} ~${day.estimatedDayCostUSD}
            </Typography.Paragraph>
          ) : null}
        </Card.Body>
      </Card>
    </View>
  );
}

function BudgetBar({
  total,
  budget,
  locale,
}: {
  total: number;
  budget?: number;
  locale: Locale;
}): JSX.Element {
  const ratio = budget && budget > 0 ? Math.min(total / budget, 1.2) : 0;
  const over = budget != null && total > budget;
  return (
    <View className="gap-2">
      <View className="h-3 overflow-hidden rounded-full bg-surface-secondary">
        <View
          className={over ? "h-full bg-danger" : "h-full bg-accent"}
          style={{ width: `${Math.min(ratio, 1) * 100}%` }}
        />
      </View>
      <Typography.Paragraph className="text-sm text-foreground">
        ${Math.round(total)}
        {budget != null ? ` / $${budget}` : ""}
        {over
          ? locale === "tr"
            ? ` · ~$${Math.round(total - budget)} aşım`
            : ` · ~$${Math.round(total - budget)} over`
          : ""}
      </Typography.Paragraph>
    </View>
  );
}

export function ReviewPlanSheet({
  isOpen,
  onOpenChange,
  brief,
  days,
  locale = "en",
  onReorderDays,
  onStart,
}: ReviewPlanSheetProps): JSX.Element {
  const [tab, setTab] = useState<TabId>("summary");
  const insets = useSafeAreaInsets();
  const tr = locale === "tr";
  const foreground = useThemeColor("foreground");
  const selectedPlaceImage =
    brief.dayPlanSelections?.afternoon?.thumbnailUrl ??
    brief.dayPlanSelections?.evening?.thumbnailUrl ??
    brief.dayPlanSelections?.morning?.thumbnailUrl;
  const heroImageUrl = brief.destinationThumbnailUrl ?? selectedPlaceImage;
  const localHeroImage = heroImageUrl
    ? undefined
    : findLocalTripImage(brief.destination, "review-hero");
  const nights = nightCount(brief);
  const travelers = brief.adults ?? brief.travelers;

  const renderDay = useCallback(
    ({ item, drag, isActive }: RenderItemParams<ItineraryDay>) => (
      <ScaleDecorator activeScale={1.02}>
        <View className="pb-3">
          <DayTimelineRow day={item} locale={locale} drag={drag} isActive={isActive} />
        </View>
      </ScaleDecorator>
    ),
    [locale]
  );

  const handleDragEnd = useCallback(
    ({ data, from, to }: { data: ItineraryDay[]; from: number; to: number }) => {
      if (from === to) return;
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onReorderDays(data.map((day, index) => ({ ...day, dayNumber: index + 1 })));
    },
    [onReorderDays]
  );

  const breakdown = useMemo(() => budgetBreakdown(brief, days), [brief, days]);

  const handleStart = useCallback(() => {
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onStart();
    onOpenChange(false);
  }, [onOpenChange, onStart]);

  const scrollableHeader = (
    <View className="gap-3 pb-3">
      <View className="min-h-16 flex-row items-center gap-3 pb-1 pt-2">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={tr ? "Düzenlemeye dön" : "Back to editing"}
          hitSlop={10}
          onPress={() => onOpenChange(false)}
          className="size-10 items-center justify-center rounded-full bg-surface-secondary"
        >
          <ArrowLeft size={20} color={foreground} />
        </Pressable>
        <View className="flex-1">
          <Typography.Paragraph className="text-lg font-semibold text-foreground">
            {tr ? "Gezini gözden geçir" : "Review your trip"}
          </Typography.Paragraph>
          <Typography.Paragraph className="text-sm text-muted">
            {brief.destination ?? (tr ? "Rotan" : "Your destination")} ·{" "}
            {formatDateRange(brief.startDate, brief.endDate)}
          </Typography.Paragraph>
        </View>
      </View>

      <View className="overflow-hidden rounded-2xl bg-surface-secondary">
        {heroImageUrl ? (
          <Image source={{ uri: heroImageUrl }} className="h-40 w-full" resizeMode="cover" />
        ) : localHeroImage ? (
          <View className="h-36 w-full items-center justify-center bg-accent/10 px-6">
            <Image source={localHeroImage} className="h-full w-full" resizeMode="contain" />
          </View>
        ) : (
          <View className="h-24 w-full bg-accent/15" />
        )}
        <View className="gap-2 p-4">
          <Typography.Paragraph className="text-xl font-semibold text-foreground">
            {brief.destination ?? (tr ? "Rotan" : "Your trip")}
          </Typography.Paragraph>
          <Typography.Paragraph className="text-sm text-muted">
            {formatDateRange(brief.startDate, brief.endDate)}
            {` · ${nights} ${tr ? "gece" : "nights"}`}
          </Typography.Paragraph>
          <View className="mt-1 flex-row flex-wrap gap-2">
            {travelers ? (
              <Chip size="sm" variant="soft">
                <Chip.Label>
                  {travelers} {tr ? "kişi" : "travelers"}
                </Chip.Label>
              </Chip>
            ) : null}
            {brief.budgetTotalUSD ? (
              <Chip size="sm" variant="soft">
                <Chip.Label>${brief.budgetTotalUSD}</Chip.Label>
              </Chip>
            ) : null}
            {brief.pace ? (
              <Chip size="sm" variant="soft">
                <Chip.Label>{brief.pace}</Chip.Label>
              </Chip>
            ) : null}
          </View>
        </View>
      </View>

      <SectionPicker value={tab} locale={locale} onChange={setTab} />
    </View>
  );

  const scrollableActions = (
    <View className="mt-3 gap-2 border-t pb-2 pt-4" style={{ borderTopColor: "#D1D5DB" }}>
      <Button onPress={handleStart} animation={{ scale: { value: 0.94 } }}>
        {tr ? "Bu Planı Başlat" : "Start This Trip"}
      </Button>
      <Button variant="tertiary" onPress={() => onOpenChange(false)}>
        {tr ? "Düzenlemeye Devam" : "Keep Editing"}
      </Button>
    </View>
  );

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={() => onOpenChange(false)}
    >
      <View
        className="flex-1 bg-background"
        style={{ paddingTop: Math.max(insets.top, 16), paddingBottom: insets.bottom }}
      >
        {tab === "map" || tab === "contacts" || tab === "reminders" ? (
          <ScrollView
            className="flex-1"
            contentContainerClassName="gap-3 px-5 pb-6"
            showsVerticalScrollIndicator={false}
          >
            {scrollableHeader}
            {tab === "map" ? <TripRouteMap days={days} locale={locale} /> : null}
            {tab === "contacts" ? (
              <TripContactDirectory brief={brief} days={days} locale={locale} />
            ) : null}
            {tab === "reminders" ? (
              <TripReminders
                tripId={
                  [brief.destination, brief.startDate, brief.endDate].filter(Boolean).join("|") ||
                  "trip"
                }
                activities={days.flatMap((day) =>
                  day.activities.flatMap((activity, activityIndex) =>
                    day.date && activity.time
                      ? [
                          {
                            dayNumber: day.dayNumber,
                            activityIndex,
                            date: day.date,
                            time: activity.time,
                            title: activity.title,
                          },
                        ]
                      : []
                  )
                )}
                locale={locale}
              />
            ) : null}
            {scrollableActions}
          </ScrollView>
        ) : (
          <DraggableFlatList
            style={{ flex: 1 }}
            containerStyle={{ flex: 1 }}
            data={tab === "days" ? days : []}
            keyExtractor={(day) => day.date ?? `day-${day.dayNumber}-${day.title}`}
            renderItem={renderDay}
            onDragEnd={handleDragEnd}
            activationDistance={8}
            autoscrollThreshold={72}
            autoscrollSpeed={120}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 24 }}
            ListHeaderComponent={
              <View>
                {scrollableHeader}
                {tab === "days" && days.length > 0 ? (
                  <View className="mb-3 flex-row items-center gap-2 rounded-xl bg-accent/10 px-3 py-2.5">
                    <GripVertical size={16} color={foreground} />
                    <Typography.Paragraph className="flex-1 text-sm text-muted">
                      {tr
                        ? "Tutamaca basılı tutup günü istediğin sıraya sürükle."
                        : "Press and hold the handle, then drag the day into place."}
                    </Typography.Paragraph>
                  </View>
                ) : null}
              </View>
            }
            ListEmptyComponent={
              tab === "days" ? (
                <Typography.Paragraph className="text-sm text-muted">
                  {tr ? "Gün planı henüz hazır değil." : "Day plan isn’t ready yet."}
                </Typography.Paragraph>
              ) : null
            }
            ListFooterComponent={
              <View>
                {tab === "summary" ? (
                  <View className="gap-3">
                    {brief.planningMode === "youtube" && brief.youtubeSource ? (
                      <Card variant="secondary">
                        {brief.youtubeSource.thumbnailUrl ? (
                          <Image
                            source={{ uri: brief.youtubeSource.thumbnailUrl }}
                            className="h-28 w-full rounded-t-2xl"
                            resizeMode="cover"
                          />
                        ) : null}
                        <Card.Body className="gap-2">
                          <Chip size="sm" variant="soft" color="accent">
                            <Chip.Label>{tr ? "Video rotası" : "Video route"}</Chip.Label>
                          </Chip>
                          <Card.Title numberOfLines={2}>{brief.youtubeSource.title}</Card.Title>
                          {brief.youtubeSource.channelName ? (
                            <Card.Description>{brief.youtubeSource.channelName}</Card.Description>
                          ) : null}
                          {brief.youtubeAnalysis?.summary ? (
                            <Typography.Paragraph className="text-sm text-muted" numberOfLines={4}>
                              {brief.youtubeAnalysis.summary}
                            </Typography.Paragraph>
                          ) : null}
                          {(brief.youtubeAnalysis?.warnings?.length ?? 0) > 0 ? (
                            <Typography.Paragraph className="text-xs text-danger" numberOfLines={3}>
                              {(brief.youtubeAnalysis?.warnings ?? []).join(" · ")}
                            </Typography.Paragraph>
                          ) : null}
                        </Card.Body>
                      </Card>
                    ) : null}

                    {brief.planningMode === "influencer" && brief.influencerSource ? (
                      <Card variant="secondary">
                        <Card.Body className="gap-2">
                          <Chip size="sm" variant="soft" color="accent">
                            <Chip.Label>{tr ? "Influencer rotası" : "Creator route"}</Chip.Label>
                          </Chip>
                          <Card.Title numberOfLines={2}>{brief.influencerSource.name}</Card.Title>
                          <Card.Description>
                            {brief.influencerSource.handle}
                            {brief.influencerSource.niche
                              ? ` · ${brief.influencerSource.niche}`
                              : ""}
                          </Card.Description>
                          <Typography.Paragraph className="text-sm text-muted" numberOfLines={2}>
                            {brief.influencerSource.route.map((stop) => stop.city).join(" → ")}
                          </Typography.Paragraph>
                          {brief.influencerSource.context ? (
                            <Typography.Paragraph className="text-sm text-muted" numberOfLines={4}>
                              {brief.influencerSource.context}
                            </Typography.Paragraph>
                          ) : null}
                        </Card.Body>
                      </Card>
                    ) : null}

                    {brief.chosenFlight ? (
                      <Card variant="secondary">
                        <Card.Body className="gap-2">
                          <View className="flex-row items-center justify-between">
                            <View className="flex-row items-center gap-2">
                              {brief.chosenFlight.airlineLogoUrl ? (
                                <Image
                                  source={{ uri: brief.chosenFlight.airlineLogoUrl }}
                                  className="h-6 w-10"
                                  resizeMode="contain"
                                />
                              ) : null}
                              <Card.Title>{brief.chosenFlight.airline}</Card.Title>
                            </View>
                            <Chip size="sm" variant="soft" color="success">
                              <Chip.Label>{tr ? "Seçildi" : "Selected"}</Chip.Label>
                            </Chip>
                          </View>
                          <Card.Description>
                            {formatTime(brief.chosenFlight.departureTime)}{" "}
                            {brief.chosenFlight.departureAirport} →{" "}
                            {formatTime(brief.chosenFlight.arrivalTime)}{" "}
                            {brief.chosenFlight.arrivalAirport}
                          </Card.Description>
                          <Typography.Paragraph className="font-semibold text-accent">
                            ${brief.chosenFlight.priceUSD}
                          </Typography.Paragraph>
                        </Card.Body>
                      </Card>
                    ) : null}

                    {brief.chosenHotel ? (
                      <Card variant="secondary">
                        {brief.chosenHotel.thumbnailUrl ? (
                          <Image
                            source={{ uri: brief.chosenHotel.thumbnailUrl }}
                            className="h-28 w-full rounded-t-2xl"
                            resizeMode="cover"
                          />
                        ) : null}
                        <Card.Body className="gap-2">
                          <View className="flex-row items-center justify-between gap-2">
                            <Card.Title numberOfLines={1} className="flex-1">
                              {brief.chosenHotel.name}
                            </Card.Title>
                            <Chip size="sm" variant="soft" color="success">
                              <Chip.Label>{tr ? "Seçildi" : "Selected"}</Chip.Label>
                            </Chip>
                          </View>
                          <Card.Description>
                            {[
                              brief.chosenHotel.rating ? `★ ${brief.chosenHotel.rating}` : null,
                              brief.chosenHotel.pricePerNightUSD
                                ? `$${brief.chosenHotel.pricePerNightUSD}/${tr ? "gece" : "night"} · ${nights} ${
                                    tr ? "gece" : "nights"
                                  }`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Card.Description>
                        </Card.Body>
                      </Card>
                    ) : null}

                    {!brief.chosenFlight &&
                    !brief.chosenHotel &&
                    brief.planningMode !== "youtube" &&
                    brief.planningMode !== "influencer" ? (
                      <Typography.Paragraph className="text-sm text-muted">
                        {tr
                          ? "Henüz uçuş veya otel seçilmedi — sohbette kartlardan seçebilirsin."
                          : "No flight or hotel selected yet — pick from the cards in chat."}
                      </Typography.Paragraph>
                    ) : null}
                  </View>
                ) : null}

                {tab === "budget" ? (
                  <Card variant="secondary">
                    <Card.Body className="gap-3">
                      <Card.Title>{tr ? "Bütçe özeti" : "Budget breakdown"}</Card.Title>
                      <BudgetBar
                        total={breakdown.total}
                        budget={breakdown.budget}
                        locale={locale}
                      />
                      <Card.Description>
                        {tr ? "Uçuş" : "Flight"} · ${Math.round(breakdown.flight)}
                      </Card.Description>
                      <Card.Description>
                        {tr ? "Konaklama" : "Stay"} · ${Math.round(breakdown.hotel)}
                      </Card.Description>
                      <Card.Description>
                        {tr ? "Yemek & aktiviteler" : "Food & activities"} · $
                        {Math.round(breakdown.activitiesFromDays)}
                      </Card.Description>
                      {breakdown.overBudget ? (
                        <View className="mt-1 flex-row items-start gap-2">
                          <AlertTriangle size={14} />
                          <Typography.Paragraph className="flex-1 text-xs text-danger">
                            {tr
                              ? `Bütçeyi ~$${Math.round(breakdown.total - (breakdown.budget ?? 0))} aşıyorsun — bir gün kısalt veya daha uygun otel seç.`
                              : `Over budget by ~$${Math.round(breakdown.total - (breakdown.budget ?? 0))} — trim a day or pick a cheaper stay.`}
                          </Typography.Paragraph>
                        </View>
                      ) : null}
                    </Card.Body>
                  </Card>
                ) : null}

                {scrollableActions}
              </View>
            }
          />
        )}
      </View>
    </Modal>
  );
}
