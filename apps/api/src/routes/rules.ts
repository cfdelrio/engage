import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { RulesEngine, type StoredRule } from "@engage/rules-engine";
import type {
  EventContext,
  ProcessedEvent,
  UserContext,
  TenantContext,
  ConditionGroup,
  RuleAction,
} from "@engage/core";
import { asJson } from "../utils/prisma.js";

const conditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      field: z.string(),
      operator: z.enum([
        "eq",
        "neq",
        "gt",
        "lt",
        "gte",
        "lte",
        "in",
        "nin",
        "contains",
        "changed",
        "exists",
      ]),
      value: z.unknown().optional(),
    }),
    z.object({
      operator: z.enum(["AND", "OR"]),
      conditions: z.array(conditionSchema),
    }),
  ]),
);

const conditionGroupSchema = z.object({
  operator: z.enum(["AND", "OR"]),
  conditions: z.array(conditionSchema),
});

const ruleSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
  conditions: conditionGroupSchema,
  actions: z.array(
    z.object({
      type: z.enum([
        "SEND_NOTIFICATION",
        "ADD_TO_CAMPAIGN",
        "SUPPRESS",
        "ESCALATE",
        "UPDATE_SCORE",
        "TRIGGER_WEBHOOK",
      ]),
      params: z.record(z.unknown()),
    }),
  ),
  cooldownSeconds: z.number().int().optional(),
});

const testRuleSchema = z.object({
  event: z.object({
    type: z.string().min(1),
    payload: z.record(z.unknown()).optional().default({}),
    metadata: z.record(z.unknown()).optional().default({}),
  }),
  user: z
    .object({
      externalId: z.string().optional(),
      tags: z.array(z.string()).optional(),
      fatigueScore: z.number().min(0).max(1).optional(),
      engagementScore: z.number().optional(),
      isActiveSession: z.boolean().optional(),
      metadata: z.record(z.unknown()).optional(),
    })
    .optional()
    .default({}),
});

const rulesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  fastify.get("/", async (request) => {
    return fastify.prisma.rule.findMany({
      where: { tenantId: request.tenantId },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
  });

  fastify.get("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const rule = await fastify.prisma.rule.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!rule) return reply.status(404).send({ error: "Rule not found" });
    return rule;
  });

  fastify.get("/:id/executions", async (request, reply) => {
    const { id } = request.params as { id: string };
    const { limit = "50", matched } = request.query as {
      limit?: string;
      matched?: string;
    };

    const rule = await fastify.prisma.rule.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!rule) return reply.status(404).send({ error: "Rule not found" });

    const executions = await fastify.prisma.ruleExecution.findMany({
      where: {
        ruleId: id,
        tenantId: request.tenantId,
        ...(matched !== undefined ? { matched: matched === "true" } : {}),
      },
      orderBy: { executedAt: "desc" },
      take: Math.min(parseInt(limit, 10) || 50, 200),
    });
    return executions;
  });

  fastify.post("/", async (request, reply) => {
    const body = ruleSchema.parse(request.body);
    const rule = await fastify.prisma.rule.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        enabled: body.enabled,
        priority: body.priority,
        conditions: asJson(body.conditions),
        actions: asJson(body.actions),
        ...(body.description ? { description: body.description } : {}),
        ...(body.cooldownSeconds !== undefined
          ? { cooldownSeconds: body.cooldownSeconds }
          : {}),
      },
    });
    return reply.status(201).send(rule);
  });

  fastify.put("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ruleSchema.partial().parse(request.body);

    const existing = await fastify.prisma.rule.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: "Rule not found" });

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData["name"] = body.name;
    if (body.description !== undefined)
      updateData["description"] = body.description;
    if (body.enabled !== undefined) updateData["enabled"] = body.enabled;
    if (body.priority !== undefined) updateData["priority"] = body.priority;
    if (body.conditions !== undefined)
      updateData["conditions"] = asJson(body.conditions);
    if (body.actions !== undefined)
      updateData["actions"] = asJson(body.actions);
    if (body.cooldownSeconds !== undefined)
      updateData["cooldownSeconds"] = body.cooldownSeconds;

    const updated = await fastify.prisma.rule.update({
      where: { id },
      data: updateData,
    });
    return updated;
  });

  fastify.delete("/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.rule.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: "Rule not found" });
    await fastify.prisma.rule.delete({ where: { id } });
    return reply.status(204).send();
  });

  // Toggle enabled flag — quick activate/deactivate without sending the full
  // rule payload through PUT. Returns the updated rule.
  fastify.post("/:id/toggle", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.rule.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: "Rule not found" });
    const updated = await fastify.prisma.rule.update({
      where: { id },
      data: { enabled: !existing.enabled },
    });
    return updated;
  });

  // Dry-run: evaluate a rule against a synthetic event/user context without
  // persisting a RuleExecution or triggering any actions. Lets the dashboard
  // validate rule definitions before activating them.
  fastify.post("/:id/test", async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = testRuleSchema.parse(request.body);

    const rule = await fastify.prisma.rule.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!rule) return reply.status(404).send({ error: "Rule not found" });

    let userBase: Partial<UserContext> = {};
    if (body.user.externalId) {
      const existingUser = await fastify.prisma.user.findUnique({
        where: {
          tenantId_externalId: {
            tenantId: request.tenantId,
            externalId: body.user.externalId,
          },
        },
        include: { engagementScore: true },
      });
      if (existingUser) {
        userBase = {
          id: existingUser.id,
          externalId: existingUser.externalId,
          ...(existingUser.email !== null ? { email: existingUser.email } : {}),
          ...(existingUser.phone !== null ? { phone: existingUser.phone } : {}),
          timezone: existingUser.timezone,
          locale: existingUser.locale,
          tags: existingUser.tags,
          fatigueScore: existingUser.engagementScore?.fatigueScore ?? 0,
          engagementScore: existingUser.engagementScore?.score ?? 0,
          metadata: (existingUser.metadata as Record<string, unknown>) ?? {},
          isActiveSession: false,
        };
      }
    }

    const event: ProcessedEvent = {
      id: "test_event",
      tenantId: request.tenantId,
      type: body.event.type,
      userId: userBase.id ?? "test_user",
      payload: body.event.payload,
      metadata: body.event.metadata,
      receivedAt: new Date(),
    };

    const user: UserContext = {
      id: userBase.id ?? "test_user",
      externalId:
        userBase.externalId ?? body.user.externalId ?? "test_external",
      timezone: userBase.timezone ?? "UTC",
      locale: userBase.locale ?? "en",
      tags: body.user.tags ?? userBase.tags ?? [],
      fatigueScore: body.user.fatigueScore ?? userBase.fatigueScore ?? 0,
      engagementScore:
        body.user.engagementScore ?? userBase.engagementScore ?? 0,
      metadata: { ...(userBase.metadata ?? {}), ...(body.user.metadata ?? {}) },
      isActiveSession:
        body.user.isActiveSession ?? userBase.isActiveSession ?? false,
      ...(userBase.email !== undefined ? { email: userBase.email } : {}),
      ...(userBase.phone !== undefined ? { phone: userBase.phone } : {}),
      ...(userBase.lastSeenAt !== undefined
        ? { lastSeenAt: userBase.lastSeenAt }
        : {}),
    };

    const tenantContext: TenantContext = {
      id: request.tenantId,
      slug: "test",
      settings: {} as TenantContext["settings"],
    };

    const context: EventContext = { event, user, tenant: tenantContext };

    const storedRule: StoredRule = {
      id: rule.id,
      name: rule.name,
      enabled: true, // force-enabled for dry-run so disabled rules can still be tested
      priority: rule.priority,
      conditions: rule.conditions as unknown as ConditionGroup,
      actions: rule.actions as unknown as RuleAction[],
      cooldownSeconds: rule.cooldownSeconds,
    };

    const engine = new RulesEngine();
    const [result] = engine.evaluate([storedRule], context);

    return reply.send({
      ruleId: rule.id,
      matched: result?.matched ?? false,
      actions: result?.actions ?? [],
      reasoning: result?.reasoning ?? "",
      contextUsed: { event, user: { ...user, tenant: undefined } },
    });
  });
};

export default rulesRoutes;
