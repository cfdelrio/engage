import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { asJson } from '../utils/prisma.js';

const conditionSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      field: z.string(),
      operator: z.enum(['eq', 'neq', 'gt', 'lt', 'gte', 'lte', 'in', 'nin', 'contains', 'changed', 'exists']),
      value: z.unknown().optional(),
    }),
    z.object({
      operator: z.enum(['AND', 'OR']),
      conditions: z.array(conditionSchema),
    }),
  ]),
);

const ruleSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().optional(),
  enabled: z.boolean().default(true),
  priority: z.number().int().default(0),
  conditions: z.object({
    operator: z.enum(['AND', 'OR']),
    conditions: z.array(conditionSchema),
  }),
  actions: z.array(
    z.object({
      type: z.enum(['SEND_NOTIFICATION', 'ADD_TO_CAMPAIGN', 'SUPPRESS', 'ESCALATE', 'UPDATE_SCORE', 'TRIGGER_WEBHOOK']),
      params: z.record(z.unknown()),
    }),
  ),
  cooldownSeconds: z.number().int().optional(),
});

const rulesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  fastify.get('/', async (request) => {
    return fastify.prisma.rule.findMany({
      where: { tenantId: request.tenantId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  });

  fastify.post('/', async (request, reply) => {
    const body = ruleSchema.parse(request.body);
    const rule = await fastify.prisma.rule.create({
      data: {
        tenantId: request.tenantId, name: body.name, enabled: body.enabled, priority: body.priority,
        conditions: asJson(body.conditions), actions: asJson(body.actions),
        ...(body.description ? { description: body.description } : {}),
        ...(body.cooldownSeconds !== undefined ? { cooldownSeconds: body.cooldownSeconds } : {}),
      },
    });
    return reply.status(201).send(rule);
  });

  fastify.put('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = ruleSchema.partial().parse(request.body);

    const existing = await fastify.prisma.rule.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: 'Rule not found' });

    const updateData: Record<string, unknown> = {};
    if (body.name !== undefined) updateData['name'] = body.name;
    if (body.description !== undefined) updateData['description'] = body.description;
    if (body.enabled !== undefined) updateData['enabled'] = body.enabled;
    if (body.priority !== undefined) updateData['priority'] = body.priority;
    if (body.conditions !== undefined) updateData['conditions'] = asJson(body.conditions);
    if (body.actions !== undefined) updateData['actions'] = asJson(body.actions);
    if (body.cooldownSeconds !== undefined) updateData['cooldownSeconds'] = body.cooldownSeconds;

    const updated = await fastify.prisma.rule.update({ where: { id }, data: updateData });
    return updated;
  });

  fastify.delete('/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await fastify.prisma.rule.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: 'Rule not found' });
    await fastify.prisma.rule.delete({ where: { id } });
    return reply.status(204).send();
  });
};

export default rulesRoutes;
