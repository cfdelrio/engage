import { FastifyReply, FastifyRequest, FastifyInstance } from 'fastify';
import { getRateLimitRule } from '@engage/core';
import {
  getRateLimitCounterKey,
  getWindowStart,
  getResetTimestamp,
  normalizeEndpoint,
  calculateRateLimitResponse,
  RATE_LIMIT_LUA_SCRIPT,
} from '@engage/core';

declare module 'fastify' {
  interface FastifyRequest {
    apiKeyHash?: string;
  }
}

export async function rateLimitApiKeyPlugin(app: FastifyInstance) {
  const redis = app.redis;
  const logger = app.log;

  // Register Lua script
  let luaScriptSha: string = '';
  try {
    const result = await (redis as any).script('load', RATE_LIMIT_LUA_SCRIPT);
    luaScriptSha = typeof result === 'string' ? result : '';
  } catch (error) {
    logger.warn({ error }, 'Failed to load Lua script for rate limiting');
  }

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip rate limiting for health checks
    if (request.url === '/health') {
      return;
    }

    // Skip if no API key (unauthenticated requests will be rejected by auth plugin)
    if (!request.apiKeyHash) {
      return;
    }

    try {
      const now = Date.now();
      const method = request.method || 'GET';
      const path = request.url?.split('?')[0] || '/'; // Remove query string

      // Normalize endpoint
      const endpoint = normalizeEndpoint(method, path);

      // Get rate limit rule
      const rule = getRateLimitRule(method, path);
      const windowStart = getWindowStart(now, rule.windowSeconds);
      const resetAt = getResetTimestamp(windowStart, rule.windowSeconds);

      // Get Redis counter key
      const counterKey = getRateLimitCounterKey(request.apiKeyHash, endpoint, windowStart);

      // Check rate limit atomically
      let count: number;
      try {
        if (luaScriptSha) {
          count = await (redis as any).evalsha(
            luaScriptSha,
            1,
            counterKey,
            rule.limit,
            rule.windowSeconds
          );
        } else {
          // Fallback if Lua script not available
          const current = await redis.get(counterKey);
          count = current ? parseInt(current, 10) + 1 : 1;
          if (count === 1) {
            await redis.expire(counterKey, rule.windowSeconds);
          } else {
            await redis.incr(counterKey);
          }
        }
      } catch (redisError) {
        logger.warn(
          { error: redisError, apiKeyHash: request.apiKeyHash },
          'Redis error during rate limit check - allowing request'
        );
        // Fail-open: continue if Redis is unavailable
        return;
      }

      // Calculate response
      const result = calculateRateLimitResponse(count, rule.limit, resetAt, now);

      // Set rate limit headers
      reply.header('X-RateLimit-Limit', rule.limit);
      reply.header('X-RateLimit-Remaining', result.remaining);
      reply.header('X-RateLimit-Reset', Math.floor(resetAt / 1000));
      reply.header('X-RateLimit-Window-Seconds', rule.windowSeconds);

      // Check if rate limit exceeded
      if (!result.allowed) {
        logger.warn(
          {
            apiKeyHash: request.apiKeyHash,
            endpoint,
            limit: rule.limit,
            count,
          },
          'Rate limit exceeded'
        );

        reply.header('Retry-After', result.retryAfter);
        return reply.status(429).send({
          error: 'Too Many Requests',
          message: `Rate limit exceeded for ${endpoint}`,
          limit: rule.limit,
          resetAt: new Date(resetAt).toISOString(),
        });
      }
    } catch (error) {
      logger.error({ error }, 'Unexpected error in rate limit plugin - allowing request');
      // Fail-open: allow request if unexpected error
      return;
    }
  });
}
