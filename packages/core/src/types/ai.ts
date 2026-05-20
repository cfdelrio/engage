import type { Channel } from './channels.js';

export interface AICompletionRequest {
  systemPrompt: string;
  userPrompt: string;
  schema?: Record<string, unknown>;
  temperature?: number;
  maxTokens?: number;
  cacheControl?: boolean;
}

export interface AICompletionResponse {
  content: string;
  parsedContent?: unknown;
  usage: {
    inputTokens: number;
    outputTokens: number;
    cachedTokens?: number;
  };
  model: string;
  provider: string;
}

export interface AIDecision {
  shouldEngage: boolean;
  channel: Channel;
  channelConfidence: number;
  schedulingOffsetMinutes: number;
  copyVariants: CopyVariant[];
  reasoning: string;
  estimatedFatigueImpact: number;
}

export interface CopyVariant {
  id: string;
  subject?: string;
  body: string;
  tone: string;
  confidence: number;
}

// Re-exported via tenant.ts — do not redeclare here
