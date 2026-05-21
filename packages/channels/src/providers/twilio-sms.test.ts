import { describe, it, expect, vi } from "vitest";

vi.mock("twilio", () => ({
  default: vi.fn().mockReturnValue({ messages: { create: vi.fn() } }),
}));

import { TwilioSMSProvider } from "./twilio-sms.js";

describe("TwilioSMSProvider.parseWebhook", () => {
  const provider = new TwilioSMSProvider(
    "AC-test",
    "auth-token",
    "+15550000000",
  );
  const headers = {};

  const makeBody = (MessageSid?: string, MessageStatus?: string) => ({
    ...(MessageSid !== undefined ? { MessageSid } : {}),
    ...(MessageStatus !== undefined ? { MessageStatus } : {}),
  });

  it("MessageStatus='delivered' returns DeliveryEvent with event='delivered'", () => {
    const body = makeBody("SM-001", "delivered");
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.event).toBe("delivered");
    expect(first?.deliveryId).toBe("SM-001");
  });

  it("MessageStatus='sent' returns DeliveryEvent with event='sent'", () => {
    const body = makeBody("SM-002", "sent");
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.event).toBe("sent");
    expect(first?.deliveryId).toBe("SM-002");
  });

  it("MessageStatus='failed' returns DeliveryEvent with event='failed'", () => {
    const body = makeBody("SM-003", "failed");
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.event).toBe("failed");
  });

  it("MessageStatus='undelivered' returns DeliveryEvent with event='failed'", () => {
    const body = makeBody("SM-004", "undelivered");
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.event).toBe("failed");
  });

  it("unknown status returns empty array", () => {
    const body = makeBody("SM-005", "queued");
    const result = provider.parseWebhook(body, headers);
    expect(result).toEqual([]);
  });

  it("missing MessageSid returns empty array", () => {
    const body = makeBody(undefined, "delivered");
    const result = provider.parseWebhook(body, headers);
    expect(result).toEqual([]);
  });

  it("missing MessageStatus returns empty array", () => {
    const body = makeBody("SM-007", undefined);
    const result = provider.parseWebhook(body, headers);
    expect(result).toEqual([]);
  });
});
