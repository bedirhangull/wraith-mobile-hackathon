import { Skeleton, Typography } from "heroui-native";
import { type JSX, useEffect, useMemo, useState } from "react";
import { Image, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";

import { generateStyledImage } from "../services/geminiClient";
import { findLocalTripImage } from "../utils/localTripImages";

const IMAGE_SIZE = 168;

export function ImageTurn({
  prompt,
  caption,
  destination,
}: {
  prompt: string;
  caption?: string;
  destination?: string;
}): JSX.Element | null {
  const localSource = useMemo(() => findLocalTripImage(destination, prompt), [destination, prompt]);
  const [base64Image, setBase64Image] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (localSource) return;
    let isMounted = true;
    generateStyledImage(prompt)
      .then((data) => {
        if (isMounted) setBase64Image(data);
      })
      .catch(() => {
        if (isMounted) setFailed(true);
      });
    return () => {
      isMounted = false;
    };
  }, [prompt, localSource]);

  if (failed && !localSource) return null;

  return (
    <Animated.View entering={FadeIn.duration(220)} className="w-full items-center gap-2 px-4">
      <View
        className="items-center justify-center overflow-hidden rounded-2xl bg-white"
        style={{ width: IMAGE_SIZE, height: IMAGE_SIZE }}
      >
        {localSource ? (
          <Image source={localSource} className="h-full w-full" resizeMode="contain" />
        ) : base64Image ? (
          <Image
            source={{ uri: `data:image/png;base64,${base64Image}` }}
            className="h-full w-full"
            resizeMode="contain"
          />
        ) : (
          <Skeleton className="h-full w-full" />
        )}
      </View>
      {caption ? (
        <Typography.Paragraph className="text-center text-sm text-muted">
          {caption}
        </Typography.Paragraph>
      ) : null}
    </Animated.View>
  );
}
