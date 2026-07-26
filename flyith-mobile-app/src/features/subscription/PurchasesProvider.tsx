import {
  createContext,
  type JSX,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Platform } from "react-native";
import Purchases, {
  PURCHASES_ERROR_CODE,
  type CustomerInfo,
  type PurchasesError,
  type PurchasesOffering,
  type PurchasesPackage,
} from "react-native-purchases";

import { env } from "@/config/env";
import { updatePlanStatus } from "@/features/auth/profile-api";
import { useSession } from "@/features/auth/session";

import { loadMockPremium, saveMockPremium } from "./mockPremiumStore";
import {
  configurePurchases,
  hasPremiumEntitlement,
  isPurchasesConfigured,
  logInPurchases,
  logOutPurchases,
} from "./purchases";

export type PurchaseResult = "success" | "cancelled" | "unavailable" | "error";

interface SubscriptionPackages {
  annual: PurchasesPackage | null;
  monthly: PurchasesPackage | null;
  weekly: PurchasesPackage | null;
}

interface PurchasesContextValue {
  customerInfo: CustomerInfo | null;
  error: string | null;
  isLoading: boolean;
  isMockMode: boolean;
  isPremium: boolean;
  isPurchasing: boolean;
  offering: PurchasesOffering | null;
  packages: SubscriptionPackages;
  /** Only meaningful in mock mode — persists mock premium to secure storage. */
  activateMockPremium: () => Promise<PurchaseResult>;
  /** Only meaningful in mock mode — clears persisted mock premium. */
  deactivateMockPremium: () => Promise<PurchaseResult>;
  purchase: (pkg: PurchasesPackage) => Promise<PurchaseResult>;
  refresh: () => Promise<void>;
  restore: () => Promise<PurchaseResult>;
}

const EMPTY_PACKAGES: SubscriptionPackages = {
  annual: null,
  monthly: null,
  weekly: null,
};

const PurchasesContext = createContext<PurchasesContextValue | null>(null);

// ---------------------------------------------------------------------------
// Helpers shared between real and mock providers
// ---------------------------------------------------------------------------

function packagesFromOffering(offering: PurchasesOffering | null): SubscriptionPackages {
  if (!offering) return EMPTY_PACKAGES;
  return {
    annual: offering.annual ?? offering.availablePackages.find((p) => p.identifier === "$rc_annual") ?? null,
    monthly:
      offering.monthly ?? offering.availablePackages.find((p) => p.identifier === "$rc_monthly") ?? null,
    weekly: offering.weekly ?? offering.availablePackages.find((p) => p.identifier === "$rc_weekly") ?? null,
  };
}

function isUserCancelled(error: unknown): boolean {
  const purchasesError = error as PurchasesError | undefined;
  return purchasesError?.code === PURCHASES_ERROR_CODE.PURCHASE_CANCELLED_ERROR;
}

const OFFERINGS_UNAVAILABLE_MESSAGE =
  "Subscription plans aren't available yet. Please try again in a moment.";

function toUserFacingOfferingsError(error: unknown): string {
  const purchasesError = error as PurchasesError | undefined;
  const rawMessage = error instanceof Error ? error.message : String(error ?? "");

  if (__DEV__ && rawMessage) {
    console.warn("[Purchases] Offerings error:", rawMessage, purchasesError?.code);
  }

  if (purchasesError?.code === PURCHASES_ERROR_CODE.CONFIGURATION_ERROR) {
    return OFFERINGS_UNAVAILABLE_MESSAGE;
  }

  if (/configuration|offerings|storekit|app store connect/i.test(rawMessage)) {
    return OFFERINGS_UNAVAILABLE_MESSAGE;
  }

  return rawMessage || "Couldn't load subscription offerings.";
}

// ---------------------------------------------------------------------------
// Mock provider — no RevenueCat; persists state via expo-secure-store
// ---------------------------------------------------------------------------

function MockPurchasesProvider({ children }: { children: ReactNode }): JSX.Element {
  const session = useSession();
  const userId = session?.user.id ?? null;

  const [isPremium, setIsPremium] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);

  // Reload persisted state whenever the logged-in user changes.
  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setIsLoading(true);
      const stored = await loadMockPremium(userId);
      if (!cancelled) {
        setIsPremium(stored);
        setIsLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const activateMockPremium = useCallback(async (): Promise<PurchaseResult> => {
    setIsPurchasing(true);
    // Brief simulated loading so the UI can show a loading state.
    await new Promise<void>((resolve) => setTimeout(resolve, 700));
    const saved = await saveMockPremium(userId, true);
    if (!saved) {
      setIsPurchasing(false);
      return "error";
    }
    setIsPremium(true);
    setIsPurchasing(false);
    return "success";
  }, [userId]);

  const deactivateMockPremium = useCallback(async (): Promise<PurchaseResult> => {
    setIsPurchasing(true);
    const saved = await saveMockPremium(userId, false);
    if (!saved) {
      setIsPurchasing(false);
      return "error";
    }
    setIsPremium(false);
    setIsPurchasing(false);
    return "success";
  }, [userId]);

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    setIsPurchasing(true);
    await new Promise<void>((resolve) => setTimeout(resolve, 500));
    const stored = await loadMockPremium(userId);
    if (stored) setIsPremium(true);
    setIsPurchasing(false);
    // Only report success if premium was already persisted; never grant on restore.
    return stored ? "success" : "error";
  }, [userId]);

  // purchase() is not used in mock mode (paywalls call activateMockPremium directly),
  // but provide a safe fallback so the type contract is satisfied.
  const purchase = useCallback(async (_pkg: PurchasesPackage): Promise<PurchaseResult> => {
    return activateMockPremium();
  }, [activateMockPremium]);

  const refresh = useCallback(async (): Promise<void> => {
    const stored = await loadMockPremium(userId);
    setIsPremium(stored);
  }, [userId]);

  const value = useMemo<PurchasesContextValue>(
    () => ({
      customerInfo: null,
      error: null,
      isLoading,
      isMockMode: true,
      isPremium,
      isPurchasing,
      offering: null,
      packages: EMPTY_PACKAGES,
      activateMockPremium,
      deactivateMockPremium,
      purchase,
      refresh,
      restore,
    }),
    [
      activateMockPremium,
      deactivateMockPremium,
      isLoading,
      isPremium,
      isPurchasing,
      purchase,
      refresh,
      restore,
    ]
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

// ---------------------------------------------------------------------------
// Real provider — full RevenueCat integration (unchanged logic)
// ---------------------------------------------------------------------------

function RealPurchasesProvider({ children }: { children: ReactNode }): JSX.Element {
  const session = useSession();
  const sessionUserId = session?.user.id;
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [offering, setOffering] = useState<PurchasesOffering | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncedPlanRef = useRef<string | null>(null);

  const isPremium = hasPremiumEntitlement(customerInfo);

  const syncPlanStatus = useCallback(
    async (info: CustomerInfo | null, userId: string | undefined) => {
      if (!userId) return;
      const nextStatus = hasPremiumEntitlement(info) ? "pro" : "free";
      if (syncedPlanRef.current === nextStatus) return;
      syncedPlanRef.current = nextStatus;
      try {
        await updatePlanStatus(userId, nextStatus);
      } catch {
        syncedPlanRef.current = null;
      }
    },
    []
  );

  const applyCustomerInfo = useCallback(
    (info: CustomerInfo | null) => {
      setCustomerInfo(info);
      void syncPlanStatus(info, sessionUserId);
    },
    [sessionUserId, syncPlanStatus]
  );

  const refresh = useCallback(async (): Promise<void> => {
    try {
      if (!isPurchasesConfigured() && Platform.OS === "ios") {
        await configurePurchases(sessionUserId);
      }
      if (!isPurchasesConfigured()) {
        setError(
          Platform.OS === "ios"
            ? "Purchases aren't configured. Check EXPO_PUBLIC_REVENUECAT_IOS_KEY and restart the app."
            : "Subscriptions are only available on iOS right now."
        );
        setOffering(null);
        setIsLoading(false);
        return;
      }

      const [info, offerings] = await Promise.all([
        Purchases.getCustomerInfo(),
        Purchases.getOfferings(),
      ]);
      applyCustomerInfo(info);
      if (!offerings.current || offerings.current.availablePackages.length === 0) {
        setOffering(null);
        setError(OFFERINGS_UNAVAILABLE_MESSAGE);
        if (__DEV__) {
          console.warn(
            "[Purchases] Empty offerings. Products may still be propagating from App Store Connect, or StoreKit isn't available in this environment."
          );
        }
      } else {
        setOffering(offerings.current);
        setError(null);
      }
    } catch (err) {
      setOffering(null);
      setError(toUserFacingOfferingsError(err));
    } finally {
      setIsLoading(false);
    }
  }, [applyCustomerInfo, sessionUserId]);

  useEffect(() => {
    let cancelled = false;
    let customerInfoListener: ((info: CustomerInfo) => void) | undefined;

    async function bootstrap(): Promise<void> {
      setIsLoading(true);
      try {
        if (sessionUserId) {
          const info = await logInPurchases(sessionUserId);
          if (!cancelled && info) applyCustomerInfo(info);
        } else {
          await configurePurchases(null);
          if (isPurchasesConfigured()) {
            await logOutPurchases();
          }
          if (!cancelled) {
            applyCustomerInfo(null);
            syncedPlanRef.current = null;
          }
        }

        if (!cancelled) {
          await refresh();
        }

        if (isPurchasesConfigured()) {
          customerInfoListener = (info) => {
            if (!cancelled) applyCustomerInfo(info);
          };
          Purchases.addCustomerInfoUpdateListener(customerInfoListener);
        }
      } catch (err) {
        if (!cancelled) {
          setError(toUserFacingOfferingsError(err));
          setIsLoading(false);
        }
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
      if (customerInfoListener) {
        Purchases.removeCustomerInfoUpdateListener(customerInfoListener);
      }
    };
  }, [applyCustomerInfo, refresh, sessionUserId]);

  const purchase = useCallback(
    async (pkg: PurchasesPackage): Promise<PurchaseResult> => {
      if (!isPurchasesConfigured()) return "unavailable";
      setIsPurchasing(true);
      try {
        const { customerInfo: info } = await Purchases.purchasePackage(pkg);
        applyCustomerInfo(info);
        setError(null);
        return "success";
      } catch (err) {
        if (isUserCancelled(err)) return "cancelled";
        setError(err instanceof Error ? err.message : "Purchase failed.");
        return "error";
      } finally {
        setIsPurchasing(false);
      }
    },
    [applyCustomerInfo]
  );

  const restore = useCallback(async (): Promise<PurchaseResult> => {
    if (!isPurchasesConfigured()) return "unavailable";
    setIsPurchasing(true);
    try {
      const info = await Purchases.restorePurchases();
      applyCustomerInfo(info);
      setError(null);
      return hasPremiumEntitlement(info) ? "success" : "error";
    } catch (err) {
      if (isUserCancelled(err)) return "cancelled";
      setError(err instanceof Error ? err.message : "Restore failed.");
      return "error";
    } finally {
      setIsPurchasing(false);
    }
  }, [applyCustomerInfo]);

  // activateMockPremium is a no-op in real mode.
  const activateMockPremium = useCallback(async (): Promise<PurchaseResult> => {
    return "unavailable";
  }, []);

  const deactivateMockPremium = useCallback(async (): Promise<PurchaseResult> => {
    return "unavailable";
  }, []);

  const value = useMemo<PurchasesContextValue>(
    () => ({
      customerInfo,
      error,
      isLoading,
      isMockMode: false,
      isPremium,
      isPurchasing,
      offering,
      packages: packagesFromOffering(offering),
      activateMockPremium,
      deactivateMockPremium,
      purchase,
      refresh,
      restore,
    }),
    [
      activateMockPremium,
      customerInfo,
      deactivateMockPremium,
      error,
      isLoading,
      isPremium,
      isPurchasing,
      offering,
      purchase,
      refresh,
      restore,
    ]
  );

  return <PurchasesContext.Provider value={value}>{children}</PurchasesContext.Provider>;
}

// ---------------------------------------------------------------------------
// Public exports
// ---------------------------------------------------------------------------

/** Renders either the mock or real RevenueCat provider based on EXPO_PUBLIC_MOCK_PREMIUM. */
export function PurchasesProvider({ children }: { children: ReactNode }): JSX.Element {
  if (env.mockPremium) {
    return <MockPurchasesProvider>{children}</MockPurchasesProvider>;
  }
  return <RealPurchasesProvider>{children}</RealPurchasesProvider>;
}

export function usePurchases(): PurchasesContextValue {
  const value = useContext(PurchasesContext);
  if (!value) {
    throw new Error("usePurchases must be used within PurchasesProvider");
  }
  return value;
}
