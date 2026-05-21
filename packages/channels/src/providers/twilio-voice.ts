import twilio from "twilio";
import Handlebars from "handlebars";
import type { ChannelProvider } from "../provider.interface.js";
import type {
  DeliveryPayload,
  ProviderResult,
  DeliveryEvent,
} from "@engage/core";

interface DtmfOption {
  key: string;
  label: string;
}

interface DtmfConfig {
  enabled: boolean;
  options?: DtmfOption[];
}

interface VoicePayload extends DeliveryPayload {
  script: string;
  languageCode?: string;
  voiceGender?: "male" | "female";
  dtmfConfig?: DtmfConfig;
  recordingUrl?: string;
}

export class TwilioVoiceProvider implements ChannelProvider {
  readonly channel = "voice" as const;
  readonly providerName = "twilio_voice";
  private client: ReturnType<typeof twilio>;
  private from: string;

  constructor(accountSid: string, authToken: string, from: string) {
    this.client = twilio(accountSid, authToken);
    this.from = from;
  }

  async send(payload: VoicePayload): Promise<ProviderResult> {
    try {
      const twimlUrl = `${process.env["INTERNAL_API_URL"] || "http://localhost:3001"}/v1/voice/twiml/${payload.deliveryId}`;
      const call = await this.client.calls.create({
        from: this.from,
        to: payload.to,
        url: twimlUrl,
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
      return { success: true, providerMessageId: call.sid };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  generateTwiML(
    script: string,
    languageCode: string = "es-ES",
    voiceGender: "male" | "female" = "female",
    dtmfConfig?: DtmfConfig,
  ): string {
    const voice = voiceGender === "male" ? "man" : "woman";
    let twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="${languageCode}" voice="${voice}">${this.escapeXml(script)}</Say>`;

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

  renderScript(script: string, variables: Record<string, unknown>): string {
    try {
      const template = Handlebars.compile(script);
      return template(variables);
    } catch (err) {
      console.error("Failed to render script:", err);
      return script;
    }
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  async validateConfig(config: Record<string, unknown>): Promise<boolean> {
    if (!config["accountSid"] || !config["authToken"] || !config["from"]) {
      return false;
    }
    try {
      const client = twilio(
        String(config["accountSid"]),
        String(config["authToken"]),
      );
      await client.api.accounts.list({ limit: 1 });
      return true;
    } catch {
      return false;
    }
  }

  parseWebhook(
    body: unknown,
    _headers: Record<string, string>,
  ): DeliveryEvent[] {
    const form = body as Record<string, string>;
    const callSid = form["CallSid"];

    if (!callSid) return [];

    const status = form["CallStatus"];
    const duration = parseInt(form["CallDuration"] || "0", 10);
    const recordingUrl = form["RecordingUrl"];

    const events: DeliveryEvent[] = [];

    if (status) {
      const statusMap: Record<string, DeliveryEvent["event"]> = {
        initiated: "queued",
        ringing: "queued",
        answered: "sent",
        completed: "delivered",
        "no-answer": "failed",
        busy: "failed",
        failed: "failed",
      };

      const mappedStatus = statusMap[status];
      if (mappedStatus) {
        events.push({
          deliveryId: callSid,
          event: mappedStatus,
          occurredAt: new Date(),
          data: {
            twilioStatus: status,
            duration,
            recordingUrl: recordingUrl ?? null,
            callSid,
          },
          rawWebhook: body,
        });
      }
    }

    if (recordingUrl) {
      events.push({
        deliveryId: callSid,
        event: "delivered",
        occurredAt: new Date(),
        data: {
          recordingUrl,
          duration: form["RecordingDuration"] ?? null,
          type: "recording_complete",
        },
        rawWebhook: body,
      });
    }

    return events;
  }

  parseGatherWebhook(body: unknown): Record<string, unknown> {
    const form = body as Record<string, string>;
    return {
      callSid: form["CallSid"],
      digits: form["Digits"],
      timestamp: new Date(),
    };
  }
}
