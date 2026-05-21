export type EventStatus =
  | "received"
  | "processing"
  | "processed"
  | "failed"
  | "replayed";

export interface IncomingEvent {
  type: string;
  userId: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
  timestamp?: string;
}

export interface ProcessedEvent {
  id: string;
  tenantId: string;
  type: string;
  userId: string;
  payload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  receivedAt: Date;
  processedAt?: Date;
  replayedFrom?: string;
}

export interface EventContext {
  event: ProcessedEvent;
  user: UserContext;
  tenant: TenantContext;
}

export interface UserContext {
  id: string;
  externalId: string;
  email?: string;
  phone?: string;
  timezone: string;
  locale: string;
  tags: string[];
  fatigueScore: number;
  engagementScore: number;
  metadata: Record<string, unknown>;
  isActiveSession: boolean;
  lastSeenAt?: Date;
}

import type { TenantSettings } from "./tenant.js";

export interface TenantContext {
  id: string;
  slug: string;
  settings: TenantSettings;
}

// Well-known event types — tenants can define custom ones via EventDefinition
export const SYSTEM_EVENT_TYPES = {
  // Sports / Prode
  MATCH_STARTED: "match.started",
  MATCH_ENDED: "match.ended",
  GOAL_SCORED: "match.goal_scored",
  RANKING_CHANGED: "prode.ranking.changed",
  USER_OVERTAKEN: "prode.user_overtaken",
  NEW_LEADER: "prode.new_leader",
  ROUND_CLOSED: "prode.round_closed",
  ROUND_OPENED: "prode.round_opened",
  // Engagement
  USER_INACTIVE: "user.inactive",
  USER_RETURNED: "user.returned",
  PAYMENT_PENDING: "user.payment_pending",
  POLL_VOTED: "poll.voted",
  // System
  LIVE_FEED_UPDATED: "feed.updated",
} as const;

export type SystemEventType =
  (typeof SYSTEM_EVENT_TYPES)[keyof typeof SYSTEM_EVENT_TYPES];
