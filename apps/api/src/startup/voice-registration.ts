import type { Redis } from "ioredis";

const REDIS_KEY = "engage:voice:service-credentials";

interface VoiceCredentials {
  apiKey: string;
  webhookSecret: string;
  tenantId: string;
  registeredAt: string;
}

export async function ensureVoiceServiceRegistration(
  redis: Redis,
): Promise<void> {
  const voiceApiUrl = process.env["ORKESTAI_VOICE_API_URL"];
  const sharedSecret = process.env["ORKESTAI_VOICE_SHARED_SECRET"];

  if (!voiceApiUrl || !sharedSecret) return;

  // Already have injected credentials from a previous run
  if (
    process.env["ORKESTAI_VOICE_API_KEY"] &&
    process.env["ORKESTAI_VOICE_TENANT_ID"]
  )
    return;

  // Check Redis cache
  const cached = await redis.get(REDIS_KEY);
  if (cached) {
    injectCredentials(JSON.parse(cached) as VoiceCredentials);
    console.log("[voice-registration] Loaded credentials from Redis cache");
    return;
  }

  // Register with orkestai-voice
  const apiBaseUrl = process.env["API_BASE_URL"];
  if (!apiBaseUrl) {
    console.warn(
      "[voice-registration] API_BASE_URL not set — skipping auto-registration",
    );
    return;
  }

  try {
    const res = await fetch(
      `${voiceApiUrl}/internal/service-accounts/register`,
      {
        method: "POST",
        headers: {
          "X-Shared-Secret": sharedSecret,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          serviceName: "orkestai-engage",
          webhookUrl: `${apiBaseUrl}/webhooks/orkestai-voice`,
          webhookEvents: ["call.completed", "campaign.completed"],
        }),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      console.error(
        `[voice-registration] Registration failed (${res.status}): ${text}`,
      );
      return;
    }

    const data = (await res.json()) as VoiceCredentials;
    const credentials: VoiceCredentials = {
      apiKey: data.apiKey,
      webhookSecret: data.webhookSecret,
      tenantId: data.tenantId,
      registeredAt: new Date().toISOString(),
    };

    await redis.set(REDIS_KEY, JSON.stringify(credentials));
    injectCredentials(credentials);
    console.log("[voice-registration] Auto-registration successful");
  } catch (err) {
    console.error("[voice-registration] Registration error:", err);
  }
}

function injectCredentials(creds: VoiceCredentials): void {
  process.env["ORKESTAI_VOICE_API_KEY"] = creds.apiKey;
  process.env["ORKESTAI_VOICE_WEBHOOK_SECRET"] = creds.webhookSecret;
  process.env["ORKESTAI_VOICE_TENANT_ID"] = creds.tenantId;
}
