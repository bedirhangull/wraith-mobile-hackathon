import type { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { logOutPurchases } from "@/features/subscription/purchases";

export interface EmailSignUpInput {
  email: string;
  password: string;
  fullName?: string;
}

export interface EmailSignInInput {
  email: string;
  password: string;
}

export interface AuthResult {
  user: User | null;
  session: Session | null;
}

export async function signUpWithEmail({
  email,
  password,
  fullName,
}: EmailSignUpInput): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: fullName ? { data: { full_name: fullName } } : undefined,
  });
  if (error) throw error;
  return { user: data.user, session: data.session };
}

export async function signInWithEmail({
  email,
  password,
}: EmailSignInInput): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return { user: data.user, session: data.session };
}

export async function signOut(): Promise<void> {
  try {
    await logOutPurchases();
  } catch {
    // Still clear the Supabase session even if RevenueCat logout fails.
  }
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}
