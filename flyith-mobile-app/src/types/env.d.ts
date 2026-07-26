declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_GEMINI_API_KEY: string;
    readonly EXPO_PUBLIC_SERPAPI_API_KEY: string;
    readonly EXPO_PUBLIC_SUPABASE_URL: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
    readonly EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: string | undefined;
  }
}
