import { Card, Typography } from "heroui-native";
import { type JSX } from "react";
import { Image, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { influencerById } from "@/data/influencers";

type Locale = "tr" | "en";

interface InfluencerRouteTurnProps {
  influencerId: string;
  name: string;
  handle: string;
  niche?: string;
  context?: string;
  routeCities: string[];
  placeNames: string[];
  summary?: string;
  locale?: Locale;
}

export function InfluencerRouteTurn({
  influencerId,
  name,
  handle,
  niche,
  context,
  routeCities,
  placeNames,
  summary,
  locale = "en",
}: InfluencerRouteTurnProps): JSX.Element {
  const tr = locale === "tr";
  const influencer = influencerById(influencerId);
  const routeLabel =
    routeCities.length > 0
      ? routeCities.join(" → ")
      : tr
        ? "Rota hazırlanıyor"
        : "Route loading";
  const placesLabel =
    placeNames.length > 0
      ? tr
        ? `Rotadan: ${placeNames.slice(0, 6).join(" · ")}`
        : `From the route: ${placeNames.slice(0, 6).join(" · ")}`
      : null;
  const body = summary ?? context;

  return (
    <Animated.View entering={FadeIn.duration(220)} className="w-full px-4">
      <Card className="overflow-hidden">
        <Card.Body className="gap-3">
          <View className="flex-row items-center gap-3">
            <View className="h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white">
              {influencer?.image ? (
                <Image
                  accessibilityLabel={`${name} memoji`}
                  resizeMode="contain"
                  source={influencer.image}
                  style={{ height: 52, width: 52 }}
                />
              ) : (
                <Typography.Paragraph className="text-lg">✈</Typography.Paragraph>
              )}
            </View>
            <View className="flex-1 gap-0.5">
              <Card.Title numberOfLines={1}>{name}</Card.Title>
              <Card.Description numberOfLines={1}>
                {handle}
                {niche ? ` · ${niche}` : ""}
              </Card.Description>
            </View>
          </View>

          <Typography.Paragraph className="text-sm font-medium text-foreground">
            {routeLabel}
          </Typography.Paragraph>

          {body ? (
            <Typography.Paragraph className="text-sm text-muted" numberOfLines={4}>
              {body}
            </Typography.Paragraph>
          ) : null}

          {placesLabel ? (
            <Typography.Paragraph className="text-sm text-accent" numberOfLines={3}>
              {placesLabel}
            </Typography.Paragraph>
          ) : null}
        </Card.Body>
      </Card>
    </Animated.View>
  );
}
