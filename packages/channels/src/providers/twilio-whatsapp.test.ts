import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCreate = vi.fn();

vi.mock("twilio", () => ({
  default: vi.fn(() => ({
    messages: { create: mockCreate },
  })),
}));

import { TwilioWhatsAppChannelProvider } from "./twilio-whatsapp.js";

describe("TwilioWhatsAppChannelProvider.send()", () => {
  let provider: TwilioWhatsAppChannelProvider;

  const basePayload = {
    deliveryId: "del-001",
    tenantId: "tenant-001",
    userId: "user-001",
    channel: "whatsapp" as const,
    provider: "twilio-whatsapp",
    to: "+5491123456789",
    body: "Hola mundo",
    metadata: {} as Record<string, unknown>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockCreate.mockResolvedValue({ sid: "SM-test-123" });
    provider = new TwilioWhatsAppChannelProvider(
      "AC-test",
      "auth-token",
      "+14155238886",
    );
  });

  it("calls contentSid and contentVariables when twilioTemplateSid is present", async () => {
    const result = await provider.send({
      ...basePayload,
      metadata: {
        twilioTemplateSid: "HX037ab7e8789f1de1575a26737ff8a233",
        templateVars: { "1": "Carlos", "2": "1", "3": "10" },
      },
    });

    expect(result.success).toBe(true);
    expect(result.providerMessageId).toBe("SM-test-123");
    expect(mockCreate).toHaveBeenCalledOnce();
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "whatsapp:+14155238886",
        to: "whatsapp:+5491123456789",
        contentSid: "HX037ab7e8789f1de1575a26737ff8a233",
        contentVariables: JSON.stringify({
          "1": "Carlos",
          "2": "1",
          "3": "10",
        }),
      }),
    );
  });

  it("sends contentSid without contentVariables when templateVars is empty", async () => {
    const result = await provider.send({
      ...basePayload,
      metadata: {
        twilioTemplateSid: "HX037ab7e8789f1de1575a26737ff8a233",
        templateVars: {},
      },
    });

    expect(result.success).toBe(true);
    const callArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg?.contentSid).toBe("HX037ab7e8789f1de1575a26737ff8a233");
    expect(callArg?.contentVariables).toBeUndefined();
    expect(callArg?.body).toBeUndefined();
  });

  it("sends freeform body when no twilioTemplateSid in metadata", async () => {
    const result = await provider.send({ ...basePayload, metadata: {} });

    expect(result.success).toBe(true);
    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "whatsapp:+14155238886",
        to: "whatsapp:+5491123456789",
        body: "Hola mundo",
      }),
    );
    const callArg = mockCreate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(callArg?.contentSid).toBeUndefined();
  });

  it("returns error without calling Twilio for invalid E.164 phone", async () => {
    const result = await provider.send({ ...basePayload, to: "invalid-phone" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Invalid E.164");
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("returns error when Twilio API throws", async () => {
    mockCreate.mockRejectedValueOnce(new Error("Twilio 63016 error"));

    const result = await provider.send({ ...basePayload });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Twilio 63016 error");
  });
});
