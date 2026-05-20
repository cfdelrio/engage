import type { AIProvider } from './provider.interface.js';
import type { AIProviderName } from '@engage/core';

export interface ProviderRegistryConfig {
  defaultProvider: AIProviderName;
  providers: Map<AIProviderName, AIProvider>;
  // Redis-based overrides resolved externally and passed in
  tenantOverrides?: Map<string, AIProviderName>;
}

export class AIProviderRegistry {
  private providers: Map<AIProviderName, AIProvider>;
  private defaultProvider: AIProviderName;
  private tenantOverrides: Map<string, AIProviderName>;

  constructor(config: ProviderRegistryConfig) {
    this.providers = config.providers;
    this.defaultProvider = config.defaultProvider;
    this.tenantOverrides = config.tenantOverrides ?? new Map();
  }

  resolve(tenantId: string, tenantConfigProvider?: AIProviderName): AIProvider {
    // Priority: 1. Tenant DB config → 2. Runtime override → 3. Global default
    const providerName =
      tenantConfigProvider ??
      this.tenantOverrides.get(tenantId) ??
      this.defaultProvider;

    const provider = this.providers.get(providerName);
    if (!provider) {
      const fallback = this.providers.get(this.defaultProvider);
      if (!fallback) throw new Error('No AI provider available');
      return fallback;
    }
    return provider;
  }

  register(name: AIProviderName, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  setTenantOverride(tenantId: string, providerName: AIProviderName): void {
    this.tenantOverrides.set(tenantId, providerName);
  }

  clearTenantOverride(tenantId: string): void {
    this.tenantOverrides.delete(tenantId);
  }
}
