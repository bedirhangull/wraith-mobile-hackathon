import { usePurchases } from "./PurchasesProvider";

/** Convenience hook for entitlement checks and purchase actions. */
export function usePremium() {
  const {
    activateMockPremium,
    deactivateMockPremium,
    error,
    isLoading,
    isMockMode,
    isPremium,
    isPurchasing,
    offering,
    packages,
    purchase,
    refresh,
    restore,
  } = usePurchases();

  return {
    activateMockPremium,
    deactivateMockPremium,
    error,
    isLoading,
    isMockMode,
    isPremium,
    isPurchasing,
    offering,
    packages,
    purchase,
    refresh,
    restore,
  };
}
