import { supabase } from "@/lib/supabase";

export interface ProfileRow {
  planStatus: string;
  onboardingCompleted: boolean;
  fullName: string | null;
}

export async function fetchProfile(userId: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("plan_status, onboarding_completed, full_name")
    .eq("id", userId)
    .maybeSingle();
  if (error || !data) return null;
  return {
    planStatus: data.plan_status,
    onboardingCompleted: data.onboarding_completed,
    fullName: data.full_name,
  };
}

/**
 * `answers` is stored as-is in the `onboarding_answers` jsonb column — it's
 * the raw per-page answer shape (not forced into OnboardingContext, which
 * only covers a subset of what onboarding.tsx actually collects).
 */
export async function upsertOnboardingAnswers(
  userId: string,
  answers: Record<string, unknown>,
  fullName?: string
): Promise<void> {
  const { error } = await supabase.from("profiles").upsert(
    {
      id: userId,
      onboarding_answers: answers,
      onboarding_completed: true,
      ...(fullName ? { full_name: fullName } : {}),
    },
    { onConflict: "id" }
  );
  if (error) throw error;
}
