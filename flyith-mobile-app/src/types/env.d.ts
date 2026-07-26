declare namespace NodeJS {
  interface ProcessEnv {
    readonly EXPO_PUBLIC_GEMINI_API_KEY: string;
    readonly EXPO_PUBLIC_SERPAPI_API_KEY: string;
    readonly EXPO_PUBLIC_SUPABASE_URL: string;
    readonly EXPO_PUBLIC_SUPABASE_ANON_KEY: string;
    readonly EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: string | undefined;
    readonly EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: string | undefined;
    readonly EXPO_PUBLIC_REVENUECAT_IOS_KEY: string | undefined;
    readonly EXPO_PUBLIC_MOCK_PREMIUM: string | undefined;
  }
}
