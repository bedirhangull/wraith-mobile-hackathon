import { useRouter } from "expo-router";
import { Button, Input, Typography, useToast } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "@/components/back-button";
import { signInWithEmail } from "@/features/auth/api";

export default function AuthScreen(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canSubmit = email.trim().length > 0 && password.length > 0 && !isSubmitting;

  async function handleContinue(): Promise<void> {
    setIsSubmitting(true);
    try {
      await signInWithEmail({ email: email.trim(), password });
      router.replace("/onboarding");
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Sign in failed",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ backgroundColor: "#FFFFFF", flex: 1 }}>
      <View className="flex-1 justify-between gap-8 bg-white px-6 pb-6 pt-1">
        <View className="gap-8">
          <View className="-ml-2 self-start">
            <BackButton onPress={() => router.back()} />
          </View>

          <View className="gap-3">
            <Typography type="h1">Let&apos;s get you ready to explore.</Typography>
            <Typography color="muted">
              Sign in to keep every trip idea and recommendation in one place.
            </Typography>
          </View>

          <View className="gap-4">
            <View className="gap-2">
              <Typography type="body-sm" weight="medium">
                Email address
              </Typography>
              <View className="h-12">
                <Input
                  autoCapitalize="none"
                  autoComplete="email"
                  autoCorrect={false}
                  className="flex-1"
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  placeholder="you@example.com"
                  returnKeyType="next"
                  value={email}
                />
              </View>
            </View>

            <View className="gap-2">
              <Typography type="body-sm" weight="medium">
                Password
              </Typography>
              <View className="h-12">
                <Input
                  autoCapitalize="none"
                  autoComplete="password"
                  autoCorrect={false}
                  className="flex-1"
                  onChangeText={setPassword}
                  placeholder="••••••••"
                  returnKeyType="done"
                  secureTextEntry
                  value={password}
                />
              </View>
            </View>

            <Button isDisabled={!canSubmit} onPress={handleContinue} size="lg">
              {isSubmitting ? "Signing in…" : "Continue with email"}
            </Button>
          </View>

          <View className="gap-1">
            <Button onPress={() => router.push("/sign-up")} size="sm" variant="ghost">
              Create an account
            </Button>
            <Typography align="center" color="muted" type="body-xs">
              By continuing, you agree to our Terms and Privacy Policy.
            </Typography>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}
