import { Stack } from "expo-router";
import * as Notifications from "expo-notifications";
import * as SplashScreen from "expo-splash-screen";
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

// Keep the native splash up until heavy sync init (ML Kit models, notification
// channel) is done — index.tsx owns the actual routing decision, this just
// signals "the JS shell is safe to reveal".
void SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout(): JSX.Element {
  useEffect(() => {
    let cancelled = false;

    async function bootstrap(): Promise<void> {
      await Promise.all([prepareModelSafe("tr"), prepareModelSafe("en")]);
      if (process.env.EXPO_OS === "android" && !cancelled) {
        await Notifications.setNotificationChannelAsync("trip-reminders", {
          name: "Gezi hatırlatmaları",
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 150, 250],
        });
      }
      // Splash is hidden by index.tsx once it knows where to route —
      // hiding it here would reveal index.tsx before that decision is ready.
    }

    void bootstrap();
    return () => {
      cancelled = true;
    };
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
