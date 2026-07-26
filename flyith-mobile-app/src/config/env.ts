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
};
