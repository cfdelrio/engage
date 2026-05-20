import type { Redis } from 'ioredis';
import { REDIS_KEYS } from '@engage/core';

const DEDUP_TTL_SECONDS = 86400; // 24h

export async function isDuplicate(redis: Redis, idempotencyKey: string): Promise<boolean> {
  const key = REDIS_KEYS.eventDedup(idempotencyKey);
  const result = await redis.set(key, '1', 'EX', DEDUP_TTL_SECONDS, 'NX');
  // NX → only set if not exists. Returns null if key already existed.
  return result === null;
}
