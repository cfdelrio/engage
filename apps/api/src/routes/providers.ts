import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import crypto from "node:crypto";

const createProviderSchema = z.object({
  channel: z.enum(["email", "sms", "push", "whatsapp", "voice"]),
  provider: z.string().min(1),
  config: z.record(z.unknown()),
  isDefault: z.boolean().optional().default(false),
});

function encryptConfig(config: Record<string, unknown>): string {
  const key = process.env["PROVIDER_CONFIG_KEY"] ?? "";
  if (!key || key.length !== 32) {
    throw new Error("PROVIDER_CONFIG_KEY must be a 32-char hex string");
  }
  const iv = crypto.randomBytes(16);
  const keyBuf = Buffer.from(key, "hex");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cipher = crypto.createCipheriv("aes-256-cbc", keyBuf, iv) as any;
  const data = JSON.stringify(config);
  let encrypted = cipher.update(data, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

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

  // POST /v1/providers - Create new provider
  fastify.post("/", async (request, reply) => {
    const body = createProviderSchema.parse(request.body);

    const existing = await fastify.prisma.channelProvider.findFirst({
      where: {
        tenantId: request.tenantId,
        channel: body.channel,
        provider: body.provider,
      },
    });

    if (existing) {
      return reply
        .status(409)
        .send({ error: "Provider already configured for this channel" });
    }

    // Set isDefault to true if this is the first provider for this channel
    let isDefault = body.isDefault;
    if (!isDefault) {
      const count = await fastify.prisma.channelProvider.count({
        where: {
          tenantId: request.tenantId,
          channel: body.channel,
          isActive: true,
        },
      });
      isDefault = count === 0;
    }

    // If setting as default, unset others for this channel
    if (isDefault) {
      await fastify.prisma.channelProvider.updateMany({
        where: {
          tenantId: request.tenantId,
          channel: body.channel,
        },
        data: { isDefault: false },
      });
    }

    const encrypted = encryptConfig(body.config);
    const provider = await fastify.prisma.channelProvider.create({
      data: {
        tenantId: request.tenantId,
        channel: body.channel,
        provider: body.provider,
        configEncrypted: encrypted,
        isDefault,
        isActive: true,
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

    return reply.status(201).send(provider);
  });

  // PUT /v1/providers/:id - Update provider config
  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { config, isActive, isDefault } = request.body as {
      config?: Record<string, unknown>;
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

    // If setting as default, unset others for this channel
    if (isDefault === true && !provider.isDefault) {
      await fastify.prisma.channelProvider.updateMany({
        where: {
          tenantId: request.tenantId,
          channel: provider.channel,
        },
        data: { isDefault: false },
      });
    }

    const encrypted = config ? encryptConfig(config) : provider.configEncrypted;

    const updated = await fastify.prisma.channelProvider.update({
      where: { id },
      data: {
        configEncrypted: encrypted,
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
