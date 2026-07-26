import { FREE_NORMAL_CHAT_LIMIT } from "@/features/subscription/constants";

export type PendingPremiumAction =
  | { kind: "normal_text"; conversationId: string; text: string }
  | { kind: "youtube"; conversationId: string; url: string }
  | { kind: "influencer"; conversationId: string; influencerId: string };

let pendingAction: PendingPremiumAction | null = null;

export function setPendingPremiumAction(action: PendingPremiumAction): void {
  pendingAction = action;
}

export function clearPendingPremiumAction(): void {
  pendingAction = null;
}

export function peekPendingPremiumAction(): PendingPremiumAction | null {
  return pendingAction;
}

/** Returns and clears the pending action if it matches the conversation. */
export function consumePendingPremiumAction(
  conversationId: string
): PendingPremiumAction | null {
  if (!pendingAction || pendingAction.conversationId !== conversationId) {
    return null;
  }
  const action = pendingAction;
  pendingAction = null;
  return action;
}

export function paywallPathForAction(
  kind: PendingPremiumAction["kind"]
): "/paywall-2" | "/paywall-3" {
  return kind === "influencer" ? "/paywall-3" : "/paywall-2";
}

export function isAtFreeNormalChatLimit(usedCount: number): boolean {
  return usedCount >= FREE_NORMAL_CHAT_LIMIT;
}
