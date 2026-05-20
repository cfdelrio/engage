import fp from 'fastify-plugin';
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { sha256, REDIS_KEYS } from '@engage/core';

declare module 'fastify' {
  interface FastifyRequest {
    tenantId: string;
    tenantSlug: string;
  }
}

const API_KEY_CACHE_TTL = 300; // 5 min

const apiKeyAuthPlugin: FastifyPluginAsync = fp(async (fastify) => {
  fastify.decorateRequest('tenantId', '');
  fastify.decorateRequest('tenantSlug', '');

  fastify.decorate(
    'authenticateApiKey',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const rawKey =
        request.headers['x-api-key'] as string | undefined ??
        request.headers['authorization']?.replace('Bearer ', '');

      if (!rawKey) {
        return reply.status(401).send({ error: 'Missing API key' });
      }

      const keyHash = sha256(rawKey);
      const cacheKey = REDIS_KEYS.apiKeyCache(keyHash);

      // Try cache first
      const cached = await fastify.redis.get(cacheKey);
      if (cached) {
        const data = JSON.parse(cached) as { tenantId: string; slug: string };
        request.tenantId = data.tenantId;
        request.tenantSlug = data.slug;
        return;
      }

      // DB lookup
      const apiKey = await fastify.prisma.tenantApiKey.findUnique({
        where: { keyHash },
        include: { tenant: { select: { id: true, slug: true } } },
      });

      if (!apiKey || apiKey.revokedAt) {
        return reply.status(401).send({ error: 'Invalid API key' });
      }

      // Cache the result
      await fastify.redis.setex(
        cacheKey,
        API_KEY_CACHE_TTL,
        JSON.stringify({ tenantId: apiKey.tenantId, slug: apiKey.tenant.slug }),
      );

      // Update lastUsedAt async (fire-and-forget)
      fastify.prisma.tenantApiKey
        .update({ where: { id: apiKey.id }, data: { lastUsedAt: new Date() } })
        .catch(() => {});

      request.tenantId = apiKey.tenantId;
      request.tenantSlug = apiKey.tenant.slug;
    },
  );
});

declare module 'fastify' {
  interface FastifyInstance {
    authenticateApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void>;
  }
}

export default apiKeyAuthPlugin;
