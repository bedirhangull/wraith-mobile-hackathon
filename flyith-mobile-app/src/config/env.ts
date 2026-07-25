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
};
