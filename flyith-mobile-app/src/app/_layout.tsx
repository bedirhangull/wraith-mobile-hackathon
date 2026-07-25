import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import { HeroUINativeProvider } from "heroui-native";
import { type JSX, useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";

import { prepareModelSafe } from "@/features/travel-chat/utils/safeDataDetector";

import "../global.css";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export default function RootLayout(): JSX.Element {
  useEffect(() => {
    // Android ML Kit models (~5.6MB each); no-op on iOS / when native module is missing.
    void Promise.all([prepareModelSafe("tr"), prepareModelSafe("en")]);
    if (process.env.EXPO_OS === "android") {
      void Notifications.setNotificationChannelAsync("trip-reminders", {
        name: "Gezi hatırlatmaları",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 150, 250],
      });
    }
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <KeyboardProvider>
        <HeroUINativeProvider
          config={{
            toast: {
              defaultProps: {
                placement: "top",
                variant: "success",
              },
            },
          }}
        >
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen
              name="generating-plan"
              options={{ animation: "fade", gestureEnabled: false }}
            />
          </Stack>
        </HeroUINativeProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}
