import { useRouter } from "expo-router";
import { useThemeColor } from "heroui-native";
import { User, Users } from "lucide-react-native";
import { type JSX, useState } from "react";
import { Image, Pressable, View } from "react-native";

import { setUserProfile } from "@/features/onboarding/profile";
import type { Influencer } from "@/data/influencers";
import { InfluencerPickerSheet } from "./InfluencerPickerSheet";

type Locale = "tr" | "en";

interface ChatHeaderProps {
  locale?: Locale;
  /** Return false to block profile update / plan start (e.g. paywall gate). */
  onSelectInfluencer?: (influencer: Influencer) => boolean | void;
}

export function ChatHeader({
  locale = "en",
  onSelectInfluencer,
}: ChatHeaderProps): JSX.Element {
  const router = useRouter();
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [selectedInfluencer, setSelectedInfluencer] = useState<Influencer | null>(null);
  const [mutedColor, foregroundColor] = useThemeColor(["muted", "foreground"]);

  const handleSelect = (influencer: Influencer) => {
    const allowed = onSelectInfluencer?.(influencer);
    if (allowed === false) return;
    setSelectedInfluencer(influencer);
    setUserProfile({
      favoriteInfluencer: influencer.name,
      favoriteInfluencerId: influencer.id,
      favoriteDestination: influencer.travelPlan[0]?.city,
      influencerDestinations: influencer.travelPlan.map((plan) => plan.city),
    });
  };

  return (
    <View className="flex-row items-center justify-end gap-3 px-4 py-2">
      <Pressable
        accessibilityLabel={locale === "tr" ? "Profil" : "Profile"}
        accessibilityRole="button"
        className="size-10 items-center justify-center overflow-hidden rounded-full"
        onPress={() => router.push("/profile")}
        style={{ backgroundColor: `${mutedColor}26` }}
      >
        <User color={foregroundColor} size={20} />
      </Pressable>

      <Pressable
        accessibilityLabel={
          locale === "tr" ? "Influencer / plan seç" : "Pick influencer / plan"
        }
        accessibilityRole="button"
        className="size-10 items-center justify-center overflow-hidden rounded-full"
        onPress={() => setIsPickerOpen(true)}
        style={{ backgroundColor: `${mutedColor}26` }}
      >
        {selectedInfluencer ? (
          <Image
            accessibilityLabel={`${selectedInfluencer.name} memoji`}
            resizeMode="cover"
            source={selectedInfluencer.image}
            style={{ height: "100%", width: "100%" }}
          />
        ) : (
          <Users color={foregroundColor} size={20} />
        )}
      </Pressable>

      <InfluencerPickerSheet
        isOpen={isPickerOpen}
        locale={locale}
        onOpenChange={setIsPickerOpen}
        onSelect={handleSelect}
        selectedInfluencerId={selectedInfluencer?.id}
      />
    </View>
  );
}
