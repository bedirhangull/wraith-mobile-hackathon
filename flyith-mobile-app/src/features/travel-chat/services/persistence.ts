import { getSession } from "@/features/auth/session";
import { supabase } from "@/lib/supabase";

import type { ChatMessage, TripBrief } from "../types";

export interface PersistenceAdapter {
  loadConversation(): Promise<{ messages: ChatMessage[]; brief: TripBrief } | null>;
  saveConversation(messages: ChatMessage[], brief: TripBrief): Promise<void>;
}

// Name kept as `inMemoryPersistenceAdapter` even though it's now Supabase-backed —
// useTravelChatEngine.ts imports this exact binding, renaming it would require
// touching the chat engine, which this change intentionally avoids.
export const inMemoryPersistenceAdapter: PersistenceAdapter = {
  async loadConversation() {
    const session = getSession();
    if (!session) return null;

    const { data, error } = await supabase
      .from("trip_plans")
      .select("messages, brief")
      .eq("user_id", session.user.id)
      .maybeSingle();
    if (error || !data) return null;

    return { messages: data.messages as ChatMessage[], brief: data.brief as TripBrief };
  },

  async saveConversation(messages, brief) {
    const session = getSession();
    if (!session) return;

    const { error } = await supabase
      .from("trip_plans")
      .upsert({ user_id: session.user.id, messages, brief }, { onConflict: "user_id" });
    if (error) {
      console.warn("[persistence] saveConversation failed", error);
    }
  },
};
