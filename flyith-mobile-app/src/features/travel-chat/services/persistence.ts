import { getSession } from "@/features/auth/session";
import { FREE_NORMAL_CHAT_LIMIT } from "@/features/subscription/constants";
import { supabase } from "@/lib/supabase";

import type { ChatMessage, PlanningMode, TripBrief } from "../types";

export interface TripPlanSummary {
  id: string;
  title: string;
  planningMode: PlanningMode;
  destination?: string;
  startDate?: string;
  endDate?: string;
  status: TripBrief["status"];
  updatedAt: string;
}

export interface PersistedConversation {
  id: string;
  messages: ChatMessage[];
  brief: TripBrief;
  locale?: "tr" | "en";
  askedTopics: string[];
  answeredTopics: string[];
}

export interface SaveConversationPayload {
  messages: ChatMessage[];
  brief: TripBrief;
  locale?: "tr" | "en" | null;
  askedTopics: string[];
  answeredTopics: string[];
}

/** Client-side UUID suitable for `trip_plans.id`. */
export function createConversationId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const rand = (Math.random() * 16) | 0;
    const value = char === "x" ? rand : (rand & 0x3) | 0x8;
    return value.toString(16);
  });
}

export function deriveConversationTitle(brief: TripBrief): string {
  const mode = brief.planningMode ?? "chat";
  if (mode === "youtube") {
    const videoTitle = brief.youtubeSource?.title?.trim();
    if (videoTitle) return videoTitle;
    if (brief.destination) return `${brief.destination} · YouTube`;
    return "YouTube trip";
  }
  if (mode === "influencer") {
    const name = brief.influencerSource?.name?.trim();
    if (name && brief.destination) return `${brief.destination} · ${name}`;
    if (name) return `${name}'s route`;
    if (brief.destination) return `${brief.destination} · Influencer`;
    return "Influencer trip";
  }
  if (brief.destination?.trim()) return brief.destination.trim();
  return "Travel plan";
}

export function derivePlanningMode(brief: TripBrief): PlanningMode {
  return brief.planningMode ?? "chat";
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function asLocale(value: unknown): "tr" | "en" | undefined {
  return value === "tr" || value === "en" ? value : undefined;
}

export async function listConversations(): Promise<TripPlanSummary[]> {
  const session = getSession();
  if (!session) return [];

  const { data, error } = await supabase
    .from("trip_plans")
    .select("id, title, planning_mode, brief, updated_at")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false });

  if (error || !data) {
    console.warn("[persistence] listConversations failed", error);
    return [];
  }

  return data.map((row) => {
    const brief = (row.brief ?? {}) as TripBrief;
    const planningMode = (row.planning_mode as PlanningMode) || derivePlanningMode(brief);
    return {
      id: row.id as string,
      title: (row.title as string | null)?.trim() || deriveConversationTitle(brief),
      planningMode,
      destination: brief.destination,
      startDate: brief.startDate,
      endDate: brief.endDate,
      status: brief.status ?? "planning",
      updatedAt: row.updated_at as string,
    };
  });
}

export async function loadConversation(id: string): Promise<PersistedConversation | null> {
  const session = getSession();
  if (!session) return null;

  const { data, error } = await supabase
    .from("trip_plans")
    .select("id, messages, brief, locale, asked_topics, answered_topics")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .maybeSingle();

  if (error || !data) {
    if (error) console.warn("[persistence] loadConversation failed", error);
    return null;
  }

  return {
    id: data.id as string,
    messages: (data.messages as ChatMessage[]) ?? [],
    brief: (data.brief as TripBrief) ?? { status: "planning" },
    locale: asLocale(data.locale),
    askedTopics: asStringArray(data.asked_topics),
    answeredTopics: asStringArray(data.answered_topics),
  };
}

export async function saveConversation(
  id: string,
  payload: SaveConversationPayload
): Promise<void> {
  const session = getSession();
  if (!session) return;

  // Skip empty brand-new chats until the user (or engine) produces something.
  if (payload.messages.length === 0 && payload.brief.status === "planning") {
    const hasProgress =
      Boolean(payload.brief.destination) ||
      Boolean(payload.brief.planningMode && payload.brief.planningMode !== "chat") ||
      Boolean(payload.brief.youtubeSource) ||
      Boolean(payload.brief.influencerSource);
    if (!hasProgress) return;
  }

  const { error } = await supabase.from("trip_plans").upsert(
    {
      id,
      user_id: session.user.id,
      messages: payload.messages,
      brief: payload.brief,
      title: deriveConversationTitle(payload.brief),
      planning_mode: derivePlanningMode(payload.brief),
      locale: payload.locale ?? null,
      asked_topics: payload.askedTopics,
      answered_topics: payload.answeredTopics,
    },
    { onConflict: "id" }
  );

  if (error) {
    console.warn("[persistence] saveConversation failed", error);
  }
}

/** How many normal chats this user has already claimed toward the free quota. */
export async function getNormalChatUsageCount(): Promise<number> {
  const session = getSession();
  if (!session) return 0;

  const { count, error } = await supabase
    .from("trip_plans")
    .select("id", { count: "exact", head: true })
    .eq("user_id", session.user.id)
    .not("normal_usage_claimed_at", "is", null);

  if (error) {
    console.warn("[persistence] getNormalChatUsageCount failed", error);
    return 0;
  }

  return count ?? 0;
}

export async function hasFreeNormalChatQuota(): Promise<boolean> {
  const used = await getNormalChatUsageCount();
  return used < FREE_NORMAL_CHAT_LIMIT;
}

/**
 * Atomically claims one free normal-chat slot for this conversation.
 * Idempotent for the same conversationId. Returns false when the free limit is hit.
 */
export async function claimNormalChatUsage(conversationId: string): Promise<boolean> {
  const session = getSession();
  if (!session) return false;

  const { data, error } = await supabase.rpc("claim_normal_chat_usage", {
    p_conversation_id: conversationId,
  });

  if (error) {
    console.warn("[persistence] claimNormalChatUsage failed", error);
    return false;
  }

  return data === true;
}
