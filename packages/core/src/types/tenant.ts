export type TenantPlan = 'starter' | 'growth' | 'enterprise';

export interface TenantBrandingConfig {
  primaryColor?: string;
  logoUrl?: string;
  displayName?: string;
  supportEmail?: string;
}

export interface TenantAIConfig {
  provider: AIProviderName;
  model: string;
  temperature: number;
  toneInstructions: string;
  enabled: boolean;
}

export type AIProviderName = 'anthropic' | 'openai' | 'gemini' | 'mistral' | 'ollama' | 'mock';

export interface TenantSettings {
  aiConfig?: TenantAIConfig;
  defaultTimezone?: string;
  defaultLocale?: string;
  maxFrequencyPerDay?: number;
  maxFrequencyPerHour?: number;
}
