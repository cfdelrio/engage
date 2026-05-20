export const FEATURE_FLAGS = {
  // Event Pipeline
  EVENT_DEDUPLICATION: 'event_deduplication',
  EVENT_REPLAY: 'event_replay',

  // Rules Engine
  RULES_ENGINE_V2: 'rules_engine_v2',
  RULE_CONDITIONAL_ACTIONS: 'rule_conditional_actions',

  // AI Features
  AI_ENGAGEMENT_DECISIONS: 'ai_engagement_decisions',
  AI_COPY_GENERATION: 'ai_copy_generation',
  AI_SENTIMENT_ANALYSIS: 'ai_sentiment_analysis',

  // Channels
  WHATSAPP_CHANNEL: 'whatsapp_channel',
  PUSH_CHANNEL: 'push_channel',
  VOICE_CAMPAIGNS: 'voice_campaigns',

  // Voice-specific
  VOICE_AI_GENERATION: 'voice_ai_generation',
  VOICE_SENTIMENT_ANALYSIS: 'voice_sentiment_analysis',
  VOICE_TRANSCRIPTION: 'voice_transcription',
  VOICE_CALLBACK_WORKFLOWS: 'voice_callback_workflows',

  // Analytics
  ANALYTICS_V2: 'analytics_v2',
  ADVANCED_METRICS: 'advanced_metrics',

  // Feeds
  PUBLIC_FEEDS: 'public_feeds',
  FEED_ENGAGEMENT: 'feed_engagement',
} as const;

export type FeatureFlag = (typeof FEATURE_FLAGS)[keyof typeof FEATURE_FLAGS];

export function getFeatureFlagKey(flag: FeatureFlag, tenantId?: string): string {
  if (tenantId) {
    return `ff:${flag}:${tenantId}`;
  }
  return `ff:${flag}`;
}
