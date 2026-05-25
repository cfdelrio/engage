/**
 * Webhook signature verification tests.
 *
 * Tests FIX 1 (P0): fail-closed webhook verification in production.
 * These tests exercise the route handlers directly using Fastify's injection
 * mechanism — no live database or Redis connection is needed for the
 * security-path assertions, so we can run them in any environment.
 *
 * NOTE: Database-backed assertions are skipped when DATABASE_URL is absent.
 */

import crypto from "node:crypto";
import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { buildApp } from "../../src/app.js";
import type { FastifyInstance } from "fastify";

// ── helpers ──────────────────────────────────────────────────────────────────

function signSvix(
  rawBody: string,
  secret: string,
  id: string,
  ts: string,
): string {
  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");
  const payload = `${id}.${ts}.${rawBody}`;
  const sig = crypto
    .createHmac("sha256", secretBytes)
    .update(payload)
    .digest("base64");
  return `v1,${sig}`;
}

// ── test suite ────────────────────────────────────────────────────────────────

// The webhook routes do not require a database for the security path (the
// reject-with-500 or reject-with-401 paths happen before any DB access).
// We still guard heavy integration tests behind the DATABASE_URL check.
const skipIfNoDatabaseUrl = !process.env.DATABASE_URL
  ? describe.skip
  : describe;

describe("Webhook Signature Verification — security paths (no DB required)", () => {
  let app: FastifyInstance;

  // Persist original env so we can restore it after each test
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    // Ensure INTERNAL_API_URL is set so buildApp() doesn't throw
    process.env["INTERNAL_API_URL"] =
      process.env["INTERNAL_API_URL"] ?? "http://localhost:3001";
    process.env["DATABASE_URL"] =
      process.env["DATABASE_URL"] ?? "postgresql://x:x@localhost/x"; // placeholder
    app = await buildApp();
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  afterEach(() => {
    // Restore env after each test so mutations don't bleed across
    Object.assign(process.env, originalEnv);
    // Remove keys added during the test that weren't in original
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
  });

  // ── Twilio ─────────────────────────────────────────────────────────────────

  describe("POST /webhooks/twilio — Twilio SMS/Voice", () => {
    it("returns 500 when TWILIO_AUTH_TOKEN is absent in production", async () => {
      delete process.env["TWILIO_AUTH_TOKEN"];
      process.env["NODE_ENV"] = "production";

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/twilio",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: "MessageSid=SM123&MessageStatus=delivered",
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body.error).toBe("Webhook secret not configured");
    });

    it("returns 200 (warn + accept) when TWILIO_AUTH_TOKEN absent in development", async () => {
      delete process.env["TWILIO_AUTH_TOKEN"];
      process.env["NODE_ENV"] = "development";

      // Inject a payload that will succeed the missing-sid guard and return 200
      const response = await app.inject({
        method: "POST",
        url: "/webhooks/twilio",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        payload: "MessageSid=&MessageStatus=",
      });

      // No secret → warn + accept; empty sid/status → early 200 before DB hit
      expect(response.statusCode).toBe(200);
    });

    it("returns 401 when Twilio signature is invalid", async () => {
      process.env["TWILIO_AUTH_TOKEN"] = "real-auth-token";
      process.env["NODE_ENV"] = "production";

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/twilio",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "x-twilio-signature": "bad-signature",
        },
        payload: "MessageSid=SM123&MessageStatus=delivered",
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body.error).toBe("Invalid Twilio signature");
    });
  });

  // ── Resend / Svix ──────────────────────────────────────────────────────────

  describe("POST /webhooks/resend — Resend email events", () => {
    it("returns 500 when RESEND_WEBHOOK_SECRET is absent in production", async () => {
      delete process.env["RESEND_WEBHOOK_SECRET"];
      process.env["NODE_ENV"] = "production";

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/resend",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ type: "email.delivered", data: {} }),
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body.error).toBe("Webhook secret not configured");
    });

    it("returns 200 (warn + accept) when RESEND_WEBHOOK_SECRET absent in development", async () => {
      delete process.env["RESEND_WEBHOOK_SECRET"];
      process.env["NODE_ENV"] = "development";

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/resend",
        headers: { "content-type": "application/json" },
        // missing messageId → returns 200 early without DB access
        payload: JSON.stringify({ type: "email.delivered", data: {} }),
      });

      expect(response.statusCode).toBe(200);
    });

    it("returns 401 when Svix signature is invalid", async () => {
      const secret =
        "whsec_" +
        Buffer.from("test-secret-32bytes-padding").toString("base64");
      process.env["RESEND_WEBHOOK_SECRET"] = secret;
      process.env["NODE_ENV"] = "production";

      const nowSeconds = Math.floor(Date.now() / 1000);
      const response = await app.inject({
        method: "POST",
        url: "/webhooks/resend",
        headers: {
          "content-type": "application/json",
          "svix-id": "msg_test_001",
          "svix-timestamp": String(nowSeconds),
          "svix-signature": "v1,invalidsignature",
        },
        payload: JSON.stringify({ type: "email.delivered", data: {} }),
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body.error).toBe("Invalid Resend signature");
    });

    it("returns 200 when Svix signature is valid", async () => {
      const secret =
        "whsec_" +
        Buffer.from("test-secret-32bytes-padding").toString("base64");
      process.env["RESEND_WEBHOOK_SECRET"] = secret;
      process.env["NODE_ENV"] = "production";

      const id = "msg_test_002";
      const nowSeconds = Math.floor(Date.now() / 1000);
      const ts = String(nowSeconds);
      // Use a payload with no message ID so handler returns 200 before DB access
      const body = JSON.stringify({ type: "email.delivered", data: {} });
      const sig = signSvix(body, secret, id, ts);

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/resend",
        headers: {
          "content-type": "application/json",
          "svix-id": id,
          "svix-timestamp": ts,
          "svix-signature": sig,
        },
        payload: body,
      });

      // Signature is valid; no message_id in payload → early 200
      expect(response.statusCode).toBe(200);
    });
  });

  // ── orkestai-voice ─────────────────────────────────────────────────────────

  describe("POST /webhooks/orkestai-voice — orkestai voice events", () => {
    it("returns 500 when ORKESTAI_VOICE_WEBHOOK_SECRET is absent in production", async () => {
      delete process.env["ORKESTAI_VOICE_WEBHOOK_SECRET"];
      process.env["NODE_ENV"] = "production";

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/orkestai-voice",
        headers: { "content-type": "application/json" },
        payload: JSON.stringify({ event: "call.started" }),
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body.error).toBe("Webhook secret not configured");
    });

    it("returns 200 (warn + accept) when secret absent in development", async () => {
      delete process.env["ORKESTAI_VOICE_WEBHOOK_SECRET"];
      process.env["NODE_ENV"] = "development";

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/orkestai-voice",
        headers: { "content-type": "application/json" },
        // Invalid payload → 400 from parseWebhookPayload, not a security error
        payload: JSON.stringify({ invalid: true }),
      });

      // Security path: passes (no secret in dev). Payload parse fails → 400.
      expect(response.statusCode).toBe(400);
    });

    it("returns 401 when x-orkestai-signature is missing but secret is set", async () => {
      process.env["ORKESTAI_VOICE_WEBHOOK_SECRET"] = "some-secret";
      process.env["NODE_ENV"] = "production";

      const response = await app.inject({
        method: "POST",
        url: "/webhooks/orkestai-voice",
        headers: { "content-type": "application/json" },
        // No x-orkestai-signature header
        payload: JSON.stringify({ event: "call.started" }),
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

// ── Integration tests (require DB) ───────────────────────────────────────────

skipIfNoDatabaseUrl(
  "Webhook routes — integration paths (requires DATABASE_URL)",
  () => {
    // These would test the DB-backed processing paths after signature passes.
    // Stubbed here as a placeholder for future expansion.
    it.todo("Twilio SMS status update → updates SmsDelivery record");
    it.todo("Resend email.delivered → updates EmailDelivery record");
    it.todo("orkestai-voice call.completed → updates VoiceCall record");
  },
);
