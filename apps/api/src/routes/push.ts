import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { Queue } from "bullmq";
import { asJson } from "../utils/prisma.js";
import { QUEUES } from "@engage/core";

const pushCampaignsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  // Schemas
  const createPushCampaignSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    title: z.string().min(1),
    body: z.string().min(1),
    imageUrl: z.string().optional(),
    actionUrl: z.string().optional(),
    priority: z.enum(["high", "normal"]).default("high"),
    triggerType: z
      .enum(["manual", "scheduled", "rule-based", "event-based"])
      .default("manual"),
    eventType: z.string().optional(),
    audienceFilter: z.record(z.unknown()).optional(),
    maxRetries: z.number().int().default(2),
  });

  const updatePushCampaignSchema = createPushCampaignSchema.partial();

  // GET /v1/push-campaigns
  fastify.get("/", async (request: FastifyRequest, _reply: FastifyReply) => {
    const {
      status,
      limit = 50,
      offset = 0,
    } = request.query as {
      status?: string;
      limit?: number;
      offset?: number;
    };

    const where: Record<string, unknown> = { tenantId: request.tenantId };
    if (status) where.status = status;

    const [campaigns, total] = await Promise.all([
      fastify.prisma.pushCampaign.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.pushCampaign.count({ where }),
    ]);

    return { campaigns, total };
  });

  // POST /v1/push-campaigns
  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createPushCampaignSchema.parse(request.body);

    const campaign = await fastify.prisma.pushCampaign.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        description: body.description,
        title: body.title,
        body: body.body,
        imageUrl: body.imageUrl,
        actionUrl: body.actionUrl,
        priority: body.priority,
        triggerType: body.triggerType,
        eventType: body.eventType,
        audienceFilter: asJson(body.audienceFilter ?? {}),
        maxRetries: body.maxRetries,
      },
    });

    return reply.status(201).send(campaign);
  });

  // GET /v1/push-campaigns/:id
  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const campaign = await fastify.prisma.pushCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });

    if (!campaign)
      return reply.status(404).send({ error: "Campaign not found" });

    return campaign;
  });

  // PUT /v1/push-campaigns/:id
  fastify.put("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updatePushCampaignSchema.parse(request.body);

    const campaign = await fastify.prisma.pushCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });

    if (!campaign)
      return reply.status(404).send({ error: "Campaign not found" });
    if (campaign.status !== "draft" && campaign.status !== "paused") {
      return reply
        .status(400)
        .send({ error: "Can only update draft or paused campaigns" });
    }

    const updated = await fastify.prisma.pushCampaign.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        title: body.title,
        body: body.body,
        imageUrl: body.imageUrl,
        actionUrl: body.actionUrl,
        priority: body.priority,
        triggerType: body.triggerType,
        eventType: body.eventType,
        audienceFilter: body.audienceFilter
          ? asJson(body.audienceFilter)
          : undefined,
        maxRetries: body.maxRetries,
      },
    });

    return updated;
  });

  // DELETE /v1/push-campaigns/:id
  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const campaign = await fastify.prisma.pushCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign)
        return reply.status(404).send({ error: "Campaign not found" });
      if (campaign.status !== "draft") {
        return reply
          .status(400)
          .send({ error: "Can only delete draft campaigns" });
      }

      await fastify.prisma.pushCampaign.delete({ where: { id } });

      return reply.status(204).send();
    },
  );

  // POST /v1/push-campaigns/:id/start
  fastify.post(
    "/:id/start",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const campaign = await fastify.prisma.pushCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign)
        return reply.status(404).send({ error: "Campaign not found" });
      if (campaign.status !== "draft" && campaign.status !== "paused") {
        return reply
          .status(400)
          .send({ error: "Can only start draft or paused campaigns" });
      }

      // Update campaign status
      const updated = await fastify.prisma.pushCampaign.update({
        where: { id },
        data: { status: "active", startAt: new Date() },
      });

      // Find users with device tokens
      const users = await fastify.prisma.user.findMany({
        where: { tenantId: request.tenantId },
        take: 10000,
      });

      // Create PushNotification records and enqueue jobs
      const pushQueue = new Queue(QUEUES.DELIVERIES_PUSH, {
        connection: fastify.redis,
      });

      let enqueuedCount = 0;
      for (const user of users) {
        const deviceTokens = (
          Array.isArray(user.deviceTokens) ? user.deviceTokens : []
        ) as string[];

        for (const token of deviceTokens) {
          const notification = await fastify.prisma.pushNotification.create({
            data: {
              campaignId: id,
              tenantId: request.tenantId,
              userId: user.id,
              status: "queued",
              title: campaign.title,
              body: campaign.body,
              imageUrl: campaign.imageUrl,
              actionUrl: campaign.actionUrl,
              priority: campaign.priority,
            },
          });

          await pushQueue.add(
            "send-push",
            {
              notificationId: notification.id,
              pushCampaignId: id,
              userId: user.id,
              deviceToken: token,
              title: campaign.title,
              body: campaign.body,
              imageUrl: campaign.imageUrl,
              actionUrl: campaign.actionUrl,
              priority: campaign.priority,
            },
            {
              attempts: campaign.maxRetries + 1,
              backoff: {
                type: "exponential",
                delay: 2000,
              },
            },
          );

          enqueuedCount++;
        }
      }

      await pushQueue.close();

      return {
        ...updated,
        enqueuedCount,
        message: `${enqueuedCount} push notifications enqueued for sending`,
      };
    },
  );

  // POST /v1/push-campaigns/:id/pause
  fastify.post(
    "/:id/pause",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const campaign = await fastify.prisma.pushCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign)
        return reply.status(404).send({ error: "Campaign not found" });
      if (campaign.status !== "active") {
        return reply
          .status(400)
          .send({ error: "Can only pause active campaigns" });
      }

      const updated = await fastify.prisma.pushCampaign.update({
        where: { id },
        data: { status: "paused" },
      });

      return updated;
    },
  );

  // GET /v1/push-campaigns/:id/notifications
  fastify.get(
    "/:id/notifications",
    async (request: FastifyRequest, _reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const {
        limit = 50,
        offset = 0,
        status,
      } = request.query as {
        limit?: number;
        offset?: number;
        status?: string;
      };

      const where: Record<string, unknown> = {
        campaignId: id,
        tenantId: request.tenantId,
      };
      if (status) where.status = status;

      const [notifications, total] = await Promise.all([
        fastify.prisma.pushNotification.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
        }),
        fastify.prisma.pushNotification.count({ where }),
      ]);

      return { notifications, total };
    },
  );

  // GET /v1/push-campaigns/:id/metrics
  fastify.get(
    "/:id/metrics",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { granularity: _granularity = "hour", since } = request.query as {
        granularity?: "hour" | "day" | "week";
        since?: string;
      };

      const campaign = await fastify.prisma.pushCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign)
        return reply.status(404).send({ error: "Campaign not found" });

      const sinceDate = since
        ? new Date(since)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);

      const notifications = await fastify.prisma.pushNotification.findMany({
        where: { campaignId: id, createdAt: { gte: sinceDate } },
      });

      const stats = {
        sent: notifications.length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delivered: notifications.filter((n: any) => n.deliveredAt).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        opened: notifications.filter((n: any) => n.openedAt).length,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        failed: notifications.filter((n: any) => n.failedAt).length,
      };

      const deliveryRate =
        stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0;
      const openRate =
        stats.delivered > 0
          ? Math.round((stats.opened / stats.delivered) * 100)
          : 0;

      return {
        campaignId: id,
        stats: {
          ...stats,
          deliveryRate,
          openRate,
        },
        timeline: await fastify.prisma.pushMetric.findMany({
          where: { campaignId: id },
          orderBy: { date: "asc" },
        }),
      };
    },
  );
};

export default pushCampaignsRoutes;
