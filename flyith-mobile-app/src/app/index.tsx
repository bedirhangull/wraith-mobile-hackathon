import { useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import type { JSX } from "react";
import { useEffect } from "react";

import { resolveLaunchState } from "@/features/auth/session";

// Small brand-beat floor so a near-instant resolveLaunchState() (e.g. cached
// session) doesn't hide the native splash after a single frame.
const MIN_SPLASH_DURATION_MS = 400;

export default function RootIndexScreen(): JSX.Element | null {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const minDuration = new Promise<void>((resolve) => setTimeout(resolve, MIN_SPLASH_DURATION_MS));

    Promise.all([resolveLaunchState(), minDuration]).then(async ([launchState]) => {
      if (cancelled) return;
      await SplashScreen.hideAsync();
      if (!launchState.session) {
        router.replace("/welcome");
      } else if (!launchState.onboardingCompleted) {
        router.replace("/onboarding");
      } else {
        router.replace("/chat");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [router]);

  // Native splash (app.json's expo-splash-screen config) stays visible the
  // whole time — nothing to render here, rendering anything would be the
  // "second splash" this screen exists to avoid.
  return null;
}
