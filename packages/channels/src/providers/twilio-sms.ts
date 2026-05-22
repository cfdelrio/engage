import twilio from "twilio";
import type { ChannelProvider } from "../provider.interface.js";
import type {
  DeliveryPayload,
  ProviderResult,
  DeliveryEvent,
} from "@engage/core";

export class TwilioSMSProvider implements ChannelProvider {
  readonly channel = "sms" as const;
  readonly providerName = "twilio_sms";
  private client: ReturnType<typeof twilio>;
  private from: string;

  constructor(accountSid: string, authToken: string, from: string) {
    this.client = twilio(accountSid, authToken);
    this.from = from;
  }

  async send(payload: DeliveryPayload): Promise<ProviderResult> {
    try {
      const baseUrl = process.env["API_BASE_URL"];
      const message = await this.client.messages.create({
        body: payload.body,
        from: this.from,
        to: payload.to,
        ...(baseUrl ? { statusCallback: `${baseUrl}/webhooks/twilio` } : {}),
      });
      return { success: true, providerMessageId: message.sid };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async validateConfig(_config: Record<string, unknown>): Promise<boolean> {
    return true;
  }

  parseWebhook(
    body: unknown,
    _headers: Record<string, string>,
  ): DeliveryEvent[] {
    const form = body as Record<string, string>;
    const messageSid = form["MessageSid"];
    const status = form["MessageStatus"];
    if (!messageSid || !status) return [];

    const statusMap: Record<string, string> = {
      sent: "sent",
      delivered: "delivered",
      undelivered: "failed",
      failed: "failed",
    };

    const mapped = statusMap[status];
    if (!mapped) return [];

    return [
      {
        deliveryId: messageSid,
        event: mapped as DeliveryEvent["event"],
        occurredAt: new Date(),
        data: { status },
        rawWebhook: body,
      },
    ];
  }
}
