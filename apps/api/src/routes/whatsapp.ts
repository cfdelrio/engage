import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { Queue } from "bullmq";
import { asJson } from "../utils/prisma.js";

const whatsappCampaignsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  // Schemas
  const createWhatsAppCampaignSchema = z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    body: z.string().min(1),
    headerType: z.enum(["text", "image", "document", "video"]).default("text"),
    headerValue: z.string().optional(),
    footerText: z.string().optional(),
    buttons: z
      .array(
        z.object({
          id: z.string(),
          title: z.string(),
        }),
      )
      .optional(),
    aiGenerated: z.boolean().default(false),
    aiInstructions: z.string().optional(),
    audienceFilter: z.record(z.unknown()).optional(),
    maxRetries: z.number().int().default(2),
  });

  const updateWhatsAppCampaignSchema = createWhatsAppCampaignSchema.partial();

  // GET /v1/whatsapp-campaigns
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
      fastify.prisma.whatsAppCampaign.findMany({
        where,
        skip: offset,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      fastify.prisma.whatsAppCampaign.count({ where }),
    ]);

    return { campaigns, total };
  });

  // POST /v1/whatsapp-campaigns
  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createWhatsAppCampaignSchema.parse(request.body);

    const campaign = await fastify.prisma.whatsAppCampaign.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        description: body.description,
        body: body.body,
        headerType: body.headerType,
        headerValue: body.headerValue,
        footerText: body.footerText,
        buttons: asJson(body.buttons ?? []),
        aiGenerated: body.aiGenerated,
        aiInstructions: body.aiInstructions,
        audienceFilter: asJson(body.audienceFilter ?? {}),
        maxRetries: body.maxRetries,
      },
    });

    return reply.status(201).send(campaign);
  });

  // GET /v1/whatsapp-campaigns/:id
  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    const campaign = await fastify.prisma.whatsAppCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });

    if (!campaign)
      return reply.status(404).send({ error: "Campaign not found" });

    return campaign;
  });

  // PUT /v1/whatsapp-campaigns/:id
  fastify.put("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateWhatsAppCampaignSchema.parse(request.body);

    const campaign = await fastify.prisma.whatsAppCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });

    if (!campaign)
      return reply.status(404).send({ error: "Campaign not found" });
    if (campaign.status !== "draft" && campaign.status !== "paused") {
      return reply
        .status(400)
        .send({ error: "Can only update draft or paused campaigns" });
    }

    const updated = await fastify.prisma.whatsAppCampaign.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        body: body.body,
        headerType: body.headerType,
        headerValue: body.headerValue,
        footerText: body.footerText,
        buttons: body.buttons ? asJson(body.buttons) : undefined,
        aiGenerated: body.aiGenerated,
        aiInstructions: body.aiInstructions,
        audienceFilter: body.audienceFilter
          ? asJson(body.audienceFilter)
          : undefined,
        maxRetries: body.maxRetries,
      },
    });

    return updated;
  });

  // DELETE /v1/whatsapp-campaigns/:id
  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const campaign = await fastify.prisma.whatsAppCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign)
        return reply.status(404).send({ error: "Campaign not found" });
      if (campaign.status !== "draft") {
        return reply
          .status(400)
          .send({ error: "Can only delete draft campaigns" });
      }

      await fastify.prisma.whatsAppCampaign.delete({ where: { id } });

      return reply.status(204).send();
    },
  );

  // POST /v1/whatsapp-campaigns/:id/start
  fastify.post(
    "/:id/start",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const campaign = await fastify.prisma.whatsAppCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign)
        return reply.status(404).send({ error: "Campaign not found" });
      if (campaign.status !== "draft") {
        return reply
          .status(400)
          .send({ error: "Can only start draft campaigns" });
      }

      const updated = await fastify.prisma.whatsAppCampaign.update({
        where: { id },
        data: {
          status: "active",
          startAt: new Date(),
        },
      });

      // Find users with phone numbers
      const users = await fastify.prisma.user.findMany({
        where: { tenantId: request.tenantId, phone: { not: null } },
        take: 10000,
      });

      // Create WhatsAppMessage records and enqueue jobs
      const whatsappQueue = new Queue("whatsapp.messages", {
        connection: fastify.redis,
      });

      let enqueuedCount = 0;
      for (const user of users) {
        if (!user.phone) continue;

        const message = await fastify.prisma.whatsAppMessage.create({
          data: {
            whatsappCampaignId: id,
            tenantId: request.tenantId,
            userId: user.id,
            phone: user.phone,
            body: campaign.body,
            headerType: campaign.headerType,
            headerValue: campaign.headerValue,
            footerText: campaign.footerText,
            buttons: campaign.buttons as Array<{ id: string; title: string }>,
            status: "queued",
          },
        });

        await whatsappQueue.add(
          "send-whatsapp",
          {
            whatsappMessageId: message.id,
            whatsappCampaignId: id,
            userId: user.id,
            phone: user.phone,
            body: campaign.body,
            headerType: campaign.headerType,
            headerValue: campaign.headerValue,
            footerText: campaign.footerText,
            buttons: campaign.buttons,
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

      await whatsappQueue.close();

      return reply.send({
        ...updated,
        enqueuedCount,
        message: `${enqueuedCount} WhatsApp messages enqueued for sending`,
      });
    },
  );

  // POST /v1/whatsapp-campaigns/:id/pause
  fastify.post(
    "/:id/pause",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const campaign = await fastify.prisma.whatsAppCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign)
        return reply.status(404).send({ error: "Campaign not found" });
      if (campaign.status !== "active") {
        return reply
          .status(400)
          .send({ error: "Can only pause active campaigns" });
      }

      const updated = await fastify.prisma.whatsAppCampaign.update({
        where: { id },
        data: { status: "paused" },
      });

      return updated;
    },
  );

  // GET /v1/whatsapp-campaigns/:id/messages
  fastify.get(
    "/:id/messages",
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
        whatsappCampaignId: id,
        tenantId: request.tenantId,
      };
      if (status) where.status = status;

      const [messages, total] = await Promise.all([
        fastify.prisma.whatsAppMessage.findMany({
          where,
          skip: offset,
          take: limit,
          orderBy: { createdAt: "desc" },
          include: { interactions: true },
        }),
        fastify.prisma.whatsAppMessage.count({ where }),
      ]);

      return { messages, total };
    },
  );

  // GET /v1/whatsapp-campaigns/:id/metrics
  fastify.get(
    "/:id/metrics",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const { granularity: _granularity = "hour", since } = request.query as {
        granularity?: "hour" | "day" | "week";
        since?: string;
      };

      const campaign = await fastify.prisma.whatsAppCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign)
        return reply.status(404).send({ error: "Campaign not found" });

      const sinceDate = since
        ? new Date(since)
        : new Date(Date.now() - 24 * 60 * 60 * 1000);

      const messages = await fastify.prisma.whatsAppMessage.findMany({
        where: { whatsappCampaignId: id, createdAt: { gte: sinceDate } },
      });

      const stats = {
        sent: messages.length,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
        delivered: messages.filter((m: any) => m.deliveredAt).length,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
        read: messages.filter((m: any) => m.readAt).length,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
        failed: messages.filter((m: any) => m.failedAt).length,
      };

      const deliveryRate =
        stats.sent > 0 ? Math.round((stats.delivered / stats.sent) * 100) : 0;
      const readRate =
        stats.delivered > 0
          ? Math.round((stats.read / stats.delivered) * 100)
          : 0;

      return {
        campaignId: id,
        stats: {
          ...stats,
          deliveryRate,
          readRate,
        },
        timeline: await fastify.prisma.whatsAppMetric.findMany({
          where: { campaignId: id },
          orderBy: { date: "asc" },
        }),
      };
    },
  );
};

export default whatsappCampaignsRoutes;
