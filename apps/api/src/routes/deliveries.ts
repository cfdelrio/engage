import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";

const listQuerySchema = z.object({
  userId: z.string().optional(),
  channel: z.enum(["email", "sms", "push", "whatsapp", "voice"]).optional(),
  status: z.string().optional(),
  engagementDecisionId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().optional(),
});

const deliveriesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  fastify.get(
    "/",
    {
      schema: {
        description:
          "List deliveries for the authenticated tenant, with optional filters and cursor pagination",
        tags: ["deliveries"],
        querystring: listQuerySchema,
      },
    },
    async (request, reply) => {
      const query = listQuerySchema.parse(request.query);
      const tenantId = request.tenantId;

      const where: Record<string, unknown> = { tenantId };
      if (query.userId) where["userId"] = query.userId;
      if (query.channel) where["channel"] = query.channel;
      if (query.status) where["status"] = query.status;
      if (query.engagementDecisionId)
        where["engagementDecisionId"] = query.engagementDecisionId;
      if (query.from || query.to) {
        const createdAt: Record<string, Date> = {};
        if (query.from) createdAt["gte"] = new Date(query.from);
        if (query.to) createdAt["lte"] = new Date(query.to);
        where["createdAt"] = createdAt;
      }

      const deliveries = await fastify.prisma.delivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: query.limit + 1,
        ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
      });

      const hasMore = deliveries.length > query.limit;
      const page = hasMore ? deliveries.slice(0, query.limit) : deliveries;
      const nextCursor = hasMore ? page[page.length - 1]?.id : null;

      return reply.send({
        deliveries: page,
        nextCursor,
        hasMore,
      });
    },
  );

  fastify.get<{ Params: { deliveryId: string } }>(
    "/:deliveryId",
    {
      schema: {
        description:
          "Get delivery details by ID, including processing events and the upstream engagement decision",
        tags: ["deliveries"],
        params: z.object({ deliveryId: z.string() }),
      },
    },
    async (request, reply) => {
      const { deliveryId } = request.params;
      const tenantId = request.tenantId;

      const delivery = await fastify.prisma.delivery.findFirst({
        where: { id: deliveryId, tenantId },
        include: {
          events: { orderBy: { occurredAt: "asc" } },
          engagementDecision: true,
          user: {
            select: {
              id: true,
              externalId: true,
              email: true,
              phone: true,
              timezone: true,
              locale: true,
            },
          },
        },
      });

      if (!delivery) {
        return reply.status(404).send({ error: "Delivery not found" });
      }

      return reply.send(delivery);
    },
  );
};

export default deliveriesRoutes;
