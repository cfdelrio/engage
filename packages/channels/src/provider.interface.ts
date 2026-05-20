import type { Channel, DeliveryPayload, ProviderResult, DeliveryEvent } from '@engage/core';

export interface ChannelProvider {
  readonly channel: Channel;
  readonly providerName: string;
  send(payload: DeliveryPayload): Promise<ProviderResult>;
  validateConfig(config: Record<string, unknown>): Promise<boolean>;
  parseWebhook(body: unknown, headers: Record<string, string>): DeliveryEvent[];
}
