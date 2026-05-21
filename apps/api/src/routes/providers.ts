import type { FastifyPluginAsync } from "fastify";

const providersRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  // GET /v1/providers - List all channel providers for tenant
  fastify.get("/", async (request, _reply) => {
    const providers = await fastify.prisma.channelProvider.findMany({
      where: { tenantId: request.tenantId },
      select: {
        id: true,
        channel: true,
        provider: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return providers;
  });

  // GET /v1/providers/:channel - List providers for specific channel
  fastify.get("/:channel", async (request, _reply) => {
    const { channel } = request.params as { channel: string };

    const providers = await fastify.prisma.channelProvider.findMany({
      where: {
        tenantId: request.tenantId,
        channel,
      },
      select: {
        id: true,
        channel: true,
        provider: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return providers;
  });

  // PUT /v1/providers/:id - Update provider config
  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { configEncrypted, isActive, isDefault } = request.body as {
      configEncrypted?: string;
      isActive?: boolean;
      isDefault?: boolean;
    };

    const provider = await fastify.prisma.channelProvider.findFirst({
      where: {
        id,
        tenantId: request.tenantId,
      },
    });

    if (!provider) {
      return reply.status(404).send({ error: "Provider not found" });
    }

    const updated = await fastify.prisma.channelProvider.update({
      where: { id },
      data: {
        configEncrypted: configEncrypted ?? provider.configEncrypted,
        isActive: isActive ?? provider.isActive,
        isDefault: isDefault ?? provider.isDefault,
      },
      select: {
        id: true,
        channel: true,
        provider: true,
        isActive: true,
        isDefault: true,
        createdAt: true,
      },
    });

    return updated;
  });

  // DELETE /v1/providers/:id - Delete provider
  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const provider = await fastify.prisma.channelProvider.findFirst({
      where: {
        id,
        tenantId: request.tenantId,
      },
    });

    if (!provider) {
      return reply.status(404).send({ error: "Provider not found" });
    }

    await fastify.prisma.channelProvider.delete({ where: { id } });

    return reply.status(204).send();
  });
};

export default providersRoutes;
