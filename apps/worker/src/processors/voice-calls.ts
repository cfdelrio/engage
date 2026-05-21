import type { Job } from "bullmq";
import { PrismaClient } from "@engage/database";
import twilio from "twilio";
import Handlebars from "handlebars";

interface DtmfOption {
  key: string;
  label: string;
}

interface DtmfConfig {
  enabled: boolean;
  options?: DtmfOption[];
}

interface VoiceCallJob {
  voiceCallId: string;
  voiceCampaignId: string;
  userId: string;
  phone: string;
  script: string;
  languageCode: string;
  voiceGender: "male" | "female";
  dtmfConfig?: DtmfConfig;
  attempt: number;
}

const prisma = new PrismaClient();

export async function processVoiceCall(job: Job<VoiceCallJob>) {
  const {
    voiceCallId,
    voiceCampaignId: _voiceCampaignId,
    userId,
    phone,
    script,
    languageCode,
    voiceGender,
    dtmfConfig,
    attempt,
  } = job.data;

  console.log(
    `[voice-calls] Processing call ${voiceCallId}, attempt ${attempt + 1}`,
  );

  try {
    // Fetch call and user
    const [voiceCall, user] = await Promise.all([
      prisma.voiceCall.findUniqueOrThrow({ where: { id: voiceCallId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);

    // Render script with user variables
    let renderedScript = script;
    try {
      const template = Handlebars.compile(script);
      const metadata = (user.metadata as Record<string, unknown>) || {};
      renderedScript = template({
        user: {
          firstName: user.externalId?.split("-")[0] || "usuario",
          email: user.email,
          phone: user.phone,
          ...metadata,
        },
      });
    } catch (err) {
      console.error(`[voice-calls] Failed to render script: ${err}`);
    }

    // Get Twilio credentials from ChannelProvider config
    const provider = await prisma.channelProvider.findFirst({
      where: {
        tenantId: voiceCall.tenantId,
        channel: "voice",
        isActive: true,
      },
    });

    if (!provider) {
      throw new Error("No active Twilio voice provider configured");
    }

    // Decrypt config (simplified - in production use proper decryption)
    const config = JSON.parse(provider.configEncrypted);
    const client = twilio(config.accountSid, config.authToken);

    // Generate TwiML
    const twiml = generateTwiML(
      renderedScript,
      languageCode,
      voiceGender,
      dtmfConfig,
    );

    // Make the call
    const call = await client.calls.create({
      from: config.from,
      to: phone,
      twiml,
      statusCallback: `${process.env["INTERNAL_API_URL"] || "http://localhost:3001"}/webhooks/twilio/voice`,
      statusCallbackMethod: "POST",
      statusCallbackEvent: [
        "initiated",
        "ringing",
        "answered",
        "completed",
        "no-answer",
        "busy",
        "failed",
      ],
      record: true,
      recordingStatusCallback: `${process.env["INTERNAL_API_URL"] || "http://localhost:3001"}/webhooks/twilio/recording`,
      recordingStatusCallbackMethod: "POST",
    });

    // Update voice call with Twilio SID
    await prisma.voiceCall.update({
      where: { id: voiceCallId },
      data: {
        twilioCallSid: call.sid,
        status: "ringing",
        startedAt: new Date(),
      },
    });

    console.log(`[voice-calls] Call initiated: ${call.sid}`);
  } catch (err) {
    console.error(`[voice-calls] Error processing call: ${err}`);

    if (attempt < 3) {
      const delayMs = attempt === 0 ? 60000 : attempt === 1 ? 300000 : 1800000; // 1m, 5m, 30m
      throw new Error(`Retryable error: ${err}. Retry in ${delayMs / 1000}s`);
    } else {
      // Max retries exceeded
      await prisma.voiceCall.update({
        where: { id: voiceCallId },
        data: {
          status: "failed",
          terminationReason: "max_retries",
          errorMessage: String(err),
        },
      });
    }
  }
}

function generateTwiML(
  script: string,
  languageCode: string,
  voiceGender: "male" | "female",
  dtmfConfig?: DtmfConfig,
): string {
  const voice = voiceGender === "male" ? "man" : "woman";
  const escaped = script
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

  let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${languageCode}" voice="${voice}">${escaped}</Say>`;

  if (dtmfConfig?.enabled) {
    const options = dtmfConfig.options ?? [];
    twiml +=
      '\n  <Gather numDigits="1" action="' +
      (process.env["INTERNAL_API_URL"] || "http://localhost:3001") +
      '/webhooks/twilio/gather" method="POST">';
    for (const opt of options) {
      twiml += `\n    <Say language="${languageCode}" voice="${voice}">Presione ${opt.key} para ${opt.label}</Say>`;
    }
    twiml += "\n  </Gather>";
  }

  twiml += "\n</Response>";
  return twiml;
}
