import { Ionicons } from "@expo/vector-icons";
import { Button, useThemeColor } from "heroui-native";
import type { JSX } from "react";

interface BackButtonProps {
  onPress: () => void;
}

export function BackButton({ onPress }: BackButtonProps): JSX.Element {
  const foreground = useThemeColor("default-foreground");

  return (
    <Button accessibilityLabel="Go back" isIconOnly onPress={onPress} size="sm" variant="ghost">
      <Ionicons color={foreground} name="chevron-back" size={24} />
    </Button>
  );
}
