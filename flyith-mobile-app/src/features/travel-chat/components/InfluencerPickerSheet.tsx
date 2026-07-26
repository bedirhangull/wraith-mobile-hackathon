import { BottomSheetScrollView } from "@gorhom/bottom-sheet";
import { BottomSheet, Card, Surface, Typography, useThemeColor } from "heroui-native";
import { Ionicons } from "@expo/vector-icons";
import type { JSX } from "react";
import { Image, Pressable, View } from "react-native";

import { influencers, type Influencer } from "@/data/influencers";

type Locale = "tr" | "en";

interface InfluencerPickerSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  locale?: Locale;
  selectedInfluencerId?: string;
  onSelect: (influencer: Influencer) => void;
}

const COPY = {
  tr: { title: "Bir influencer seç" },
  en: { title: "Choose an influencer" },
} as const;

interface InfluencerRowProps {
  influencer: Influencer;
  isSelected: boolean;
  onPress: () => void;
}

function InfluencerRow({ influencer, isSelected, onPress }: InfluencerRowProps): JSX.Element {
  const accentColor = useThemeColor("accent");

  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <Card variant={isSelected ? "secondary" : "default"}>
        <Card.Body className="flex-row items-center gap-3">
          <Surface
            className="h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-white p-0"
            variant="default"
          >
            <Image
              accessibilityLabel={`${influencer.name} memoji`}
              resizeMode="contain"
              source={influencer.image}
              style={{ height: 44, width: 44 }}
            />
          </Surface>

          <View className="flex-1 gap-0.5">
            <Card.Title>{influencer.name}</Card.Title>
            <Card.Description>{influencer.handle}</Card.Description>
          </View>

          {isSelected ? (
            <Ionicons
              accessibilityLabel="Selected"
              color={accentColor}
              name="checkmark-circle"
              size={22}
            />
          ) : null}
        </Card.Body>
      </Card>
    </Pressable>
  );
}

export function InfluencerPickerSheet({
  isOpen,
  onOpenChange,
  locale = "en",
  selectedInfluencerId,
  onSelect,
}: InfluencerPickerSheetProps): JSX.Element {
  const copy = COPY[locale];

  return (
    <BottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          snapPoints={["70%", "94%"]}
          enableDynamicSizing={false}
          contentContainerClassName="h-full"
        >
          <BottomSheet.Close />
          <BottomSheet.Title>{copy.title}</BottomSheet.Title>

          <BottomSheetScrollView
            contentContainerStyle={{ paddingBottom: 24, paddingTop: 12, gap: 10 }}
          >
            {influencers.map((influencer) => (
              <InfluencerRow
                influencer={influencer}
                isSelected={influencer.id === selectedInfluencerId}
                key={influencer.id}
                onPress={() => {
                  onSelect(influencer);
                  onOpenChange(false);
                }}
              />
            ))}
          </BottomSheetScrollView>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}
