import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { asJson } from '../utils/prisma.js';

const feedsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  fastify.get('/', async (request) => {
    return fastify.prisma.publicFeed.findMany({
      where: { tenantId: request.tenantId },
    });
  });

  fastify.post('/', async (request, reply) => {
    const body = z.object({
      slug: z.string().min(1).max(128),
      name: z.string().min(1),
      type: z.string().default('activity'),
      isPublic: z.boolean().default(true),
      config: z.record(z.unknown()).optional().default({}),
    }).parse(request.body);

    const feed = await fastify.prisma.publicFeed.create({
      data: { tenantId: request.tenantId, ...body, config: asJson(body.config) },
    });

    return reply.status(201).send(feed);
  });

  fastify.get('/:slug/entries', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const feed = await fastify.prisma.publicFeed.findFirst({
      where: { slug, tenantId: request.tenantId },
    });
    if (!feed) return reply.status(404).send({ error: 'Feed not found' });

    const entries = await fastify.prisma.feedEntry.findMany({
      where: { feedId: feed.id, expiresAt: { gte: new Date() } },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      take: 50,
    });

    return entries;
  });

  fastify.post('/:slug/entries', async (request, reply) => {
    const { slug } = request.params as { slug: string };
    const feed = await fastify.prisma.publicFeed.findFirst({
      where: { slug, tenantId: request.tenantId },
    });
    if (!feed) return reply.status(404).send({ error: 'Feed not found' });

    const body = z.object({
      type: z.string(),
      content: z.record(z.unknown()),
      priority: z.number().int().default(0),
      expiresAt: z.string().datetime().optional(),
    }).parse(request.body);

    const entry = await fastify.prisma.feedEntry.create({
      data: {
        feedId: feed.id,
        type: body.type,
        content: asJson(body.content),
        priority: body.priority,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    });

    return reply.status(201).send(entry);
  });
};

export default feedsRoutes;
