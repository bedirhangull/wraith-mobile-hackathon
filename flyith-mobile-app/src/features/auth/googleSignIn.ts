import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";
import { Platform } from "react-native";

import { env } from "@/config/env";
import { supabase } from "@/lib/supabase";

import type { AuthResult } from "./api";

let isConfigured = false;

function isReadyToConfigureOnPlatform(): boolean {
  if (!env.googleWebClientId) return false;
  if (Platform.OS === "ios" && !env.googleIosClientId) return false;
  return true;
}

function ensureConfigured(): void {
  if (isConfigured) return;
  GoogleSignin.configure({
    webClientId: env.googleWebClientId,
    ...(Platform.OS === "ios" ? { iosClientId: env.googleIosClientId } : {}),
  });
  isConfigured = true;
}

/**
 * Thrown when required Google Sign-In credentials are missing.
 * On iOS both EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID are required.
 * On Android only EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is required.
 */
export class GoogleSignInNotConfiguredError extends Error {
  constructor() {
    const hint =
      Platform.OS === "ios"
        ? "missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID or EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID"
        : "missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID";
    super(`Google Sign-In is not configured yet (${hint}).`);
    this.name = "GoogleSignInNotConfiguredError";
  }
}

export async function signInWithGoogle(): Promise<AuthResult | null> {
  if (!isReadyToConfigureOnPlatform()) {
    throw new GoogleSignInNotConfiguredError();
  }
  ensureConfigured();

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();
  if (!isSuccessResponse(response)) {
    return null; // user cancelled
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error("Google Sign-In did not return an idToken.");
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: "google",
    token: idToken,
  });
  if (error) throw error;
  return { user: data.user, session: data.session };
}
