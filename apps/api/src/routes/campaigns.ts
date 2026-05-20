import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { asJson } from '../utils/prisma.js';

const campaignSchema = z.object({
  name: z.string().min(1).max(256),
  type: z.enum(['event-triggered', 'scheduled', 'recurring', 'voice']),
  status: z.enum(['draft', 'active', 'paused', 'completed']).default('draft'),
  trigger: z.record(z.unknown()).optional().default({}),
  rules: z.record(z.unknown()).optional().default({}),
  channels: z.array(z.string()).default([]),
  templateId: z.string().optional(),
  aiConfig: z.record(z.unknown()).optional().default({}),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

const campaignsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  fastify.get('/', async (request) => {
    return fastify.prisma.campaign.findMany({
      where: { tenantId: request.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  });

  fastify.post('/', async (request, reply) => {
    const body = campaignSchema.parse(request.body);
    const campaign = await fastify.prisma.campaign.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        type: body.type,
        status: body.status,
        trigger: asJson(body.trigger),
        rules: asJson(body.rules),
        channels: body.channels,
        aiConfig: asJson(body.aiConfig),
        ...(body.templateId ? { templateId: body.templateId } : {}),
        ...(body.startAt ? { startAt: new Date(body.startAt) } : {}),
        ...(body.endAt ? { endAt: new Date(body.endAt) } : {}),
      },
    });
    return reply.status(201).send(campaign);
  });

  fastify.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { runs: { orderBy: { startedAt: 'desc' }, take: 10 } },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    return campaign;
  });

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = campaignSchema.partial().parse(request.body);
    const existing = await fastify.prisma.campaign.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!existing) return reply.status(404).send({ error: 'Not found' });

    const campaign = await fastify.prisma.campaign.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.type ? { type: body.type } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.trigger ? { trigger: asJson(body.trigger) } : {}),
        ...(body.rules ? { rules: asJson(body.rules) } : {}),
        ...(body.channels ? { channels: body.channels } : {}),
        ...(body.aiConfig ? { aiConfig: asJson(body.aiConfig) } : {}),
        ...(body.templateId ? { templateId: body.templateId } : {}),
        ...(body.startAt ? { startAt: new Date(body.startAt) } : {}),
        ...(body.endAt ? { endAt: new Date(body.endAt) } : {}),
      },
    });
    return campaign;
  });

  // Manually trigger a campaign run
  fastify.post('/:id/trigger', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.campaign.findFirst({ where: { id, tenantId: request.tenantId } });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    if (campaign.status !== 'active') return reply.status(409).send({ error: 'Campaign must be active to trigger' });

    const run = await fastify.prisma.campaignRun.create({
      data: {
        campaignId: id,
        triggeredBy: 'api',
        status: 'pending',
        stats: asJson({}),
      },
    });
    return reply.status(202).send({ runId: run.id, status: 'pending' });
  });
};

export default campaignsRoutes;
