import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { generateApiKey } from "@engage/core";
import { REDIS_KEYS } from "@engage/core";
import { encrypt } from "@engage/core";
import { asJson } from "../utils/prisma.js";
import type {
  ApiKeyInfoResponse,
  ApiKeyResponse,
  ApiErrorResponse,
} from "@engage/core";

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  // Admin routes use the same API key auth — in production you'd add a separate JWT admin auth
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  // ─── Tenant ───────────────────────────────────────────────────────────────
  fastify.get("/tenant", async (request) => {
    return fastify.prisma.tenant.findUniqueOrThrow({
      where: { id: request.tenantId },
      select: {
        id: true,
        slug: true,
        name: true,
        plan: true,
        brandingConfig: true,
        settings: true,
        createdAt: true,
      },
    });
  });

  fastify.put("/tenant", async (request) => {
    const body = z
      .object({
        name: z.string().optional(),
        brandingConfig: z.record(z.unknown()).optional(),
        settings: z.record(z.unknown()).optional(),
      })
      .parse(request.body);

    return fastify.prisma.tenant.update({
      where: { id: request.tenantId },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.brandingConfig
          ? { brandingConfig: asJson(body.brandingConfig) }
          : {}),
        ...(body.settings ? { settings: asJson(body.settings) } : {}),
      },
      select: {
        id: true,
        slug: true,
        name: true,
        plan: true,
        brandingConfig: true,
        settings: true,
      },
    });
  });

  // ─── AI Model Keys ────────────────────────────────────────────────────────
  fastify.get("/tenant/ai-keys", async (request) => {
    const tenant = await fastify.prisma.tenant.findUniqueOrThrow({
      where: { id: request.tenantId },
      select: { settings: true },
    });
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const encryptedKeys = (settings["encryptedAiKeys"] ?? {}) as Record<
      string,
      string
    >;
    return {
      hasAnthropicKey: Boolean(encryptedKeys["anthropic"]),
      hasOpenaiKey: Boolean(encryptedKeys["openai"]),
    };
  });

  fastify.put("/tenant/ai-keys", async (request, reply) => {
    const body = z
      .object({
        provider: z.enum(["anthropic", "openai"]),
        key: z.string().min(1),
      })
      .parse(request.body);

    const encKey = process.env["PROVIDER_CONFIG_KEY"];
    if (!encKey || encKey.length !== 32) {
      return reply
        .status(500)
        .send({
          error: "Encryption key not configured",
          code: "CONFIG_ERROR",
        } as ApiErrorResponse);
    }

    const encrypted = encrypt(body.key, encKey);

    const tenant = await fastify.prisma.tenant.findUniqueOrThrow({
      where: { id: request.tenantId },
      select: { settings: true },
    });
    const settings = (tenant.settings ?? {}) as Record<string, unknown>;
    const encryptedKeys = {
      ...((settings["encryptedAiKeys"] ?? {}) as Record<string, string>),
    };
    encryptedKeys[body.provider] = encrypted;

    await fastify.prisma.tenant.update({
      where: { id: request.tenantId },
      data: {
        settings: asJson({ ...settings, encryptedAiKeys: encryptedKeys }),
      },
    });

    return { provider: body.provider, configured: true };
  });

  fastify.delete<{ Params: { provider: string } }>(
    "/tenant/ai-keys/:provider",
    async (request, reply) => {
      const { provider } = request.params;
      if (provider !== "anthropic" && provider !== "openai") {
        return reply
          .status(400)
          .send({
            error: "Invalid provider",
            code: "INVALID_REQUEST",
          } as ApiErrorResponse);
      }

      const tenant = await fastify.prisma.tenant.findUniqueOrThrow({
        where: { id: request.tenantId },
        select: { settings: true },
      });
      const settings = (tenant.settings ?? {}) as Record<string, unknown>;
      const encryptedKeys = {
        ...((settings["encryptedAiKeys"] ?? {}) as Record<string, string>),
      };
      delete encryptedKeys[provider];

      await fastify.prisma.tenant.update({
        where: { id: request.tenantId },
        data: {
          settings: asJson({ ...settings, encryptedAiKeys: encryptedKeys }),
        },
      });

      return reply.status(204).send();
    },
  );

  // ─── API Keys ─────────────────────────────────────────────────────────────
  // GET /admin/api-keys — List all API keys for tenant
  fastify.get<{ Reply: ApiKeyInfoResponse[] }>("/api-keys", async (request) => {
    const keys = await fastify.prisma.tenantApiKey.findMany({
      where: { tenantId: request.tenantId },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        permissions: true,
        status: true,
        lastUsedAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return keys.map((key: any) => ({
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      permissions:
        typeof key.permissions === "string"
          ? JSON.parse(key.permissions)
          : key.permissions || [],
      status: key.status as never,
      lastUsedAt: key.lastUsedAt?.toISOString() || null,
      createdAt: key.createdAt.toISOString(),
      updatedAt: key.updatedAt.toISOString(),
    })) as ApiKeyInfoResponse[];
  });

  // GET /admin/api-keys/:id — Get specific API key
  fastify.get<{
    Params: { id: string };
    Reply: ApiKeyInfoResponse | ApiErrorResponse;
  }>("/api-keys/:id", async (request, reply) => {
    const { id } = request.params;
    const key = await fastify.prisma.tenantApiKey.findUnique({
      where: { id },
    });

    if (!key || key.tenantId !== request.tenantId) {
      return reply.status(404).send({
        error: "API key not found",
        code: "NOT_FOUND",
      } as ApiErrorResponse);
    }

    return {
      id: key.id,
      name: key.name,
      keyPrefix: key.keyPrefix,
      permissions:
        typeof key.permissions === "string"
          ? JSON.parse(key.permissions)
          : key.permissions || [],
      status: key.status as never,
      lastUsedAt: key.lastUsedAt?.toISOString() || null,
      createdAt: key.createdAt.toISOString(),
      updatedAt: key.updatedAt.toISOString(),
    } as ApiKeyInfoResponse;
  });

  // POST /admin/api-keys — Create new API key
  fastify.post<{
    Body: { name: string; permissions?: string[] };
    Reply: ApiKeyResponse | ApiErrorResponse;
  }>("/api-keys", async (request, reply) => {
    const body = z
      .object({
        name: z.string().min(1).max(128),
        permissions: z.array(z.string()).default(["events:write"]),
      })
      .parse(request.body);

    // Generate key
    const { raw: rawKey, hash: keyHash, prefix: keyPrefix } = generateApiKey();

    // Store in DB
    const createdKey = await fastify.prisma.tenantApiKey.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        keyHash,
        keyPrefix,
        permissions: asJson(body.permissions),
        status: "active",
      },
    });

    // Audit log
    await fastify.prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        action: "api_key_created",
        resource: "ApiKey",
        resourceId: createdKey.id,
        after: JSON.stringify({
          id: createdKey.id,
          name: createdKey.name,
          permissions: body.permissions,
        }),
      },
    });

    return reply.status(201).send({
      id: createdKey.id,
      name: createdKey.name,
      keyPrefix: createdKey.keyPrefix,
      permissions: body.permissions,
      status: createdKey.status as never,
      lastUsedAt: null,
      createdAt: createdKey.createdAt.toISOString(),
      updatedAt: createdKey.updatedAt.toISOString(),
      rawKey,
    } as unknown as ApiKeyResponse);
  });

  // PUT /admin/api-keys/:id — Update API key
  fastify.put<{
    Params: { id: string };
    Body: { name?: string; permissions?: string[] };
    Reply: ApiKeyInfoResponse | ApiErrorResponse;
  }>("/api-keys/:id", async (request, reply) => {
    const { id } = request.params;
    const body = z
      .object({
        name: z.string().min(1).max(128).optional(),
        permissions: z.array(z.string()).optional(),
      })
      .parse(request.body);

    const key = await fastify.prisma.tenantApiKey.findUnique({ where: { id } });
    if (!key || key.tenantId !== request.tenantId) {
      return reply.status(404).send({
        error: "API key not found",
        code: "NOT_FOUND",
      } as ApiErrorResponse);
    }

    const updateData: Record<string, unknown> = {};
    if (body.name) updateData.name = body.name;
    if (body.permissions) updateData.permissions = asJson(body.permissions);

    if (Object.keys(updateData).length === 0) {
      return reply.status(400).send({
        error: "No fields to update",
        code: "INVALID_REQUEST",
      } as ApiErrorResponse);
    }

    const updatedKey = await fastify.prisma.tenantApiKey.update({
      where: { id },
      data: updateData,
    });

    // Audit log
    await fastify.prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        action: "api_key_updated",
        resource: "ApiKey",
        resourceId: id,
        before: JSON.stringify({ name: key.name }),
        after: JSON.stringify({ name: updatedKey.name }),
      },
    });

    return {
      id: updatedKey.id,
      name: updatedKey.name,
      keyPrefix: updatedKey.keyPrefix,
      permissions:
        typeof updatedKey.permissions === "string"
          ? JSON.parse(updatedKey.permissions)
          : updatedKey.permissions || [],
      status: updatedKey.status as never,
      lastUsedAt: updatedKey.lastUsedAt?.toISOString() || null,
      createdAt: updatedKey.createdAt.toISOString(),
      updatedAt: updatedKey.updatedAt.toISOString(),
    } as ApiKeyInfoResponse;
  });

  // POST /admin/api-keys/:id/rotate — Rotate API key
  fastify.post<{
    Params: { id: string };
    Reply: ApiKeyResponse | ApiErrorResponse;
  }>("/api-keys/:id/rotate", async (request, reply) => {
    const { id } = request.params;
    const oldKey = await fastify.prisma.tenantApiKey.findUnique({
      where: { id },
    });

    if (!oldKey || oldKey.tenantId !== request.tenantId) {
      return reply.status(404).send({
        error: "API key not found",
        code: "NOT_FOUND",
      } as ApiErrorResponse);
    }

    // Generate new key
    const { raw: rawKey, hash: keyHash, prefix: keyPrefix } = generateApiKey();

    // Disable old key
    await fastify.prisma.tenantApiKey.update({
      where: { id },
      data: { status: "revoked", revokedAt: new Date() },
    });

    // Create new key
    const newKey = await fastify.prisma.tenantApiKey.create({
      data: {
        tenantId: request.tenantId,
        name: `${oldKey.name} (rotated)`,
        keyHash,
        keyPrefix,
        permissions: oldKey.permissions || asJson([]),
        status: "active",
      },
    });

    // Invalidate old key cache
    await fastify.redis.del(REDIS_KEYS.apiKeyCache(oldKey.keyHash));

    // Audit log
    await fastify.prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        action: "api_key_rotated",
        resource: "ApiKey",
        resourceId: newKey.id,
        after: JSON.stringify({
          oldKeyId: oldKey.id,
          newKeyId: newKey.id,
        }),
      },
    });

    return reply.status(201).send({
      id: newKey.id,
      name: newKey.name,
      keyPrefix: newKey.keyPrefix,
      permissions:
        typeof newKey.permissions === "string"
          ? JSON.parse(newKey.permissions)
          : newKey.permissions || [],
      status: newKey.status as never,
      lastUsedAt: null,
      createdAt: newKey.createdAt.toISOString(),
      updatedAt: newKey.updatedAt.toISOString(),
      rawKey,
    } as unknown as ApiKeyResponse);
  });

  // POST /admin/api-keys/:id/disable — Disable API key
  fastify.post<{
    Params: { id: string };
    Reply: ApiKeyInfoResponse | ApiErrorResponse;
  }>("/api-keys/:id/disable", async (request, reply) => {
    const { id } = request.params;
    const key = await fastify.prisma.tenantApiKey.findUnique({
      where: { id },
    });

    if (!key || key.tenantId !== request.tenantId) {
      return reply.status(404).send({
        error: "API key not found",
        code: "NOT_FOUND",
      } as ApiErrorResponse);
    }

    const updatedKey = await fastify.prisma.tenantApiKey.update({
      where: { id },
      data: { status: "disabled" },
    });

    // Invalidate cache
    await fastify.redis.del(REDIS_KEYS.apiKeyCache(key.keyHash));

    // Audit log
    await fastify.prisma.auditLog.create({
      data: {
        tenantId: request.tenantId,
        action: "api_key_disabled",
        resource: "ApiKey",
        resourceId: id,
      },
    });

    return {
      id: updatedKey.id,
      name: updatedKey.name,
      keyPrefix: updatedKey.keyPrefix,
      permissions:
        typeof updatedKey.permissions === "string"
          ? JSON.parse(updatedKey.permissions)
          : updatedKey.permissions || [],
      status: updatedKey.status as never,
      lastUsedAt: updatedKey.lastUsedAt?.toISOString() || null,
      createdAt: updatedKey.createdAt.toISOString(),
      updatedAt: updatedKey.updatedAt.toISOString(),
    } as ApiKeyInfoResponse;
  });

  // DELETE /admin/api-keys/:id — Delete (soft delete) API key
  fastify.delete<{ Params: { id: string }; Reply: void | ApiErrorResponse }>(
    "/api-keys/:id",
    async (request, reply) => {
      const { id } = request.params;
      const key = await fastify.prisma.tenantApiKey.findUnique({
        where: { id },
      });

      if (!key || key.tenantId !== request.tenantId) {
        return reply.status(404).send({
          error: "API key not found",
          code: "NOT_FOUND",
        } as ApiErrorResponse);
      }

      // Soft delete
      await fastify.prisma.tenantApiKey.update({
        where: { id },
        data: { status: "revoked", revokedAt: new Date() },
      });

      // Invalidate cache
      await fastify.redis.del(REDIS_KEYS.apiKeyCache(key.keyHash));

      // Audit log
      await fastify.prisma.auditLog.create({
        data: {
          tenantId: request.tenantId,
          action: "api_key_deleted",
          resource: "ApiKey",
          resourceId: id,
        },
      });

      return reply.status(204).send();
    },
  );

  // ─── Channel Providers ────────────────────────────────────────────────────
  fastify.get("/providers", async (request) => {
    return fastify.prisma.channelProvider.findMany({
      where: { tenantId: request.tenantId },
      select: {
        id: true,
        channel: true,
        provider: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
      },
    });
  });

  fastify.post("/providers", async (request, reply) => {
    const body = z
      .object({
        channel: z.enum(["email", "sms", "push", "whatsapp", "voice"]),
        provider: z.string().min(1),
        config: z.record(z.unknown()),
        isDefault: z.boolean().default(false),
      })
      .parse(request.body);

    // In production: encrypt config with AES-256-GCM before storing
    // For now store as JSON string (TODO: wire KMS encryption)
    const provider = await fastify.prisma.channelProvider.create({
      data: {
        tenantId: request.tenantId,
        channel: body.channel,
        provider: body.provider,
        configEncrypted: JSON.stringify(body.config),
        isDefault: body.isDefault,
        isActive: true,
      },
      select: {
        id: true,
        channel: true,
        provider: true,
        isDefault: true,
        isActive: true,
        createdAt: true,
      },
    });
    return reply.status(201).send(provider);
  });

  // ─── Feature Flags ────────────────────────────────────────────────────────
  fastify.get("/feature-flags", async (request) => {
    const flags = [
      "ai_engagement_decisions",
      "voice_campaigns",
      "whatsapp_channel",
      "analytics_v2",
      "event_replay",
    ];
    const tenantId = request.tenantId;
    const results = await Promise.all(
      flags.map(async (flag) => {
        const tenantVal = await fastify.redis.get(
          REDIS_KEYS.featureFlag(flag, tenantId),
        );
        const globalVal = await fastify.redis.get(REDIS_KEYS.featureFlag(flag));
        return {
          flag,
          tenantOverride: tenantVal,
          global: globalVal,
          effective: tenantVal ?? globalVal,
        };
      }),
    );
    return results;
  });

  fastify.put("/feature-flags/:flag", async (request) => {
    const { flag } = request.params as { flag: string };
    const { enabled, scope } = z
      .object({
        enabled: z.boolean(),
        scope: z.enum(["tenant", "global"]).default("tenant"),
      })
      .parse(request.body);

    const key =
      scope === "tenant"
        ? REDIS_KEYS.featureFlag(flag, request.tenantId)
        : REDIS_KEYS.featureFlag(flag);

    if (enabled) {
      await fastify.redis.set(key, "1");
    } else {
      await fastify.redis.del(key);
    }

    return { flag, enabled, scope };
  });

  // GET /admin/engage-verify/user/:userId
  // Called by prode-caballito-be to look up a user's contact details and consent flags.
  // :userId is the user's externalId (prode's UUID).
  fastify.get("/engage-verify/user/:userId", async (request, reply) => {
    const { userId } = request.params as { userId: string };

    const user = await fastify.prisma.user.findFirst({
      where: { externalId: userId, tenantId: request.tenantId },
      select: {
        id: true,
        externalId: true,
        email: true,
        phone: true,
        metadata: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) return reply.status(404).send({ error: "User not found" });

    const meta = (user.metadata ?? {}) as Record<string, unknown>;

    return {
      id: user.id,
      externalId: user.externalId,
      email: user.email ?? null,
      phone: user.phone ?? null,
      name:
        (meta["nombre"] as string | undefined) ??
        (meta["name"] as string | undefined) ??
        null,
      whatsapp_consent: meta["whatsapp_consent"] === true,
      sms_consent: meta["sms_consent"] === true,
      email_consent: meta["email_consent"] !== false,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  });

  // ─── Preference Stats ─────────────────────────────────────────────────────
  // GET /admin/preferences/stats — aggregate opt-out stats across all users
  fastify.get("/preferences/stats", async (request) => {
    const tenantId = request.tenantId;

    const [totalUsers, globalUnsubs, channelOptOuts] = await Promise.all([
      fastify.prisma.user.count({ where: { tenantId } }),
      fastify.prisma.globalUnsubscribe.findMany({
        where: { tenantId, channel: "all" },
        include: { user: { select: { externalId: true, email: true } } },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      fastify.prisma.userPreference.groupBy({
        by: ["channel"],
        where: { tenantId, enabled: false, category: "all" },
        _count: { _all: true },
      }),
    ]);

    return {
      totalUsers,
      globalUnsubscribeCount: globalUnsubs.length,
      globalUnsubscribes: globalUnsubs.map((u) => ({
        externalId: u.user.externalId,
        email: u.user.email,
        channel: u.channel,
        reason: u.reason,
        createdAt: u.createdAt,
      })),
      channelOptOuts: channelOptOuts.map((c) => ({
        channel: c.channel,
        count: c._count._all,
      })),
    };
  });

  // ─── Voice Campaign Surveys ───────────────────────────────────────────────
  // POST /admin/voice-campeon-survey — Create temporary survey prompt
  fastify.post<{
    Body: {
      prompt: string;
      variables?: Record<string, string>;
      ttl?: number;
    };
    Reply:
      | { surveyId: string; prompt: string; expiresIn: number }
      | ApiErrorResponse;
  }>("/voice-campeon-survey", async (request, reply) => {
    const body = z
      .object({
        prompt: z
          .string()
          .min(1, "Prompt is required")
          .max(2000, "Prompt too long"),
        variables: z.record(z.string()).optional(),
        ttl: z.number().int().min(60).max(86400).default(3600), // default 1 hour
      })
      .parse(request.body);

    const surveyId = `survey_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const surveyData = {
      tenantId: request.tenantId,
      prompt: body.prompt,
      variables: body.variables || {},
      createdAt: new Date().toISOString(),
    };

    // Store in Redis with TTL
    await fastify.redis.setex(
      `voice:survey:${surveyId}`,
      body.ttl,
      JSON.stringify(surveyData),
    );

    return reply.status(201).send({
      surveyId,
      prompt: body.prompt,
      expiresIn: body.ttl,
    });
  });

  // GET /admin/voice-campeon-survey/:surveyId — Retrieve temporary survey
  fastify.get<{
    Params: { surveyId: string };
    Reply:
      | {
          surveyId: string;
          prompt: string;
          variables: Record<string, string>;
          createdAt: string;
        }
      | ApiErrorResponse;
  }>("/voice-campeon-survey/:surveyId", async (request, reply) => {
    const { surveyId } = request.params;

    const surveyData = await fastify.redis.get(`voice:survey:${surveyId}`);
    if (!surveyData) {
      return reply.status(404).send({
        error: "Survey not found or expired",
        code: "NOT_FOUND",
      } as ApiErrorResponse);
    }

    const survey = JSON.parse(surveyData) as {
      tenantId: string;
      prompt: string;
      variables: Record<string, string>;
      createdAt: string;
    };

    // Verify tenant ownership
    if (survey.tenantId !== request.tenantId) {
      return reply.status(403).send({
        error: "Access denied",
        code: "FORBIDDEN",
      } as ApiErrorResponse);
    }

    return {
      surveyId,
      prompt: survey.prompt,
      variables: survey.variables,
      createdAt: survey.createdAt,
    };
  });

  // DELETE /admin/voice-campeon-survey/:surveyId — Delete temporary survey
  fastify.delete<{
    Params: { surveyId: string };
    Reply: void | ApiErrorResponse;
  }>("/voice-campeon-survey/:surveyId", async (request, reply) => {
    const { surveyId } = request.params;

    const surveyData = await fastify.redis.get(`voice:survey:${surveyId}`);
    if (!surveyData) {
      return reply.status(404).send({
        error: "Survey not found",
        code: "NOT_FOUND",
      } as ApiErrorResponse);
    }

    const survey = JSON.parse(surveyData) as { tenantId: string };

    // Verify tenant ownership
    if (survey.tenantId !== request.tenantId) {
      return reply.status(403).send({
        error: "Access denied",
        code: "FORBIDDEN",
      } as ApiErrorResponse);
    }

    await fastify.redis.del(`voice:survey:${surveyId}`);
    return reply.status(204).send();
  });
};

export default adminRoutes;
