import crypto from "node:crypto";

/**
 * Timing-safe equality check that handles unequal lengths without leaking info.
 */
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verify a Svix-style webhook signature (used by Resend, Clerk, and others
 * built on top of Svix). Returns true if any of the signatures in the header
 * matches the expected HMAC-SHA256 of `${id}.${timestamp}.${body}`.
 *
 * Reference: https://docs.svix.com/receiving/verifying-payloads/how-manual
 */
export interface SvixVerifyParams {
  rawBody: Buffer | string;
  headers: Record<string, string | string[] | undefined>;
  secret: string;
  toleranceSeconds?: number;
}

export function verifySvixSignature(params: SvixVerifyParams): boolean {
  const { rawBody, headers, secret, toleranceSeconds = 300 } = params;

  const getHeader = (name: string): string | undefined => {
    const value = headers[name] ?? headers[name.toLowerCase()];
    if (Array.isArray(value)) return value[0];
    return value;
  };

  const svixId = getHeader("svix-id");
  const svixTimestamp = getHeader("svix-timestamp");
  const svixSignature = getHeader("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) return false;

  const timestamp = parseInt(svixTimestamp, 10);
  if (Number.isNaN(timestamp)) return false;

  const nowSeconds = Math.floor(Date.now() / 1000);
  if (Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;

  const secretBytes = secret.startsWith("whsec_")
    ? Buffer.from(secret.slice("whsec_".length), "base64")
    : Buffer.from(secret, "utf8");

  const bodyBuffer =
    typeof rawBody === "string" ? Buffer.from(rawBody, "utf8") : rawBody;
  const signedPayload = Buffer.concat([
    Buffer.from(`${svixId}.${svixTimestamp}.`, "utf8"),
    bodyBuffer,
  ]);

  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(signedPayload)
    .digest("base64");

  const candidateSignatures = svixSignature.split(" ");
  for (const candidate of candidateSignatures) {
    const [version, signature] = candidate.split(",");
    if (version !== "v1" || !signature) continue;
    if (safeEqual(signature, expected)) return true;
  }

  return false;
}

/**
 * Verify a Twilio webhook signature. For form-encoded POSTs, Twilio signs the
 * full URL concatenated with sorted form params (`key1value1key2value2...`).
 * For JSON bodies, Twilio signs the full URL concatenated with the raw body.
 *
 * Reference: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
export interface TwilioVerifyParams {
  url: string;
  authToken: string;
  signature: string | undefined;
  params?: Record<string, string>;
  rawBody?: string;
}

export function verifyTwilioSignature(params: TwilioVerifyParams): boolean {
  const { url, authToken, signature, params: formParams, rawBody } = params;
  if (!signature) return false;

  let signedPayload: string;
  if (formParams) {
    const sortedKeys = Object.keys(formParams).sort();
    signedPayload =
      url + sortedKeys.map((k) => k + (formParams[k] ?? "")).join("");
  } else if (rawBody !== undefined) {
    signedPayload = url + rawBody;
  } else {
    signedPayload = url;
  }

  const expected = crypto
    .createHmac("sha1", authToken)
    .update(signedPayload)
    .digest("base64");
  return safeEqual(signature, expected);
}
