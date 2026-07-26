import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { Button, ListGroup, Separator, Typography, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BackButton } from "@/components/back-button";
import { useRequireSession } from "@/features/auth/useRequireSession";
import { usePremium } from "@/features/subscription/usePremium";
import {
  hasFreeNormalChatQuota,
  listConversations,
  type TripPlanSummary,
} from "@/features/travel-chat/services/persistence";
import type { PlanningMode } from "@/features/travel-chat/types";

function modeLabel(mode: PlanningMode): string {
  switch (mode) {
    case "youtube":
      return "YouTube";
    case "influencer":
      return "Influencer";
    default:
      return "Chat";
  }
}

function formatUpdatedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function tripSubtitle(trip: TripPlanSummary): string {
  const parts: string[] = [modeLabel(trip.planningMode)];
  if (trip.startDate && trip.endDate) {
    parts.push(`${trip.startDate} → ${trip.endDate}`);
  } else if (trip.destination) {
    parts.push(trip.destination);
  }
  if (trip.status === "confirmed") parts.push("Confirmed");
  const updated = formatUpdatedAt(trip.updatedAt);
  if (updated) parts.push(updated);
  return parts.join(" · ");
}

export default function PastTripsScreen(): JSX.Element {
  useRequireSession();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const accentColor = useThemeColor("accent");
  const mutedColor = useThemeColor("muted");
  const { isPremium, isLoading: isPremiumLoading } = usePremium();
  const [trips, setTrips] = useState<TripPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingPlan, setIsStartingPlan] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setIsLoading(true);
      void listConversations().then((rows) => {
        if (cancelled) return;
        setTrips(rows);
        setIsLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const startNewPlan = useCallback(async () => {
    if (isPremiumLoading || isStartingPlan) return;
    setIsStartingPlan(true);
    try {
      if (!isPremium) {
        const hasQuota = await hasFreeNormalChatQuota();
        if (!hasQuota) {
          router.push("/paywall-2");
          return;
        }
      }
      router.push("/chat");
    } finally {
      setIsStartingPlan(false);
    }
  }, [isPremium, isPremiumLoading, isStartingPlan, router]);

  return (
    <View className="flex-1 bg-white">
      <ScrollView
        contentContainerClassName="gap-6 px-5 pb-10"
        contentContainerStyle={{ paddingTop: insets.top + 16 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="flex-row items-center justify-between">
          <BackButton onPress={() => router.back()} />
          <Button
            isDisabled={isPremiumLoading || isStartingPlan}
            onPress={() => {
              void startNewPlan();
            }}
            size="sm"
            variant="secondary"
          >
            New plan
          </Button>
        </View>

        <View className="gap-1">
          <Typography type="h3">Past Trips</Typography>
          <Typography color="muted" type="body-sm">
            Resume any travel chat — YouTube, influencer, or freeform.
          </Typography>
        </View>

        {isLoading ? (
          <View className="items-center py-16">
            <ActivityIndicator color={accentColor} />
          </View>
        ) : trips.length === 0 ? (
          <View className="items-center gap-3 py-16">
            <Ionicons color={mutedColor} name="map-outline" size={36} />
            <Typography className="text-center" color="muted" type="body-sm">
              No saved trips yet. Start a plan and it will show up here.
            </Typography>
            <Button
              isDisabled={isPremiumLoading || isStartingPlan}
              onPress={() => {
                void startNewPlan();
              }}
              size="sm"
            >
              Start planning
            </Button>
          </View>
        ) : (
          <ListGroup>
            {trips.map((trip, index) => (
              <View key={trip.id}>
                {index > 0 ? <Separator className="mx-4" /> : null}
                <ListGroup.Item
                  accessibilityRole="button"
                  onPress={() => router.push(`/chat?id=${trip.id}`)}
                >
                  <ListGroup.ItemPrefix>
                    <Ionicons
                      color={accentColor}
                      name={
                        trip.planningMode === "youtube"
                          ? "logo-youtube"
                          : trip.planningMode === "influencer"
                            ? "people-outline"
                            : "chatbubble-ellipses-outline"
                      }
                      size={22}
                    />
                  </ListGroup.ItemPrefix>
                  <ListGroup.ItemContent>
                    <ListGroup.ItemTitle numberOfLines={1}>{trip.title}</ListGroup.ItemTitle>
                    <ListGroup.ItemDescription numberOfLines={1}>
                      {tripSubtitle(trip)}
                    </ListGroup.ItemDescription>
                  </ListGroup.ItemContent>
                  <ListGroup.ItemSuffix />
                </ListGroup.Item>
              </View>
            ))}
          </ListGroup>
        )}
      </ScrollView>
    </View>
  );
}
