import { influencers } from "@/data/influencers";
import type { OnboardingContext } from "@/features/travel-chat/types";

export interface RawOnboardingAnswers {
  answers: Record<number, string[]>;
  inputAnswers: Record<number, string>;
  travelerCounts: { adults: number; children: number };
}

export interface MappedOnboarding {
  /** Best-effort mapping into the shape the chat engine already personalizes from. */
  context: OnboardingContext;
  /** Not part of OnboardingContext — passed separately to the profiles table. */
  fullName?: string;
}

const influencersById = new Map(influencers.map((influencer) => [influencer.id, influencer]));

/**
 * Onboarding's 8 pages don't map 1:1 onto OnboardingContext's fields (that
 * shape predates these screens — see src/features/onboarding/profile.ts).
 * Only budget and influencer selections have a clean field to land in;
 * discovery interests are folded into tripPriorities as the closest fit.
 * Traveler type / day structure / prep style have no matching field and are
 * intentionally left out of `context` (the full raw answers are still saved
 * to Supabase's `onboarding_answers` jsonb column separately, unmapped).
 */
export function mapAnswersToOnboardingContext({
  answers,
  inputAnswers,
}: RawOnboardingAnswers): MappedOnboarding {
  const context: OnboardingContext = {};

  const fullName = inputAnswers[0]?.trim() || undefined;

  const budgetRaw = inputAnswers[3];
  if (budgetRaw) {
    const parsed = Number(budgetRaw.replace(/[^0-9.]/g, ""));
    if (!Number.isNaN(parsed) && parsed > 0) {
      context.averageBudget = parsed;
    }
  }

  const discoveryInterests = answers[2];
  if (discoveryInterests?.length) {
    context.tripPriorities = discoveryInterests;
  }

  const selectedInfluencerIds = answers[6];
  if (selectedInfluencerIds?.length) {
    const selected = selectedInfluencerIds
      .map((id) => influencersById.get(id))
      .filter((influencer): influencer is NonNullable<typeof influencer> => influencer != null);

    const first = selected[0];
    if (first) {
      context.favoriteInfluencer = first.name;
      context.favoriteDestination = first.travelPlan[0]?.city;
    }
    const destinations = selected.flatMap((influencer) =>
      influencer.travelPlan.map((plan) => plan.city)
    );
    if (destinations.length) {
      context.influencerDestinations = Array.from(new Set(destinations));
    }
  }

  return { context, fullName };
}
