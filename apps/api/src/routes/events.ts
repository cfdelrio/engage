import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { isDuplicate, getQueue, QUEUES } from "@engage/event-bus";
import { REDIS_KEYS } from "@engage/core";
import { asJson } from "../utils/prisma.js";

interface EventJobPayload {
  eventId: string;
  tenantId: string;
  userId: string;
  type: string;
}

const incomingEventSchema = z.object({
  type: z.string().min(1).max(128),
  userId: z.string().min(1).max(256),
  payload: z.record(z.unknown()).optional().default({}),
  metadata: z.record(z.unknown()).optional().default({}),
  idempotencyKey: z.string().max(256).optional(),
  timestamp: z.string().datetime().optional(),
});

const eventsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  fastify.post<{ Body: typeof incomingEventSchema }>(
    "/",
    {
      schema: {
        description: "Ingest a single event",
        tags: ["events"],
        body: incomingEventSchema,
        response: {
          202: z.object({
            eventId: z.string(),
            status: z.string(),
          }),
          409: z.object({
            error: z.string(),
            idempotencyKey: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const body = incomingEventSchema.parse(request.body);
      const tenantId = request.tenantId;

      const idempotencyKey =
        body.idempotencyKey ??
        `${tenantId}:${body.type}:${body.userId}:${body.timestamp ?? Date.now()}`;

      // Deduplication
      const duplicate = await isDuplicate(fastify.redis, idempotencyKey);
      if (duplicate) {
        return reply
          .status(409)
          .send({ error: "Duplicate event", idempotencyKey });
      }

      // Upsert user if not exists
      await fastify.prisma.user.upsert({
        where: { tenantId_externalId: { tenantId, externalId: body.userId } },
        update: {},
        create: {
          tenantId,
          externalId: body.userId,
          timezone: "America/Argentina/Buenos_Aires",
          locale: "es-AR",
        },
      });

      // Update contact data from metadata.user_contact if provided
      const userContact = (body.metadata as Record<string, unknown>)
        ?.user_contact as Record<string, unknown> | undefined;
      if (userContact) {
        const contactUpdate: Record<string, unknown> = {};
        if (userContact.email) contactUpdate.email = String(userContact.email);
        if (userContact.phone) contactUpdate.phone = String(userContact.phone);
        if (userContact.idioma_pref)
          contactUpdate.locale = String(userContact.idioma_pref);
        const metaUpdate: Record<string, unknown> = {};
        if (userContact.whatsapp_consent !== undefined)
          metaUpdate.whatsapp_consent = Boolean(userContact.whatsapp_consent);
        if (userContact.nombre) metaUpdate.nombre = String(userContact.nombre);
        await fastify.prisma.user.update({
          where: { tenantId_externalId: { tenantId, externalId: body.userId } },
          data: { ...contactUpdate, metadata: asJson(metaUpdate) },
        });
      }

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

      // Publish to WebSocket stream subscribers
      const streamPayload = JSON.stringify({
        id: event.id,
        type: event.type,
        userId: body.userId,
        tenantId,
        receivedAt: event.receivedAt,
      });
      fastify.redis
        .publish(REDIS_KEYS.eventStream(tenantId), streamPayload)
        .catch(() => {});

      // Enqueue for processing
      const queue = getQueue(QUEUES.EVENTS_INCOMING);
      await queue.add(
        "process",
        {
          eventId: event.id,
          tenantId,
          userId: user.id,
          type: event.type,
        } satisfies EventJobPayload,
        { priority: 1 },
      );

      return reply.status(202).send({ eventId: event.id, status: "queued" });
    },
  );

  fastify.post<{ Body: z.infer<typeof incomingEventSchema>[] }>(
    "/batch",
    {
      schema: {
        description: "Ingest multiple events in batch",
        tags: ["events"],
        body: z.array(incomingEventSchema),
        response: {
          202: z.object({
            batchId: z.string(),
            total: z.number(),
            succeeded: z.number(),
            failed: z.number(),
            events: z.array(
              z.object({
                eventId: z.string().optional(),
                userId: z.string(),
                status: z.enum(["queued", "duplicate", "error"]),
                error: z.string().optional(),
              }),
            ),
          }),
        },
      },
    },
    async (request, reply) => {
      const events = z.array(incomingEventSchema).parse(request.body);
      const tenantId = request.tenantId;
      const batchId = `batch_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

      const results = [];
      let succeeded = 0;
      let failed = 0;

      for (const eventData of events) {
        try {
          const idempotencyKey =
            eventData.idempotencyKey ??
            `${tenantId}:${eventData.type}:${eventData.userId}:${eventData.timestamp ?? Date.now()}`;

          const duplicate = await isDuplicate(fastify.redis, idempotencyKey);
          if (duplicate) {
            results.push({
              userId: eventData.userId,
              status: "duplicate",
              error: "Duplicate event",
            });
            failed++;
            continue;
          }

          await fastify.prisma.user.upsert({
            where: {
              tenantId_externalId: { tenantId, externalId: eventData.userId },
            },
            update: {},
            create: {
              tenantId,
              externalId: eventData.userId,
              timezone: "America/Argentina/Buenos_Aires",
              locale: "es-AR",
            },
          });

          const user = await fastify.prisma.user.findUniqueOrThrow({
            where: {
              tenantId_externalId: { tenantId, externalId: eventData.userId },
            },
          });

          const event = await fastify.prisma.event.create({
            data: {
              tenantId,
              type: eventData.type,
              userId: user.id,
              payload: asJson(eventData.payload),
              metadata: asJson({ ...eventData.metadata, batchId }),
              idempotencyKey,
              sourceIp: request.ip,
              receivedAt: eventData.timestamp
                ? new Date(eventData.timestamp)
                : new Date(),
            },
          });

          fastify.redis
            .publish(
              REDIS_KEYS.eventStream(tenantId),
              JSON.stringify({
                id: event.id,
                type: event.type,
                userId: eventData.userId,
                tenantId,
                receivedAt: event.receivedAt,
              }),
            )
            .catch(() => {});

          const queue = getQueue(QUEUES.EVENTS_INCOMING);
          await queue.add(
            "process",
            {
              eventId: event.id,
              tenantId,
              userId: user.id,
              type: event.type,
            } satisfies EventJobPayload,
            { priority: 1 },
          );

          results.push({
            eventId: event.id,
            userId: eventData.userId,
            status: "queued",
          });
          succeeded++;
        } catch (error) {
          results.push({
            userId: eventData.userId,
            status: "error",
            error: error instanceof Error ? error.message : "Unknown error",
          });
          failed++;
        }
      }

      return reply.status(202).send({
        batchId,
        total: events.length,
        succeeded,
        failed,
        events: results,
      });
    },
  );

  fastify.post<{ Params: { eventId: string } }>(
    "/:eventId/replay",
    {
      schema: {
        description: "Replay an event (create a copy and re-enqueue)",
        tags: ["events"],
        params: z.object({ eventId: z.string() }),
        response: {
          202: z.object({
            originalEventId: z.string(),
            replayEventId: z.string(),
            status: z.string(),
          }),
        },
      },
    },
    async (request, reply) => {
      const { eventId } = request.params;
      const tenantId = request.tenantId;

      const originalEvent = await fastify.prisma.event.findFirst({
        where: { id: eventId, tenantId },
      });

      if (!originalEvent) {
        return reply.status(404).send({ error: "Event not found" });
      }

      const replayMetadata: Record<string, unknown> = { replayedFrom: eventId };

      const replayedEvent = await fastify.prisma.event.create({
        data: {
          tenantId,
          type: originalEvent.type,
          userId: originalEvent.userId,
          payload: asJson(originalEvent.payload as Record<string, unknown>),
          metadata: asJson(replayMetadata),
          idempotencyKey: `replay_${eventId}_${Date.now()}`,
          sourceIp: request.ip,
          receivedAt: new Date(),
        },
      });

      fastify.redis
        .publish(
          REDIS_KEYS.eventStream(tenantId),
          JSON.stringify({
            id: replayedEvent.id,
            type: replayedEvent.type,
            replayedFrom: eventId,
            tenantId,
            receivedAt: replayedEvent.receivedAt,
          }),
        )
        .catch(() => {});

      const queue = getQueue(QUEUES.EVENTS_INCOMING);
      await queue.add(
        "process",
        {
          eventId: replayedEvent.id,
          tenantId,
          userId: replayedEvent.userId,
          type: replayedEvent.type,
        } satisfies EventJobPayload,
        { priority: 2 },
      );

      return reply.status(202).send({
        originalEventId: eventId,
        replayEventId: replayedEvent.id,
        status: "queued",
      });
    },
  );

  fastify.get<{ Params: { eventId: string } }>(
    "/:eventId",
    {
      schema: {
        description: "Get event by ID",
        tags: ["events"],
        params: z.object({ eventId: z.string() }),
      },
    },
    async (request, reply) => {
      const { eventId } = request.params;
      const event = await fastify.prisma.event.findFirst({
        where: { id: eventId, tenantId: request.tenantId },
        include: { processingLogs: true },
      });
      if (!event) return reply.status(404).send({ error: "Event not found" });
      return event;
    },
  );
};

export default eventsRoutes;
