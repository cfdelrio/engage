import { describe, it, expect, vi } from "vitest";

vi.mock("resend", () => ({ Resend: vi.fn().mockReturnValue({}) }));

import { ResendEmailProvider } from "./resend.js";

describe("ResendEmailProvider.parseWebhook", () => {
  const provider = new ResendEmailProvider("test-api-key");
  const headers = {};

  const makeBody = (type: string, data: Record<string, unknown>) => ({
    type,
    data,
  });

  it("'email.sent' event returns DeliveryEvent with event='sent'", () => {
    const body = makeBody("email.sent", { email_id: "msg-123" });
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.event).toBe("sent");
    expect(first?.deliveryId).toBe("msg-123");
  });

  it("'email.delivered' event returns DeliveryEvent with event='delivered'", () => {
    const body = makeBody("email.delivered", { email_id: "msg-124" });
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.event).toBe("delivered");
    expect(first?.deliveryId).toBe("msg-124");
  });

  it("'email.opened' event returns DeliveryEvent with event='opened'", () => {
    const body = makeBody("email.opened", { email_id: "msg-125" });
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.event).toBe("opened");
  });

  it("'email.clicked' event returns DeliveryEvent with event='clicked'", () => {
    const body = makeBody("email.clicked", { email_id: "msg-126" });
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.event).toBe("clicked");
  });

  it("'email.bounced' event returns DeliveryEvent with event='bounced'", () => {
    const body = makeBody("email.bounced", { email_id: "msg-127" });
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.event).toBe("bounced");
  });

  it("unknown event type returns empty array", () => {
    const body = makeBody("email.unknown", { email_id: "msg-128" });
    const result = provider.parseWebhook(body, headers);
    expect(result).toEqual([]);
  });

  it("missing messageId returns empty array", () => {
    const body = makeBody("email.sent", {});
    const result = provider.parseWebhook(body, headers);
    expect(result).toEqual([]);
  });

  it("supports email_id field as the ID field", () => {
    const body = makeBody("email.delivered", { email_id: "id-from-email-id" });
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.deliveryId).toBe("id-from-email-id");
  });

  it("supports message_id field as the ID field", () => {
    const body = makeBody("email.delivered", {
      message_id: "id-from-message-id",
    });
    const result = provider.parseWebhook(body, headers);
    const [first] = result;
    expect(result).toHaveLength(1);
    expect(first?.deliveryId).toBe("id-from-message-id");
  });
});
