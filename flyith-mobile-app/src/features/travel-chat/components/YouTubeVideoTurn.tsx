import { Button, Card, Typography } from "heroui-native";
import { type JSX, useCallback, useState } from "react";
import { Image, Linking, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import YoutubePlayer from "react-native-youtube-iframe";

type Locale = "tr" | "en";

interface YouTubeVideoTurnProps {
  videoId: string;
  url: string;
  title: string;
  thumbnailUrl?: string;
  channelName?: string;
  placeNames?: string[];
  summary?: string;
  locale?: Locale;
}

export function YouTubeVideoTurn({
  videoId,
  url,
  title,
  thumbnailUrl,
  channelName,
  placeNames,
  summary,
  locale = "en",
}: YouTubeVideoTurnProps): JSX.Element {
  const tr = locale === "tr";
  const [playerFailed, setPlayerFailed] = useState(false);

  const openOnYouTube = useCallback(() => {
    void Linking.openURL(url);
  }, [url]);

  const placesLabel =
    placeNames && placeNames.length > 0
      ? tr
        ? `Videodan: ${placeNames.slice(0, 6).join(" · ")}`
        : `From the video: ${placeNames.slice(0, 6).join(" · ")}`
      : null;

  return (
    <Animated.View entering={FadeIn.duration(220)} className="w-full px-4">
      <Card className="overflow-hidden">
        <View className="overflow-hidden rounded-t-2xl bg-black">
          {playerFailed ? (
            <View className="aspect-video items-center justify-center bg-default">
              {thumbnailUrl ? (
                <Image source={{ uri: thumbnailUrl }} className="h-full w-full" resizeMode="cover" />
              ) : (
                <Typography.Paragraph className="text-muted">
                  {tr ? "Önizleme yok" : "No preview"}
                </Typography.Paragraph>
              )}
            </View>
          ) : (
            <YoutubePlayer
              height={200}
              videoId={videoId}
              webViewProps={{
                allowsInlineMediaPlayback: true,
                mediaPlaybackRequiresUserAction: false,
              }}
              onError={() => setPlayerFailed(true)}
            />
          )}
        </View>
        <Card.Body className="gap-2">
          <Card.Title numberOfLines={2}>{title}</Card.Title>
          {channelName ? <Card.Description>{channelName}</Card.Description> : null}
          {summary ? (
            <Typography.Paragraph className="text-sm text-muted" numberOfLines={3}>
              {summary}
            </Typography.Paragraph>
          ) : null}
          {placesLabel ? (
            <Typography.Paragraph className="text-sm text-accent" numberOfLines={3}>
              {placesLabel}
            </Typography.Paragraph>
          ) : null}
          {playerFailed ? (
            <Button size="sm" variant="secondary" onPress={openOnYouTube}>
              {tr ? "YouTube’da aç" : "Open on YouTube"}
            </Button>
          ) : null}
        </Card.Body>
      </Card>
    </Animated.View>
  );
}
