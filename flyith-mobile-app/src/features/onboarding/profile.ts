import { useSyncExternalStore } from "react";

import type { OnboardingContext } from "@/features/travel-chat/types";

/**
 * Seeded from a real dataset entry so the chat can personalize immediately.
 * Real onboarding screens later call `setUserProfile()`.
 */
const SEEDED_PROFILE: OnboardingContext = {
  averageBudget: 1800,
  favoriteInfluencer: "Batuhan Furkan",
  favoriteInfluencerId: "batuhan-furkan-5",
  favoriteDestination: "Delhi",
  influencerDestinations: ["Delhi"],
  foodPreferences: ["street food", "spicy", "seafood"],
  hostelVsHotel: "hostel",
  culturalVsExperience: "cultural",
  likesGifting: true,
  tripPriorities: ["hotel", "food"],
};

let profile: OnboardingContext = { ...SEEDED_PROFILE };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function getUserProfile(): OnboardingContext {
  return profile;
}

export function setUserProfile(next: Partial<OnboardingContext>): void {
  profile = { ...profile, ...next };
  emit();
}

export function resetUserProfile(): void {
  profile = { ...SEEDED_PROFILE };
  emit();
}

export function useUserProfile(): OnboardingContext {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getUserProfile,
    getUserProfile
  );
}
