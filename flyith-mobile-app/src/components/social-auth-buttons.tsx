import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Button, useThemeColor, useToast } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";

import { GoogleSignInNotConfiguredError, signInWithGoogle } from "@/features/auth/googleSignIn";

interface SocialAuthButtonsProps {
  action: "Continue" | "Sign up";
}

export function SocialAuthButtons({ action }: SocialAuthButtonsProps): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const defaultForeground = useThemeColor("default-foreground");

  async function handleGooglePress(): Promise<void> {
    setIsGoogleLoading(true);
    try {
      const result = await signInWithGoogle();
      if (result) {
        router.replace("/onboarding");
      }
    } catch (error) {
      const isNotConfigured = error instanceof GoogleSignInNotConfiguredError;
      toast.show({
        variant: "danger",
        label: isNotConfigured ? "Google sign-in not set up yet" : "Google sign-in failed",
        description: isNotConfigured
          ? "Ask an admin to finish the Google Cloud Console setup."
          : error instanceof Error
            ? error.message
            : "Please try again.",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  }

  return (
    <View className="gap-3">
      <Button isDisabled={isGoogleLoading} onPress={handleGooglePress} size="lg" variant="outline">
        <Ionicons color={defaultForeground} name="logo-google" size={20} />
        <Button.Label>
          {isGoogleLoading ? "Signing in…" : `${action} with Google`}
        </Button.Label>
      </Button>
    </View>
  );
}
