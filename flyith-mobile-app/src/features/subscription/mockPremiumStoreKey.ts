/** Prefix version — bump to invalidate all stored mock-premium keys. */
export const MOCK_PREMIUM_KEY_PREFIX = "mock_premium_v1";

/**
 * Derives the SecureStore key for a given Supabase user.
 * Pure function — no native dependencies — exported so it can be unit-tested.
 */
export function mockPremiumStoreKey(userId: string | null): string {
  return userId
    ? `${MOCK_PREMIUM_KEY_PREFIX}_${userId}`
    : `${MOCK_PREMIUM_KEY_PREFIX}_anonymous`;
}
