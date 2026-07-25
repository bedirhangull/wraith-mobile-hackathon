import type { ChatMessage, TripBrief } from "../types";

export interface PersistenceAdapter {
  loadConversation(): Promise<{ messages: ChatMessage[]; brief: TripBrief } | null>;
  saveConversation(messages: ChatMessage[], brief: TripBrief): Promise<void>;
}

// No-op for now — Supabase persistence is deferred. Swapping in a real
// adapter later is a one-file change since callers only depend on this
// interface, never on storage details.
export const inMemoryPersistenceAdapter: PersistenceAdapter = {
  async loadConversation() {
    return null;
  },
  async saveConversation() {
    // intentionally no-op
  },
};
