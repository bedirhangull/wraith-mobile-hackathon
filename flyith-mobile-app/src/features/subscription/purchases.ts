import { Platform } from "react-native";
import Purchases, { LOG_LEVEL, type CustomerInfo } from "react-native-purchases";

import { env } from "@/config/env";

import { PREMIUM_ENTITLEMENT_ID } from "./constants";

let configured = false;

export function isPurchasesConfigured(): boolean {
  return configured;
}

export class PurchasesConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PurchasesConfigError";
  }
}

export async function configurePurchases(appUserId?: string | null): Promise<void> {
  if (configured || Platform.OS !== "ios") return;

  const apiKey = env.revenueCatIosKey.trim();
  if (!apiKey) {
    throw new PurchasesConfigError(
      "Missing EXPO_PUBLIC_REVENUECAT_IOS_KEY. Add the RevenueCat iOS public SDK key (appl_…) to .env and restart the app."
    );
  }

  if (__DEV__) {
    Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  }

  Purchases.configure({
    apiKey,
    appUserID: appUserId ?? undefined,
  });
  configured = true;
}

export async function logInPurchases(appUserId: string): Promise<CustomerInfo | null> {
  if (!configured) {
    await configurePurchases(appUserId);
    if (!configured) return null;
  }

  const { customerInfo } = await Purchases.logIn(appUserId);
  return customerInfo;
}

export async function logOutPurchases(): Promise<void> {
  if (!configured) return;
  const isAnonymous = await Purchases.isAnonymous();
  if (isAnonymous) return;
  await Purchases.logOut();
}

export function hasPremiumEntitlement(customerInfo: CustomerInfo | null | undefined): boolean {
  if (!customerInfo) return false;
  return Boolean(customerInfo.entitlements.active[PREMIUM_ENTITLEMENT_ID]);
}
