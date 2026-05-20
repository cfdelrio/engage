import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { asJson } from '../utils/prisma.js';

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  const upsertUserSchema = z.object({
    externalId: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    timezone: z.string().optional(),
    locale: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  fastify.post('/', async (request, reply) => {
    const body = upsertUserSchema.parse(request.body);
    const tenantId = request.tenantId;

    const user = await fastify.prisma.user.upsert({
      where: { tenantId_externalId: { tenantId, externalId: body.externalId } },
      update: {
        email: body.email,
        phone: body.phone,
        timezone: body.timezone,
        locale: body.locale,
        tags: body.tags,
        metadata: asJson(body.metadata ?? {}),
      },
      create: {
        tenantId,
        externalId: body.externalId,
        email: body.email,
        phone: body.phone,
        timezone: body.timezone ?? 'UTC',
        locale: body.locale ?? 'en',
        tags: body.tags ?? [],
        metadata: asJson(body.metadata ?? {}),
      },
    });

    return reply.status(201).send(user);
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await fastify.prisma.user.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { engagementScore: true, preferences: true },
    });
    if (!user) return reply.status(404).send({ error: 'User not found' });
    return user;
  });

  fastify.get('/:id/preferences', async (request) => {
    const { id } = request.params as { id: string };
    const prefs = await fastify.prisma.userPreference.findMany({
      where: { userId: id, tenantId: request.tenantId },
    });
    return prefs;
  });

  fastify.put('/:id/preferences', async (request) => {
    const { id } = request.params as { id: string };
    const prefsSchema = z.array(
      z.object({
        channel: z.string(),
        category: z.string().default('all'),
        enabled: z.boolean(),
        quietHoursStart: z.number().int().min(0).max(23).optional(),
        quietHoursEnd: z.number().int().min(0).max(23).optional(),
      }),
    );

    const prefs = prefsSchema.parse(request.body);
    const tenantId = request.tenantId;

    const results = await Promise.all(
      prefs.map((pref) =>
        fastify.prisma.userPreference.upsert({
          where: {
            userId_tenantId_channel_category: {
              userId: id,
              tenantId,
              channel: pref.channel,
              category: pref.category,
            },
          },
          update: {
            enabled: pref.enabled,
            ...(pref.quietHoursStart !== undefined ? { quietHoursStart: pref.quietHoursStart } : {}),
            ...(pref.quietHoursEnd !== undefined ? { quietHoursEnd: pref.quietHoursEnd } : {}),
          },
          create: {
            userId: id, tenantId,
            channel: pref.channel, category: pref.category, enabled: pref.enabled,
            ...(pref.quietHoursStart !== undefined ? { quietHoursStart: pref.quietHoursStart } : {}),
            ...(pref.quietHoursEnd !== undefined ? { quietHoursEnd: pref.quietHoursEnd } : {}),
          },
        }),
      ),
    );

    return results;
  });

  fastify.get('/:id/engagement', async (request) => {
    const { id } = request.params as { id: string };
    const [score, recentDeliveries] = await Promise.all([
      fastify.prisma.userEngagementScore.findUnique({ where: { userId: id } }),
      fastify.prisma.delivery.findMany({
        where: { userId: id, tenantId: request.tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    return { score, recentDeliveries };
  });
};

export default usersRoutes;
