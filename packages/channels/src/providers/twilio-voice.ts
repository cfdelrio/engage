import twilio from 'twilio';
import type { ChannelProvider } from '../provider.interface.js';
import type { DeliveryPayload, ProviderResult, DeliveryEvent } from '@engage/core';

export class TwilioVoiceProvider implements ChannelProvider {
  readonly channel = 'voice' as const;
  readonly providerName = 'twilio_voice';
  private client: ReturnType<typeof twilio>;
  private from: string;

  constructor(accountSid: string, authToken: string, from: string) {
    this.client = twilio(accountSid, authToken);
    this.from = from;
  }

  async send(payload: DeliveryPayload): Promise<ProviderResult> {
    try {
      const twimlUrl = `${process.env['API_BASE_URL']}/voice/twiml/${payload.deliveryId}`;
      const call = await this.client.calls.create({
        from: this.from,
        to: payload.to,
        url: twimlUrl,
        statusCallback: `${process.env['API_BASE_URL']}/webhooks/twilio/voice`,
        statusCallbackMethod: 'POST',
        statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
      });
      return { success: true, providerMessageId: call.sid };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async validateConfig(_config: Record<string, unknown>): Promise<boolean> {
    return true;
  }

  parseWebhook(body: unknown, _headers: Record<string, string>): DeliveryEvent[] {
    const form = body as Record<string, string>;
    const callSid = form['CallSid'];
    const status = form['CallStatus'];
    if (!callSid || !status) return [];

    const statusMap: Record<string, string> = {
      completed: 'delivered',
      'no-answer': 'failed',
      busy: 'failed',
      failed: 'failed',
    };

    const mapped = statusMap[status];
    if (!mapped) return [];

    return [
      {
        deliveryId: callSid,
        event: mapped as DeliveryEvent['event'],
        occurredAt: new Date(),
        data: { status, duration: form['CallDuration'] },
        rawWebhook: body,
      },
    ];
  }
}
