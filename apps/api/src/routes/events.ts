import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { isDuplicate, getQueue, QUEUES } from '@engage/event-bus';
import { asJson } from '../utils/prisma.js';

interface EventJobPayload { eventId: string; tenantId: string; userId: string; type: string; }

const incomingEventSchema = z.object({
  type: z.string().min(1).max(128),
  userId: z.string().min(1).max(256),
  payload: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
  idempotencyKey: z.string().max(256).optional(),
  timestamp: z.string().datetime().optional(),
});

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  fastify.post(
    '/',
    {
      schema: {
        description: 'Ingest a single event',
        tags: ['events'],
        body: incomingEventSchema,
      },
    },
    async (request, reply) => {
      const body = incomingEventSchema.parse(request.body);
      const tenantId = request.tenantId;

      const idempotencyKey = body.idempotencyKey ?? `${tenantId}:${body.type}:${body.userId}:${body.timestamp ?? Date.now()}`;

      // Deduplication
      const duplicate = await isDuplicate(fastify.redis, idempotencyKey);
      if (duplicate) {
        return reply.status(409).send({ error: 'Duplicate event', idempotencyKey });
      }

      // Upsert user if not exists
      await fastify.prisma.user.upsert({
        where: { tenantId_externalId: { tenantId, externalId: body.userId } },
        update: {},
        create: {
          tenantId,
          externalId: body.userId,
          timezone: 'America/Argentina/Buenos_Aires',
          locale: 'es-AR',
        },
      });

      const user = await fastify.prisma.user.findUniqueOrThrow({
        where: { tenantId_externalId: { tenantId, externalId: body.userId } },
      });

      // Persist event
      const event = await fastify.prisma.event.create({
        data: {
          tenantId,
          type: body.type,
          userId: user.id,
          payload: asJson(body.payload),
          metadata: asJson(body.metadata),
          idempotencyKey,
          sourceIp: request.ip,
          receivedAt: body.timestamp ? new Date(body.timestamp) : new Date(),
        },
      });

      // Enqueue for processing
      const queue = getQueue(QUEUES.EVENTS_INCOMING);
      await queue.add(
        'process',
        {
          eventId: event.id,
          tenantId,
          userId: user.id,
          type: event.type,
        } satisfies EventJobPayload,
        { priority: 1 },
      );

      return reply.status(202).send({ eventId: event.id, status: 'queued' });
    },
  );

  fastify.get(
    '/:eventId',
    {
      schema: {
        description: 'Get event by ID',
        tags: ['events'],
        params: z.object({ eventId: z.string() }),
      },
    },
    async (request, reply) => {
      const { eventId } = request.params as { eventId: string };
      const event = await fastify.prisma.event.findFirst({
        where: { id: eventId, tenantId: request.tenantId },
        include: { processingLogs: true },
      });
      if (!event) return reply.status(404).send({ error: 'Event not found' });
      return event;
    },
  );
};

export default eventsRoutes;
