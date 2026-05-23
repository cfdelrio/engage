import { createHmac, timingSafeEqual } from "crypto";
import type {
  WebhookPayload,
  CallCompletedWebhookData,
  CampaignCompletedWebhookData,
} from "./types.js";

export function verifyWebhookSignature(
  rawBody: string | Buffer,
  signature: string,
  secret: string,
): boolean {
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  } catch {
    return false;
  }
}

export function parseWebhookPayload(body: unknown): WebhookPayload {
  if (typeof body !== "object" || body === null) {
    throw new Error("Invalid webhook payload: expected object");
  }

  const payload = body as Record<string, unknown>;

  if (typeof payload.event !== "string") {
    throw new Error("Invalid webhook payload: missing 'event' field");
  }

  if (typeof payload.timestamp !== "string") {
    throw new Error("Invalid webhook payload: missing 'timestamp' field");
  }

  if (typeof payload.tenantId !== "string") {
    throw new Error("Invalid webhook payload: missing 'tenantId' field");
  }

  if (typeof payload.data !== "object" || payload.data === null) {
    throw new Error("Invalid webhook payload: missing 'data' field");
  }

  return {
    event: payload.event as WebhookPayload["event"],
    timestamp: payload.timestamp,
    tenantId: payload.tenantId,
    data: payload.data as Record<string, unknown>,
  };
}

export function isCallCompletedEvent(
  data: unknown,
): data is CallCompletedWebhookData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.callId === "string" &&
    typeof obj.campaignId === "string" &&
    typeof obj.recipientId === "string" &&
    obj.status === "completed" &&
    typeof obj.duration === "number" &&
    Array.isArray(obj.responses)
  );
}

export function isCampaignCompletedEvent(
  data: unknown,
): data is CampaignCompletedWebhookData {
  if (typeof data !== "object" || data === null) return false;
  const obj = data as Record<string, unknown>;
  return (
    typeof obj.campaignId === "string" &&
    typeof obj.campaignName === "string" &&
    typeof obj.completedAt === "string"
  );
}
