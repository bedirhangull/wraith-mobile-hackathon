import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { FREE_NORMAL_CHAT_LIMIT } from "../../../subscription/constants";
import {
  clearPendingPremiumAction,
  consumePendingPremiumAction,
  isAtFreeNormalChatLimit,
  paywallPathForAction,
  peekPendingPremiumAction,
  setPendingPremiumAction,
} from "../../../subscription/premiumChatGate";
import { isYouTubeUrl } from "../../utils/youtubeUrl";

describe("free normal chat limit", () => {
  it("allows up to FREE_NORMAL_CHAT_LIMIT conversations", () => {
    assert.equal(FREE_NORMAL_CHAT_LIMIT, 3);
    assert.equal(isAtFreeNormalChatLimit(0), false);
    assert.equal(isAtFreeNormalChatLimit(2), false);
    assert.equal(isAtFreeNormalChatLimit(3), true);
    assert.equal(isAtFreeNormalChatLimit(4), true);
  });
});

describe("premium paywall routing", () => {
  it("sends influencer to paywall-3 and youtube/normal to paywall-2", () => {
    assert.equal(paywallPathForAction("influencer"), "/paywall-3");
    assert.equal(paywallPathForAction("youtube"), "/paywall-2");
    assert.equal(paywallPathForAction("normal_text"), "/paywall-2");
  });
});

describe("pending premium action", () => {
  it("stores, peeks, and consumes once for the matching conversation", () => {
    clearPendingPremiumAction();
    setPendingPremiumAction({
      kind: "youtube",
      conversationId: "conv-a",
      url: "https://youtu.be/dQw4w9WgXcQ",
    });
    assert.equal(peekPendingPremiumAction()?.kind, "youtube");
    assert.equal(consumePendingPremiumAction("conv-b"), null);
    assert.equal(peekPendingPremiumAction()?.kind, "youtube");

    const consumed = consumePendingPremiumAction("conv-a");
    assert.equal(consumed?.kind, "youtube");
    if (consumed?.kind === "youtube") {
      assert.equal(consumed.url, "https://youtu.be/dQw4w9WgXcQ");
    }
    assert.equal(peekPendingPremiumAction(), null);
    assert.equal(consumePendingPremiumAction("conv-a"), null);
  });

  it("clears pending action on explicit clear", () => {
    setPendingPremiumAction({
      kind: "influencer",
      conversationId: "conv-c",
      influencerId: "batuhan-furkan-5",
    });
    clearPendingPremiumAction();
    assert.equal(peekPendingPremiumAction(), null);
  });
});

describe("youtube gate detection", () => {
  it("detects youtube urls for premium gating", () => {
    assert.equal(isYouTubeUrl("https://youtu.be/dQw4w9WgXcQ"), true);
    assert.equal(isYouTubeUrl("paris 5 days please"), false);
  });
});
