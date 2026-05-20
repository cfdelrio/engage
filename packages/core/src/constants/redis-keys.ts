export const REDIS_KEYS = {
  eventDedup: (key: string) => `event:dedup:${key}`,
  frequencyCap: (tenantId: string, userId: string, channel: string) =>
    `fc:${tenantId}:${userId}:${channel}`,
  featureFlag: (flag: string, tenantId?: string) =>
    tenantId ? `ff:${flag}:${tenantId}` : `ff:${flag}`,
  aiProvider: (tenantId: string) => `ai:provider:${tenantId}`,
  tenantCache: (tenantId: string) => `tenant:${tenantId}`,
  apiKeyCache: (keyHash: string) => `apikey:${keyHash}`,
  eventStream: (tenantId: string) => `events:stream:${tenantId}`,
} as const;
