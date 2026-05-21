import crypto from "node:crypto";
import { describe, it, expect } from "vitest";
import {
  verifySvixSignature,
  verifyTwilioSignature,
} from "./webhook-verify.js";

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

function signTwilio(
  url: string,
  authToken: string,
  params: Record<string, string>,
): string {
  const sortedKeys = Object.keys(params).sort();
  const payload = url + sortedKeys.map((k) => k + (params[k] ?? "")).join("");
  return crypto.createHmac("sha1", authToken).update(payload).digest("base64");
}

describe("verifySvixSignature", () => {
  const secret =
    "whsec_" +
    Buffer.from("test-secret-32bytes-padding-aaaa").toString("base64");
  const id = "msg_2RJpwGmZxBR8WLfgg5aPMPGqXcU";
  const nowSeconds = Math.floor(Date.now() / 1000);
  const ts = String(nowSeconds);
  const body = '{"type":"email.delivered","data":{"email_id":"e_123"}}';

  it("accepts a valid signature", () => {
    const sig = signSvix(body, secret, id, ts);
    expect(
      verifySvixSignature({
        rawBody: body,
        headers: {
          "svix-id": id,
          "svix-timestamp": ts,
          "svix-signature": sig,
        },
        secret,
      }),
    ).toBe(true);
  });

  it("accepts when one of multiple signatures matches", () => {
    const sig = signSvix(body, secret, id, ts);
    expect(
      verifySvixSignature({
        rawBody: body,
        headers: {
          "svix-id": id,
          "svix-timestamp": ts,
          "svix-signature": `v1,bogus ${sig}`,
        },
        secret,
      }),
    ).toBe(true);
  });

  it("rejects tampered body", () => {
    const sig = signSvix(body, secret, id, ts);
    expect(
      verifySvixSignature({
        rawBody: body + "tampered",
        headers: {
          "svix-id": id,
          "svix-timestamp": ts,
          "svix-signature": sig,
        },
        secret,
      }),
    ).toBe(false);
  });

  it("rejects wrong secret", () => {
    const sig = signSvix(body, secret, id, ts);
    const otherSecret =
      "whsec_" +
      Buffer.from("different-secret-padding-32bytes").toString("base64");
    expect(
      verifySvixSignature({
        rawBody: body,
        headers: {
          "svix-id": id,
          "svix-timestamp": ts,
          "svix-signature": sig,
        },
        secret: otherSecret,
      }),
    ).toBe(false);
  });

  it("rejects expired timestamp outside tolerance", () => {
    const oldTs = String(nowSeconds - 3600); // 1h ago
    const sig = signSvix(body, secret, id, oldTs);
    expect(
      verifySvixSignature({
        rawBody: body,
        headers: {
          "svix-id": id,
          "svix-timestamp": oldTs,
          "svix-signature": sig,
        },
        secret,
      }),
    ).toBe(false);
  });

  it("rejects when required headers are missing", () => {
    expect(
      verifySvixSignature({
        rawBody: body,
        headers: { "svix-id": id, "svix-timestamp": ts },
        secret,
      }),
    ).toBe(false);
  });

  it("rejects unknown signature version", () => {
    const secretBytes = Buffer.from(secret.slice("whsec_".length), "base64");
    const sig = crypto
      .createHmac("sha256", secretBytes)
      .update(`${id}.${ts}.${body}`)
      .digest("base64");
    expect(
      verifySvixSignature({
        rawBody: body,
        headers: {
          "svix-id": id,
          "svix-timestamp": ts,
          "svix-signature": `v99,${sig}`,
        },
        secret,
      }),
    ).toBe(false);
  });
});

describe("verifyTwilioSignature", () => {
  const authToken = "test-twilio-auth-token";
  const url = "https://api.example.com/webhooks/twilio";
  const params = {
    MessageSid: "SM123abc",
    MessageStatus: "delivered",
    AccountSid: "AC456def",
  };

  it("accepts a valid signature", () => {
    const sig = signTwilio(url, authToken, params);
    expect(
      verifyTwilioSignature({
        url,
        authToken,
        signature: sig,
        params,
      }),
    ).toBe(true);
  });

  it("rejects when a param is changed", () => {
    const sig = signTwilio(url, authToken, params);
    expect(
      verifyTwilioSignature({
        url,
        authToken,
        signature: sig,
        params: { ...params, MessageStatus: "failed" },
      }),
    ).toBe(false);
  });

  it("rejects wrong auth token", () => {
    const sig = signTwilio(url, authToken, params);
    expect(
      verifyTwilioSignature({
        url,
        authToken: "other-token",
        signature: sig,
        params,
      }),
    ).toBe(false);
  });

  it("rejects when signature header missing", () => {
    expect(
      verifyTwilioSignature({
        url,
        authToken,
        signature: undefined,
        params,
      }),
    ).toBe(false);
  });

  it("rejects when URL differs (e.g. host header spoof)", () => {
    const sig = signTwilio(url, authToken, params);
    expect(
      verifyTwilioSignature({
        url: "https://evil.example.com/webhooks/twilio",
        authToken,
        signature: sig,
        params,
      }),
    ).toBe(false);
  });

  it("is order-insensitive for params (sorts alphabetically)", () => {
    const sig = signTwilio(url, authToken, params);
    const reordered: Record<string, string> = {};
    for (const key of Object.keys(params).reverse()) {
      reordered[key] = params[key as keyof typeof params];
    }
    expect(
      verifyTwilioSignature({
        url,
        authToken,
        signature: sig,
        params: reordered,
      }),
    ).toBe(true);
  });
});
