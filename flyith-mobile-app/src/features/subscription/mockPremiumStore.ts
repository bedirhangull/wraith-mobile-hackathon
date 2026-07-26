import * as SecureStore from "expo-secure-store";

import { mockPremiumStoreKey } from "./mockPremiumStoreKey";

export { mockPremiumStoreKey } from "./mockPremiumStoreKey";

/**
 * Returns true if mock premium has been persisted for this user on this device.
 * Never throws — failures silently return false.
 */
export async function loadMockPremium(userId: string | null): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(mockPremiumStoreKey(userId));
    return value === "true";
  } catch {
    return false;
  }
}

/**
 * Persists (or removes) mock premium state for this user on this device.
 * Returns false when secure storage could not be updated.
 */
export async function saveMockPremium(userId: string | null, isPremium: boolean): Promise<boolean> {
  try {
    if (isPremium) {
      await SecureStore.setItemAsync(mockPremiumStoreKey(userId), "true");
    } else {
      await SecureStore.deleteItemAsync(mockPremiumStoreKey(userId));
    }
    return true;
  } catch {
    return false;
  }
}
