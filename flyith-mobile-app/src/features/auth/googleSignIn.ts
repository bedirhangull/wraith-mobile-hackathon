import { GoogleSignin, isSuccessResponse } from "@react-native-google-signin/google-signin";

import { env } from "@/config/env";
import { supabase } from "@/lib/supabase";

import type { AuthResult } from "./api";

let isConfigured = false;

function ensureConfigured(): void {
  if (isConfigured) return;
  GoogleSignin.configure({ webClientId: env.googleWebClientId });
  isConfigured = true;
}

/** Thrown when EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID hasn't been set up yet (manual Google Cloud Console step). */
export class GoogleSignInNotConfiguredError extends Error {
  constructor() {
    super("Google Sign-In is not configured yet (missing EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID).");
    this.name = "GoogleSignInNotConfiguredError";
  }
}

export async function signInWithGoogle(): Promise<AuthResult | null> {
  if (!env.googleWebClientId) {
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
