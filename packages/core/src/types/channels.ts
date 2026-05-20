export type Channel = 'email' | 'sms' | 'push' | 'whatsapp' | 'voice' | 'in_app';

export type DeliveryStatus =
  | 'queued'
  | 'sent'
  | 'delivered'
  | 'opened'
  | 'clicked'
  | 'converted'
  | 'failed'
  | 'unsubscribed'
  | 'bounced'
  | 'suppressed';

export interface DeliveryPayload {
  deliveryId: string;
  tenantId: string;
  userId: string;
  channel: Channel;
  provider: string;
  to: string; // email address, phone, device token
  subject?: string; // email
  body: string;
  bodyHtml?: string; // email
  metadata: Record<string, unknown>;
}

export interface ProviderResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  rawResponse?: unknown;
}

export type ProviderName =
  | 'resend'
  | 'twilio_sms'
  | 'twilio_whatsapp'
  | 'twilio_voice'
  | 'firebase_fcm'
  | 'infobip';

export interface DeliveryEvent {
  deliveryId: string;
  event: DeliveryStatus;
  occurredAt: Date;
  data: Record<string, unknown>;
  rawWebhook?: unknown;
}
