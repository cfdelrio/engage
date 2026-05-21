import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { AIOrchestrationLayer } from "@engage/ai";
import { asJson } from "../utils/prisma.js";

const campaignSchema = z.object({
  name: z.string().min(1).max(256),
  type: z.enum(["event-triggered", "scheduled", "recurring", "voice"]),
  status: z.enum(["draft", "active", "paused", "completed"]).default("draft"),
  trigger: z.record(z.unknown()).optional().default({}),
  rules: z.record(z.unknown()).optional().default({}),
  channels: z.array(z.string()).default([]),
  templateId: z.string().optional(),
  aiConfig: z.record(z.unknown()).optional().default({}),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

const paginationSchema = z.object({
  cursor: z.string().optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).default("20"),
});

const campaignsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  fastify.get("/", async (request) => {
    const { cursor, limit } = paginationSchema.parse(request.query);
    const campaigns = await fastify.prisma.campaign.findMany({
      where: { tenantId: request.tenantId },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      cursor: cursor ? { id: cursor } : undefined,
      skip: cursor ? 1 : 0,
    });
    const hasMore = campaigns.length > limit;
    const items = campaigns.slice(0, limit);
    return {
      campaigns: items,
      nextCursor: hasMore ? items[items.length - 1]?.id : null,
      hasMore,
    };
  });

  fastify.post("/", async (request, reply) => {
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

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { runs: { orderBy: { startedAt: "desc" }, take: 10 } },
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    return campaign;
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = campaignSchema.partial().parse(request.body);
    const existing = await fastify.prisma.campaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: "Not found" });

    if (existing.status === "completed") {
      return reply
        .status(409)
        .send({ error: "Cannot update completed campaign" });
    }

    const campaign = await fastify.prisma.campaign.update({
      where: { id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.type ? { type: body.type } : {}),
        ...(body.status && body.status !== existing.status
          ? { status: body.status }
          : {}),
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

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });

    if (campaign.status !== "draft") {
      return reply
        .status(409)
        .send({ error: "Can only delete draft campaigns" });
    }

    await fastify.prisma.campaign.delete({ where: { id } });
    return reply.status(204).send();
  });

  // Manually trigger a campaign run
  fastify.post("/:id/trigger", async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.campaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (campaign.status !== "active")
      return reply
        .status(409)
        .send({ error: "Campaign must be active to trigger" });

    const run = await fastify.prisma.campaignRun.create({
      data: {
        campaignId: id,
        triggeredBy: "api",
        status: "pending",
        stats: asJson({}),
      },
    });
    return reply.status(202).send({ runId: run.id, status: "pending" });
  });

  // Get AI-powered campaign suggestions
  fastify.post<{
    Body: { type: string; channels?: string[]; targetAudience?: string };
  }>(
    "/suggest",
    {
      schema: {
        description:
          "Get AI-powered suggestions for campaign name, timing, and channels",
        tags: ["campaigns"],
        body: z.object({
          type: z.enum(["event-triggered", "scheduled", "recurring", "voice"]),
          channels: z.array(z.string()).optional(),
          targetAudience: z.string().optional(),
        }),
      },
    },
    async (request, reply) => {
      const { type, channels = [], targetAudience } = request.body;
      const tenantId = request.tenantId;

      try {
        // Get AI layer from fastify context
        const aiLayer = (
          fastify as unknown as { aiLayer: AIOrchestrationLayer }
        ).aiLayer;
        if (!aiLayer) {
          return reply.status(503).send({ error: "AI service not available" });
        }

        const suggestions = await aiLayer.suggestCampaignName(
          tenantId,
          type,
          channels,
          targetAudience,
        );

        if (!suggestions) {
          return reply
            .status(500)
            .send({ error: "Failed to generate suggestions" });
        }

        return reply.send(suggestions);
      } catch (error) {
        fastify.log.error(error);
        return reply
          .status(500)
          .send({ error: "Failed to generate suggestions" });
      }
    },
  );
};

export default campaignsRoutes;
