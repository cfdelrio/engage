import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { Queue } from 'bullmq';
import { asJson } from '../utils/prisma.js';

const createSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().optional(),
  subject: z.string().min(1).max(998),
  bodyHtml: z.string().min(1),
  bodyText: z.string().optional(),
  fromName: z.string().optional(),
  fromEmail: z.string().email().optional(),
  replyTo: z.string().email().optional(),
  unsubscribeUrl: z.string().url().optional(),
  triggerType: z.enum(['manual', 'scheduled', 'rule-based', 'event-based']).default('manual'),
  aiGenerated: z.boolean().default(false),
  aiInstructions: z.string().optional(),
  audienceFilter: z.record(z.unknown()).optional().default({}),
  maxRetries: z.number().int().min(0).max(5).default(2),
  scheduledFor: z.string().datetime().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

const updateSchema = createSchema.partial();

const emailCampaignsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  // List campaigns
  fastify.get('/', async (request: FastifyRequest) => {
    return fastify.prisma.emailCampaign.findMany({
      where: { tenantId: request.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  });

  // Create campaign
  fastify.post('/', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createSchema.parse(request.body);
    const campaign = await fastify.prisma.emailCampaign.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        description: body.description,
        subject: body.subject,
        bodyHtml: body.bodyHtml,
        bodyText: body.bodyText,
        fromName: body.fromName,
        fromEmail: body.fromEmail,
        replyTo: body.replyTo,
        unsubscribeUrl: body.unsubscribeUrl,
        triggerType: body.triggerType,
        aiGenerated: body.aiGenerated,
        aiInstructions: body.aiInstructions,
        audienceFilter: asJson(body.audienceFilter),
        maxRetries: body.maxRetries,
        status: 'draft',
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
      },
    });
    return reply.status(201).send(campaign);
  });

  // Get campaign
  fastify.get('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.emailCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
      include: {
        deliveries: { orderBy: { createdAt: 'desc' }, take: 50 },
        metrics: { orderBy: { date: 'desc' }, take: 30 },
      },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    return campaign;
  });

  // Update campaign
  fastify.put('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateSchema.parse(request.body);

    const campaign = await fastify.prisma.emailCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    if (campaign.status === 'active') {
      return reply.status(400).send({ error: 'Cannot update an active campaign' });
    }

    const updated = await fastify.prisma.emailCampaign.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.subject && { subject: body.subject }),
        ...(body.bodyHtml && { bodyHtml: body.bodyHtml }),
        ...(body.bodyText !== undefined && { bodyText: body.bodyText }),
        ...(body.fromName !== undefined && { fromName: body.fromName }),
        ...(body.fromEmail !== undefined && { fromEmail: body.fromEmail }),
        ...(body.replyTo !== undefined && { replyTo: body.replyTo }),
        ...(body.unsubscribeUrl !== undefined && { unsubscribeUrl: body.unsubscribeUrl }),
        ...(body.triggerType && { triggerType: body.triggerType }),
        ...(body.aiGenerated !== undefined && { aiGenerated: body.aiGenerated }),
        ...(body.aiInstructions !== undefined && { aiInstructions: body.aiInstructions }),
        ...(body.audienceFilter && { audienceFilter: asJson(body.audienceFilter) }),
        ...(body.maxRetries !== undefined && { maxRetries: body.maxRetries }),
        ...(body.scheduledFor ? { scheduledFor: new Date(body.scheduledFor) } : {}),
        ...(body.startAt ? { startAt: new Date(body.startAt) } : {}),
        ...(body.endAt ? { endAt: new Date(body.endAt) } : {}),
      },
    });
    return updated;
  });

  // Delete campaign (draft only)
  fastify.delete('/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.emailCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    if (campaign.status !== 'draft') {
      return reply.status(400).send({ error: 'Can only delete draft campaigns' });
    }
    await fastify.prisma.emailCampaign.delete({ where: { id } });
    return reply.status(204).send();
  });

  // Start campaign
  fastify.post('/:id/start', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.emailCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    if (campaign.status !== 'draft' && campaign.status !== 'paused') {
      return reply.status(400).send({ error: 'Campaign must be draft or paused to start' });
    }

    // Update campaign status
    const updated = await fastify.prisma.emailCampaign.update({
      where: { id },
      data: { status: 'active', startAt: new Date() },
    });

    // Find users matching audience filter with email
    const users = await fastify.prisma.user.findMany({
      where: {
        tenantId: request.tenantId,
        email: { not: null },
      },
      take: 10000,
    });

    // Create EmailDelivery records and enqueue jobs
    const emailQueue = new Queue('email.messages', { connection: fastify.redis });

    let enqueuedCount = 0;
    for (const user of users) {
      if (!user.email) continue;

      const delivery = await fastify.prisma.emailDelivery.create({
        data: {
          emailCampaignId: id,
          tenantId: request.tenantId,
          userId: user.id,
          email: user.email,
          status: 'queued',
        },
      });

      await emailQueue.add(
        'send-email',
        {
          deliveryId: delivery.id,
          emailCampaignId: id,
          userId: user.id,
          email: user.email,
          subject: campaign.subject,
          bodyHtml: campaign.bodyHtml,
          bodyText: campaign.bodyText,
          fromName: campaign.fromName,
          fromEmail: campaign.fromEmail,
          replyTo: campaign.replyTo,
          unsubscribeUrl: campaign.unsubscribeUrl,
        },
        {
          attempts: campaign.maxRetries + 1,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        },
      );

      enqueuedCount++;
    }

    await emailQueue.close();

    return {
      ...updated,
      enqueuedCount,
      message: `${enqueuedCount} emails enqueued for sending`,
    };
  });

  // Pause campaign
  fastify.post('/:id/pause', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.emailCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    if (campaign.status !== 'active') {
      return reply.status(400).send({ error: 'Campaign must be active to pause' });
    }
    const updated = await fastify.prisma.emailCampaign.update({
      where: { id },
      data: { status: 'paused' },
    });
    return updated;
  });

  // Get deliveries
  fastify.get('/:id/deliveries', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const { limit = '50', status } = request.query as { limit?: string; status?: string };

    const campaign = await fastify.prisma.emailCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });

    const deliveries = await fastify.prisma.emailDelivery.findMany({
      where: {
        emailCampaignId: id,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(parseInt(limit, 10) || 50, 200),
    });
    return deliveries;
  });

  // Get metrics
  fastify.get('/:id/metrics', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const campaign = await fastify.prisma.emailCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });

    const stats = campaign.stats as Record<string, number>;
    const total = stats['sent'] ?? 0;

    return {
      stats: {
        sent: stats['sent'] ?? 0,
        delivered: stats['delivered'] ?? 0,
        opened: stats['opened'] ?? 0,
        clicked: stats['clicked'] ?? 0,
        bounced: stats['bounced'] ?? 0,
        failed: stats['failed'] ?? 0,
        openRate: total > 0 ? Math.round(((stats['opened'] ?? 0) / total) * 100) : 0,
        clickRate: total > 0 ? Math.round(((stats['clicked'] ?? 0) / total) * 100) : 0,
        deliveryRate: total > 0 ? Math.round(((stats['delivered'] ?? 0) / total) * 100) : 0,
      },
    };
  });
};

export default emailCampaignsRoutes;
