import { Avatar, Chip, Typography } from "heroui-native";
import type { JSX } from "react";
import { Linking, Pressable, View } from "react-native";

import type { ReviewItem } from "../types";

type Locale = "tr" | "en";

function ReviewRow({ review, locale }: { review: ReviewItem; locale: Locale }): JSX.Element {
  const tr = locale === "tr";
  return (
    <View className="flex-row gap-3">
      <Pressable
        onPress={() => review.user.profileUrl && void Linking.openURL(review.user.profileUrl)}
      >
        <Avatar size="sm">
          {review.user.avatarUrl ? <Avatar.Image source={{ uri: review.user.avatarUrl }} /> : null}
          <Avatar.Fallback>{review.user.name.slice(0, 1).toUpperCase()}</Avatar.Fallback>
        </Avatar>
      </Pressable>
      <View className="flex-1 gap-1">
        <View className="flex-row flex-wrap items-center gap-2">
          <Typography.Paragraph className="font-semibold text-foreground">
            {review.user.name}
          </Typography.Paragraph>
          {review.user.isLocalGuide ? (
            <Chip size="sm" variant="soft">
              <Chip.Label>{tr ? "Yerel rehber" : "Local Guide"}</Chip.Label>
            </Chip>
          ) : null}
        </View>
        <Typography.Paragraph className="text-sm text-muted">
          {review.rating ? `★ ${review.rating}` : ""}
          {review.date ? ` · ${review.date}` : ""}
        </Typography.Paragraph>
        {review.snippet ? (
          <Typography.Paragraph className="text-sm text-foreground" numberOfLines={4}>
            {review.snippet}
          </Typography.Paragraph>
        ) : null}
      </View>
    </View>
  );
}

export function ReviewList({
  reviews,
  locale = "en",
}: {
  reviews: ReviewItem[];
  locale?: Locale;
}): JSX.Element {
  const tr = locale === "tr";
  return (
    <View className="gap-4 px-4">
      {reviews.length === 0 ? (
        <Typography.Paragraph className="text-muted">
          {tr ? "Henüz yorum yok." : "No reviews yet."}
        </Typography.Paragraph>
      ) : (
        reviews.map((review) => <ReviewRow key={review.id} review={review} locale={locale} />)
      )}
    </View>
  );
}
