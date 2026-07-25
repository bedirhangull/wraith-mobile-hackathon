import { Ionicons } from "@expo/vector-icons";
import { Button, useThemeColor } from "heroui-native";
import type { JSX } from "react";
import { View } from "react-native";

interface SocialAuthButtonsProps {
  action: "Continue" | "Sign up";
}

export function SocialAuthButtons({ action }: SocialAuthButtonsProps): JSX.Element {
  const [secondaryForeground, defaultForeground] = useThemeColor([
    "accent-soft-foreground",
    "default-foreground",
  ]);

  return (
    <View className="gap-3">
      <Button size="lg" variant="secondary">
        <Ionicons color={secondaryForeground} name="logo-apple" size={20} />
        <Button.Label>{action} with Apple</Button.Label>
      </Button>
      <Button size="lg" variant="outline">
        <Ionicons color={defaultForeground} name="logo-google" size={20} />
        <Button.Label>{action} with Google</Button.Label>
      </Button>
    </View>
  );
}
