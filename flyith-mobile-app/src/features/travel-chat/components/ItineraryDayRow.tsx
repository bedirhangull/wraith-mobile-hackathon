import { Card, Typography } from "heroui-native";
import type { JSX } from "react";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";

import type { ItineraryActivity, ItineraryDay } from "../types";

const ROW_HEIGHT = 120;

const KIND_EMOJI: Record<ItineraryActivity["kind"], string> = {
  food: "🍽",
  sight: "🏛",
  experience: "✨",
  transit: "🚇",
  rest: "☕",
  shopping: "🛍",
  event: "🎟",
};

interface ItineraryDayRowProps {
  day: ItineraryDay;
  index: number;
  count: number;
  onReorder: (fromIndex: number, toIndex: number) => void;
}

function activityLine(activity: ItineraryActivity): string {
  const time = activity.time ? `${activity.time} · ` : "";
  const place = activity.placeName ? ` @ ${activity.placeName}` : "";
  const cost = activity.estimatedCostUSD != null ? ` · ~$${activity.estimatedCostUSD}` : "";
  return `${KIND_EMOJI[activity.kind]} ${time}${activity.title}${place}${cost}`;
}

export function ItineraryDayRow({
  day,
  index,
  count,
  onReorder,
}: ItineraryDayRowProps): JSX.Element {
  const translateY = useSharedValue(0);
  const isDragging = useSharedValue(false);

  const pan = Gesture.Pan()
    .activateAfterLongPress(200)
    .onBegin(() => {
      isDragging.value = true;
    })
    .onUpdate((event) => {
      translateY.value = event.translationY;
    })
    .onEnd(() => {
      const deltaIndex = Math.round(translateY.value / ROW_HEIGHT);
      const targetIndex = Math.min(Math.max(index + deltaIndex, 0), count - 1);
      if (targetIndex !== index) {
        runOnJS(onReorder)(index, targetIndex);
      }
      translateY.value = withSpring(0, { duration: 300, dampingRatio: 0.8 });
      isDragging.value = false;
    });

  const style = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: withSpring(isDragging.value ? 1.02 : 1, { duration: 250, dampingRatio: 0.8 }) },
    ],
    zIndex: isDragging.value ? 10 : 0,
    shadowOpacity: withSpring(isDragging.value ? 0.15 : 0, { duration: 250, dampingRatio: 0.8 }),
  }));

  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={style}>
        <Card variant="secondary" className="mb-2 flex-row gap-3">
          <Typography.Paragraph className="font-semibold text-accent">
            Day {day.dayNumber}
          </Typography.Paragraph>
          <Card.Body>
            <Card.Title>{day.title}</Card.Title>
            {day.summary ? <Card.Description>{day.summary}</Card.Description> : null}
            {day.activities.slice(0, 4).map((activity, i) => (
              <Card.Description key={i}>{activityLine(activity)}</Card.Description>
            ))}
            {day.estimatedDayCostUSD != null ? (
              <Typography.Paragraph className="mt-1 text-xs text-muted">
                Day estimate ~${day.estimatedDayCostUSD}
              </Typography.Paragraph>
            ) : null}
          </Card.Body>
        </Card>
      </Animated.View>
    </GestureDetector>
  );
}
