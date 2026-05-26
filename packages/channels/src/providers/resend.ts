import { Resend } from "resend";
import type { ChannelProvider } from "../provider.interface.js";
import type {
  DeliveryPayload,
  ProviderResult,
  DeliveryEvent,
} from "@engage/core";

export class ResendEmailProvider implements ChannelProvider {
  readonly channel = "email" as const;
  readonly providerName = "resend";
  private client: Resend;
  private from: string;

  constructor(apiKey: string, from = "onboarding@resend.dev") {
    this.client = new Resend(apiKey);
    this.from = from;
  }

  async send(payload: DeliveryPayload): Promise<ProviderResult> {
    try {
      const emailPayload: Parameters<typeof this.client.emails.send>[0] = {
        from: this.from,
        to: payload.to,
        subject: payload.subject ?? "Notification",
        ...(payload.bodyHtml
          ? { html: payload.bodyHtml }
          : { text: payload.body }),
        headers: {
          "X-Engage-Delivery-Id": payload.deliveryId,
          "X-Engage-Tenant-Id": payload.tenantId,
        },
      };
      const result = await this.client.emails.send(emailPayload);

      if (result.error) {
        return { success: false, error: result.error.message };
      }

      return { success: true, providerMessageId: result.data?.id };
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
    const event = body as Record<string, unknown>;
    const type = event["type"] as string;
    const data = event["data"] as Record<string, unknown> | undefined;
    const messageId = (data?.["email_id"] ?? data?.["message_id"]) as
      | string
      | undefined;

    if (!messageId) return [];

    const statusMap: Record<string, string> = {
      "email.sent": "sent",
      "email.delivered": "delivered",
      "email.opened": "opened",
      "email.clicked": "clicked",
      "email.bounced": "bounced",
      "email.complained": "unsubscribed",
    };

    const status = statusMap[type];
    if (!status) return [];

    return [
      {
        deliveryId: messageId,
        event: status as DeliveryEvent["event"],
        occurredAt: new Date(),
        data: data ?? {},
        rawWebhook: body,
      },
    ];
  }
}
