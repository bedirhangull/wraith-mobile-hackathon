import { useRouter } from "expo-router";
import { Button, Input, Typography } from "heroui-native";
import type { JSX } from "react";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { BackButton } from "@/components/back-button";

export default function SignUpScreen(): JSX.Element {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const canCreateAccount = name.trim().length > 0 && email.trim().length > 0;

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
                  returnKeyType="done"
                  value={email}
                />
              </View>
            </View>

            <Button
              isDisabled={!canCreateAccount}
              onPress={() => router.push("/onboarding")}
              size="lg"
            >
              Create account
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
