/**
 * Unit tests for mockPremiumStore.
 *
 * Tests the pure key-generation logic that can run without a native environment.
 * The SecureStore read/write wrappers (loadMockPremium / saveMockPremium) are
 * thin I/O calls that require a native runtime to verify end-to-end.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { mockPremiumStoreKey } from "../mockPremiumStoreKey";

describe("mockPremiumStoreKey", () => {
  it("returns a stable, versioned key for a given user ID", () => {
    const key = mockPremiumStoreKey("user-abc");
    assert.ok(key.includes("mock_premium_v1"), "key should include the version prefix");
    assert.ok(key.includes("user-abc"), "key should embed the user ID");
  });

  it("returns the same key for the same user ID", () => {
    assert.equal(mockPremiumStoreKey("user-xyz"), mockPremiumStoreKey("user-xyz"));
  });

  it("returns different keys for different user IDs", () => {
    assert.notEqual(mockPremiumStoreKey("user-1"), mockPremiumStoreKey("user-2"));
  });

  it("returns an anonymous fallback key when userId is null", () => {
    const key = mockPremiumStoreKey(null);
    assert.ok(key.includes("anonymous"), "null userId should produce an anonymous key");
    assert.ok(key.includes("mock_premium_v1"), "anonymous key should still include the prefix");
  });

  it("anonymous key differs from any named-user key", () => {
    assert.notEqual(mockPremiumStoreKey(null), mockPremiumStoreKey("user-1"));
  });
});
