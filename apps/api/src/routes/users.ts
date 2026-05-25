import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { asJson } from "../utils/prisma.js";

const usersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  const upsertUserSchema = z.object({
    externalId: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(),
    timezone: z.string().optional(),
    locale: z.string().optional(),
    tags: z.array(z.string()).optional(),
    metadata: z.record(z.unknown()).optional(),
  });

  const listUsersQuerySchema = z.object({
    externalId: z.string().optional(),
    email: z.string().optional(),
    tags: z.string().optional(), // comma-separated
    limit: z.coerce.number().int().min(1).max(200).default(50),
    cursor: z.string().optional(),
  });

  fastify.get("/", async (request) => {
    const query = listUsersQuerySchema.parse(request.query);
    const tenantId = request.tenantId;

    const where: Record<string, unknown> = { tenantId };
    if (query.externalId)
      where["externalId"] = { contains: query.externalId, mode: "insensitive" };
    if (query.email)
      where["email"] = { contains: query.email, mode: "insensitive" };
    if (query.tags) {
      const tagList = query.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);
      if (tagList.length > 0) where["tags"] = { hasSome: tagList };
    }

    const users = await fastify.prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = users.length > query.limit;
    const page = hasMore ? users.slice(0, query.limit) : users;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;

    return { users: page, nextCursor, hasMore };
  });

  fastify.post("/", async (request, reply) => {
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
        timezone: body.timezone ?? "UTC",
        locale: body.locale ?? "en",
        tags: body.tags ?? [],
        metadata: asJson(body.metadata ?? {}),
      },
    });

    return reply.status(201).send(user);
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const user = await fastify.prisma.user.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { engagementScore: true, preferences: true },
    });
    if (!user) return reply.status(404).send({ error: "User not found" });
    return user;
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = upsertUserSchema
      .partial()
      .omit({ externalId: true })
      .parse(request.body);

    const existing = await fastify.prisma.user.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: "User not found" });

    const updated = await fastify.prisma.user.update({
      where: { id },
      data: {
        ...(body.email !== undefined ? { email: body.email } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
        ...(body.locale !== undefined ? { locale: body.locale } : {}),
        ...(body.tags !== undefined ? { tags: body.tags } : {}),
        ...(body.metadata !== undefined
          ? { metadata: asJson(body.metadata) }
          : {}),
      },
    });
    return updated;
  });

  fastify.get("/:id/deliveries", async (request) => {
    const { id } = request.params as { id: string };
    const { limit = "20", cursor } = request.query as {
      limit?: string;
      cursor?: string;
    };
    const take = Math.min(parseInt(limit, 10) || 20, 100);

    const deliveries = await fastify.prisma.delivery.findMany({
      where: { userId: id, tenantId: request.tenantId },
      orderBy: { createdAt: "desc" },
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });

    const hasMore = deliveries.length > take;
    const page = hasMore ? deliveries.slice(0, take) : deliveries;
    const nextCursor = hasMore ? (page[page.length - 1]?.id ?? null) : null;
    return { deliveries: page, nextCursor, hasMore };
  });

  fastify.get("/:id/engagement", async (request) => {
    const { id } = request.params as { id: string };
    const [score, recentDeliveries] = await Promise.all([
      fastify.prisma.userEngagementScore.findUnique({ where: { userId: id } }),
      fastify.prisma.delivery.findMany({
        where: { userId: id, tenantId: request.tenantId },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    ]);
    return { score, recentDeliveries };
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.user.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: "User not found" });
    await fastify.prisma.user.delete({ where: { id } });
    return reply.status(204).send();
  });

  fastify.post("/bulk", async (request, reply) => {
    const bulkUserSchema = z.object({
      externalId: z.string().min(1).max(256),
      email: z.string().email().nullable().optional(),
      phone: z.string().nullable().optional(),
      timezone: z.string().optional(),
      locale: z.string().optional(),
      tags: z.array(z.string()).optional(),
      metadata: z.record(z.unknown()).optional(),
    });

    const body = z
      .object({ users: z.array(bulkUserSchema).min(1).max(500) })
      .parse(request.body);

    const tenantId = request.tenantId;
    let created = 0,
      updated = 0,
      failed = 0;
    const errors: Array<{ externalId: string; error: string }> = [];

    for (const u of body.users) {
      try {
        const existing = await fastify.prisma.user.findUnique({
          where: {
            tenantId_externalId: { tenantId, externalId: u.externalId },
          },
          select: { id: true },
        });
        await fastify.prisma.user.upsert({
          where: {
            tenantId_externalId: { tenantId, externalId: u.externalId },
          },
          update: {
            ...(u.email !== undefined ? { email: u.email } : {}),
            ...(u.phone !== undefined ? { phone: u.phone } : {}),
            ...(u.timezone ? { timezone: u.timezone } : {}),
            ...(u.locale ? { locale: u.locale } : {}),
            ...(u.tags ? { tags: u.tags } : {}),
            ...(u.metadata ? { metadata: asJson(u.metadata) } : {}),
          },
          create: {
            tenantId,
            externalId: u.externalId,
            ...(u.email ? { email: u.email } : {}),
            ...(u.phone ? { phone: u.phone } : {}),
            timezone: u.timezone ?? "America/Argentina/Buenos_Aires",
            locale: u.locale ?? "es",
            tags: u.tags ?? [],
            metadata: asJson(u.metadata ?? {}),
          },
        });
        existing ? updated++ : created++;
      } catch (err) {
        failed++;
        errors.push({
          externalId: u.externalId,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return reply.status(200).send({
      total: body.users.length,
      created,
      updated,
      failed,
      ...(errors.length > 0 ? { errors } : {}),
    });
  });
};

export default usersRoutes;
