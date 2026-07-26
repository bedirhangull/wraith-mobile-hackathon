import { useSyncExternalStore } from "react";

import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";

let session: Session | null = null;
let hasResolvedInitialSession = false;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

supabase.auth.onAuthStateChange((_event, nextSession) => {
  session = nextSession;
  hasResolvedInitialSession = true;
  emit();
});

export function getSession(): Session | null {
  return session;
}

export function useSession(): Session | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSession,
    getSession
  );
}

/** Race supabase's session restore against a timeout so a stuck network call can't hang the splash screen forever. */
async function getSessionWithTimeout(timeoutMs: number): Promise<Session | null> {
  if (hasResolvedInitialSession) return session;

  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  const resolved = supabase.auth.getSession().then(({ data }) => data.session);

  return Promise.race([resolved, timeout]);
}

export interface LaunchState {
  session: Session | null;
  onboardingCompleted: boolean;
}

/**
 * One-shot check used by the splash screen to decide the first route.
 * Never throws and never hangs indefinitely — falls back to "no session"
 * after 5s so a network hiccup can't strand the user on the splash screen.
 */
export async function resolveLaunchState(): Promise<LaunchState> {
  const resolvedSession = await getSessionWithTimeout(5000);
  if (!resolvedSession) {
    return { session: null, onboardingCompleted: false };
  }

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", resolvedSession.user.id)
      .maybeSingle();
    if (error || !data) {
      return { session: resolvedSession, onboardingCompleted: false };
    }
    return { session: resolvedSession, onboardingCompleted: data.onboarding_completed === true };
  } catch {
    return { session: resolvedSession, onboardingCompleted: false };
  }
}
