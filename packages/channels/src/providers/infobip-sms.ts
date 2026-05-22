import type { ChannelProvider } from "../provider.interface.js";
import type {
  DeliveryPayload,
  ProviderResult,
  DeliveryEvent,
} from "@engage/core";

export class InfobipSMSProvider implements ChannelProvider {
  readonly channel = "sms" as const;
  readonly providerName = "infobip_sms";
  private apiKey: string;
  private baseUrl: string;
  private from: string;

  constructor(apiKey: string, baseUrl: string, from: string) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.from = from;
  }

  async send(payload: DeliveryPayload): Promise<ProviderResult> {
    try {
      const res = await fetch(`${this.baseUrl}/sms/2/text/advanced`, {
        method: "POST",
        headers: {
          Authorization: `App ${this.apiKey}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              from: this.from,
              destinations: [{ to: payload.to }],
              text: payload.body,
            },
          ],
        }),
      });

      const data = (await res.json()) as Record<string, unknown>;

      if (!res.ok) {
        const err = (
          data["requestError"] as Record<string, unknown> | undefined
        )?.["serviceException"] as Record<string, unknown> | undefined;
        return {
          success: false,
          error: String(err?.["text"] ?? res.statusText),
        };
      }

      const messages = data["messages"] as
        | Array<Record<string, unknown>>
        | undefined;
      const messageId = messages?.[0]?.["messageId"] as string | undefined;
      return { success: true, providerMessageId: messageId };
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
    const results = event["results"] as
      | Array<Record<string, unknown>>
      | undefined;
    if (!results?.length) return [];

    return results.flatMap((r) => {
      const messageId = r["messageId"] as string | undefined;
      const status = (r["status"] as Record<string, unknown> | undefined)?.[
        "groupName"
      ] as string | undefined;
      if (!messageId || !status) return [];

      const statusMap: Record<string, string> = {
        DELIVERED: "delivered",
        UNDELIVERABLE: "failed",
        REJECTED: "failed",
        PENDING: "sent",
      };
      const mapped = statusMap[status];
      if (!mapped) return [];

      return [
        {
          deliveryId: messageId,
          event: mapped as DeliveryEvent["event"],
          occurredAt: new Date(),
          data: { status },
          rawWebhook: body,
        },
      ];
    });
  }
}
