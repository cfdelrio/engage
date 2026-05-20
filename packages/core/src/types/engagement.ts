import type { Channel } from './channels.js';

export type DecisionType = 'send' | 'suppress' | 'delay' | 'digest';

export interface EngagementDecision {
  id: string;
  tenantId: string;
  eventId: string;
  userId: string;
  channel: Channel;
  decisionType: DecisionType;
  reasoning: EngagementReasoning;
  aiGenerated: boolean;
  confidence: number;
  priority: number;
  scheduledFor: Date;
}

export interface EngagementReasoning {
  ruleMatches: string[];
  aiSuggestion?: string;
  suppressionReason?: string;
  channelSelectionReason: string;
  timingReason: string;
}

export interface EngagementScore {
  score: number;
  fatigueScore: number;
  openRate30d: number;
  clickRate30d: number;
  lastCalculatedAt: Date;
}
