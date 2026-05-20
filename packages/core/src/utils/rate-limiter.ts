import { createHash } from 'crypto';
import type { RateLimitRule } from '../constants/rate-limits.js';

// Note: hashApiKey is also exported from hash.js, using it from there instead
// This function would be: createHash('sha256').update(apiKey).digest('hex')

export function getRateLimitCounterKey(apiKeyHash: string, endpoint: string, windowStart: number): string {
  return `ratelimit:counter:${apiKeyHash}:${endpoint}:${windowStart}`;
}

export function getRateLimitStatsKey(apiKeyHash: string): string {
  return `ratelimit:stats:${apiKeyHash}`;
}

export function getRateLimitBlockKey(apiKeyHash: string): string {
  return `ratelimit:block:${apiKeyHash}`;
}

export function getWindowStart(now: number, windowSeconds: number): number {
  return Math.floor(now / 1000 / windowSeconds) * windowSeconds;
}

export function getResetTimestamp(windowStart: number, windowSeconds: number): number {
  return (windowStart + windowSeconds) * 1000;
}

export function normalizeEndpoint(method: string, path: string): string {
  // Normalize path by removing dynamic segments
  // /v1/events/123 → /v1/events
  // /v1/users/abc/preferences → /v1/users/preferences
  const pathParts = path.split('/').filter(p => p && !p.match(/^[a-f0-9-]+$/i));
  return `${method} ${pathParts.join('/')}`;
}

export interface RateLimitCheckResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter: number | undefined;
}

export function calculateRateLimitResponse(
  currentCount: number,
  limit: number,
  resetAt: number,
  now: number
): RateLimitCheckResult {
  const remaining = Math.max(0, limit - currentCount);
  const retryAfterSeconds = Math.ceil((resetAt - now) / 1000);

  return {
    allowed: currentCount <= limit,
    limit,
    remaining,
    resetAt,
    retryAfter: remaining === 0 ? retryAfterSeconds : undefined,
  };
}

// Lua script for atomic rate limit check
export const RATE_LIMIT_LUA_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])

local current = redis.call('GET', key)
local count = 0

if current then
  count = tonumber(current)
else
  count = 0
end

count = count + 1

if count == 1 then
  redis.call('EXPIRE', key, ttl)
else
  redis.call('INCR', key)
end

return count
`;
