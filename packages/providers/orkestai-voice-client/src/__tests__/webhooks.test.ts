import { describe, it, expect } from "vitest";
import crypto from "crypto";
import {
  verifyWebhookSignature,
  parseWebhookPayload,
  isCallCompletedEvent,
  isCampaignCompletedEvent,
} from "../webhooks";

describe("webhooks", () => {
  describe("verifyWebhookSignature", () => {
    it("should verify valid signature", () => {
      const secret = "test_secret";
      const rawBody = '{"event":"call.completed"}';
      const sig =
        "sha256=" +
        crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

      const result = verifyWebhookSignature(rawBody, sig, secret);
      expect(result).toBe(true);
    });

    it("should reject invalid signature", () => {
      const result = verifyWebhookSignature(
        '{"event":"call.completed"}',
        "sha256=invalid",
        "secret",
      );
      expect(result).toBe(false);
    });
  });

  describe("parseWebhookPayload", () => {
    it("should parse valid call.completed payload", () => {
      const payload = {
        event: "call.completed",
        timestamp: new Date().toISOString(),
        tenantId: "tenant_123",
        data: {
          callId: "call_123",
          campaignId: "campaign_123",
          recipientId: "recipient_123",
          status: "completed",
          duration: 45,
          responses: [],
        },
      };

      const parsed = parseWebhookPayload(payload);
      expect(parsed.event).toBe("call.completed");
      expect(parsed.tenantId).toBe("tenant_123");
    });

    it("should throw on missing event", () => {
      expect(() =>
        parseWebhookPayload({ timestamp: new Date().toISOString() }),
      ).toThrow();
    });
  });

  describe("isCallCompletedEvent", () => {
    it("should identify call.completed event", () => {
      const data = {
        callId: "call_123",
        campaignId: "campaign_123",
        recipientId: "recipient_123",
        status: "completed",
        duration: 45,
        responses: [],
      };

      expect(isCallCompletedEvent(data)).toBe(true);
    });

    it("should reject incomplete data", () => {
      expect(isCallCompletedEvent({ callId: "call_123" })).toBe(false);
    });
  });

  describe("isCampaignCompletedEvent", () => {
    it("should identify campaign.completed event", () => {
      const data = {
        campaignId: "campaign_123",
        campaignName: "Test Campaign",
        completedAt: new Date().toISOString(),
      };

      expect(isCampaignCompletedEvent(data)).toBe(true);
    });
  });
});
