import { useRouter } from "expo-router";
import { Button, Input, Typography } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "@/components/back-button";

export default function AuthScreen(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const hasEmail = email.trim().length > 0;

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
                  returnKeyType="done"
                  value={email}
                />
              </View>
            </View>

            <Button isDisabled={!hasEmail} onPress={() => router.push("/onboarding")} size="lg">
              Continue with email
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
