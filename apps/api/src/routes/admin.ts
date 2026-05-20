import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { generateApiKey } from '@engage/core';
import { REDIS_KEYS } from '@engage/core';
import { asJson } from '../utils/prisma.js';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Admin routes use the same API key auth — in production you'd add a separate JWT admin auth
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  // ─── Tenant ───────────────────────────────────────────────────────────────
  fastify.get('/tenant', async (request) => {
    return fastify.prisma.tenant.findUniqueOrThrow({
      where: { id: request.tenantId },
      select: { id: true, slug: true, name: true, plan: true, brandingConfig: true, settings: true, createdAt: true },
    });
  });

  fastify.put('/tenant', async (request) => {
    const body = z.object({
      name: z.string().optional(),
      brandingConfig: z.record(z.unknown()).optional(),
      settings: z.record(z.unknown()).optional(),
    }).parse(request.body);

    return fastify.prisma.tenant.update({
      where: { id: request.tenantId },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.brandingConfig ? { brandingConfig: asJson(body.brandingConfig) } : {}),
        ...(body.settings ? { settings: asJson(body.settings) } : {}),
      },
      select: { id: true, slug: true, name: true, plan: true, brandingConfig: true, settings: true },
    });
  });

  // ─── API Keys ─────────────────────────────────────────────────────────────
  fastify.get('/api-keys', async (request) => {
    return fastify.prisma.tenantApiKey.findMany({
      where: { tenantId: request.tenantId },
      select: { id: true, name: true, keyPrefix: true, permissions: true, lastUsedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  });

  fastify.post('/api-keys', async (request, reply) => {
    const body = z.object({
      name: z.string().min(1).max(128),
      permissions: z.array(z.string()).default(['events:write', 'users:read', 'users:write']),
    }).parse(request.body);

    const { raw, hash, prefix } = generateApiKey();

    await fastify.prisma.tenantApiKey.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        keyHash: hash,
        keyPrefix: prefix,
        permissions: asJson(body.permissions),
      },
    });

    // Return raw key once — never stored
    return reply.status(201).send({ key: raw, prefix, name: body.name, permissions: body.permissions });
  });

  fastify.delete('/api-keys/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const key = await fastify.prisma.tenantApiKey.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!key) return reply.status(404).send({ error: 'Not found' });

    await fastify.prisma.tenantApiKey.delete({ where: { id } });
    // Invalidate cache
    await fastify.redis.del(REDIS_KEYS.apiKeyCache(key.keyHash));
    return reply.status(204).send();
  });

  // ─── Channel Providers ────────────────────────────────────────────────────
  fastify.get('/providers', async (request) => {
    return fastify.prisma.channelProvider.findMany({
      where: { tenantId: request.tenantId },
      select: { id: true, channel: true, provider: true, isDefault: true, isActive: true, createdAt: true },
    });
  });

  fastify.post('/providers', async (request, reply) => {
    const body = z.object({
      channel: z.enum(['email', 'sms', 'push', 'whatsapp', 'voice']),
      provider: z.string().min(1),
      config: z.record(z.unknown()),
      isDefault: z.boolean().default(false),
    }).parse(request.body);

    // In production: encrypt config with AES-256-GCM before storing
    // For now store as JSON string (TODO: wire KMS encryption)
    const provider = await fastify.prisma.channelProvider.create({
      data: {
        tenantId: request.tenantId,
        channel: body.channel,
        provider: body.provider,
        configEncrypted: JSON.stringify(body.config),
        isDefault: body.isDefault,
        isActive: true,
      },
      select: { id: true, channel: true, provider: true, isDefault: true, isActive: true, createdAt: true },
    });
    return reply.status(201).send(provider);
  });

  // ─── Feature Flags ────────────────────────────────────────────────────────
  fastify.get('/feature-flags', async (request) => {
    const flags = ['ai_engagement_decisions', 'voice_campaigns', 'whatsapp_channel', 'analytics_v2', 'event_replay'];
    const tenantId = request.tenantId;
    const results = await Promise.all(
      flags.map(async (flag) => {
        const tenantVal = await fastify.redis.get(REDIS_KEYS.featureFlag(flag, tenantId));
        const globalVal = await fastify.redis.get(REDIS_KEYS.featureFlag(flag));
        return { flag, tenantOverride: tenantVal, global: globalVal, effective: tenantVal ?? globalVal };
      }),
    );
    return results;
  });

  fastify.put('/feature-flags/:flag', async (request) => {
    const { flag } = request.params as { flag: string };
    const { enabled, scope } = z.object({
      enabled: z.boolean(),
      scope: z.enum(['tenant', 'global']).default('tenant'),
    }).parse(request.body);

    const key = scope === 'tenant'
      ? REDIS_KEYS.featureFlag(flag, request.tenantId)
      : REDIS_KEYS.featureFlag(flag);

    if (enabled) {
      await fastify.redis.set(key, '1');
    } else {
      await fastify.redis.del(key);
    }

    return { flag, enabled, scope };
  });
};

export default adminRoutes;
