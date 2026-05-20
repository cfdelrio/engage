import type { Channel } from '@engage/core';
import type { ChannelProvider } from './provider.interface.js';

export class ChannelProviderRegistry {
  private providers = new Map<string, ChannelProvider>();

  register(provider: ChannelProvider): void {
    const key = `${provider.channel}:${provider.providerName}`;
    this.providers.set(key, provider);
  }

  resolve(channel: Channel, providerName: string): ChannelProvider | undefined {
    return this.providers.get(`${channel}:${providerName}`);
  }

  resolveDefault(channel: Channel): ChannelProvider | undefined {
    for (const [key, provider] of this.providers) {
      if (key.startsWith(`${channel}:`)) return provider;
    }
    return undefined;
  }
}
