import { useRouter } from "expo-router";
import { Button, Input, Typography, useToast } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "@/components/back-button";
import { signUpWithEmail } from "@/features/auth/api";

export default function SignUpScreen(): JSX.Element {
  const router = useRouter();
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const canCreateAccount =
    name.trim().length > 0 && email.trim().length > 0 && password.length >= 6 && !isSubmitting;

  async function handleCreateAccount(): Promise<void> {
    setIsSubmitting(true);
    try {
      await signUpWithEmail({ email: email.trim(), password, fullName: name.trim() });
      router.replace("/onboarding");
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Couldn't create account",
        description: error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ backgroundColor: "#FFFFFF", flex: 1 }}>
      <View className="flex-1 justify-between gap-6 bg-white px-6 pb-6 pt-1">
        <View className="gap-6">
          <View className="-ml-2 self-start">
            <BackButton onPress={() => router.back()} />
          </View>

          <View className="gap-3">
            <Typography type="h1">Create your travel profile.</Typography>
            <Typography color="muted">
              Tell us where to save your personalized trips and recommendations.
            </Typography>
          </View>

          <View className="gap-4">
            <View className="gap-2">
              <Typography type="body-sm" weight="medium">
                Full name
              </Typography>
              <View className="h-12">
                <Input
                  autoCapitalize="words"
                  autoComplete="name"
                  className="flex-1"
                  onChangeText={setName}
                  placeholder="Your name"
                  returnKeyType="next"
                  value={name}
                />
              </View>
            </View>

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
                  autoComplete="password-new"
                  autoCorrect={false}
                  className="flex-1"
                  onChangeText={setPassword}
                  placeholder="At least 6 characters"
                  returnKeyType="done"
                  secureTextEntry
                  value={password}
                />
              </View>
            </View>

            <Button isDisabled={!canCreateAccount} onPress={handleCreateAccount} size="lg">
              {isSubmitting ? "Creating account…" : "Create account"}
            </Button>
          </View>

          <Button onPress={() => router.replace("/auth")} size="sm" variant="ghost">
            Already have an account? Sign in
          </Button>
        </View>
      </View>
    </SafeAreaView>
  );
}
