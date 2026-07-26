function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.example to .env and fill in real values.`
    );
  }
  return value;
}

// Metro statically inlines `process.env.EXPO_PUBLIC_*` at build time — it only
// recognizes literal dot-access, so each var is read explicitly rather than
// through a dynamic/bracket lookup (which would silently stay undefined).
export const env = {
  geminiApiKey: requireEnv("EXPO_PUBLIC_GEMINI_API_KEY", process.env.EXPO_PUBLIC_GEMINI_API_KEY),
  serpApiKey: requireEnv("EXPO_PUBLIC_SERPAPI_API_KEY", process.env.EXPO_PUBLIC_SERPAPI_API_KEY),
  supabaseUrl: requireEnv("EXPO_PUBLIC_SUPABASE_URL", process.env.EXPO_PUBLIC_SUPABASE_URL),
  supabaseAnonKey: requireEnv(
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  ),
  // Not required — Google Sign-In is configured manually via Google Cloud Console
  // and stays disabled client-side until this is set.
  googleWebClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "",
  // iOS OAuth client ID (CLIENT_ID from GoogleService-Info.plist). Optional on Android.
  googleIosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "",
  // Public RevenueCat iOS SDK key (appl_…). Required for paywalls on iOS.
  revenueCatIosKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "",
  // Set to "true" to bypass RevenueCat entirely and use a device-local mock subscription.
  // Never set in production builds.
  mockPremium: process.env.EXPO_PUBLIC_MOCK_PREMIUM === "true",
};
