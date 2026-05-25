import type { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import type { SerializedRule, RuleStatsMap } from "@engage/ai";

const serializedRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullish(),
  conditions: z.unknown(),
  actions: z.unknown(),
  enabled: z.boolean(),
  priority: z.number(),
});

const ruleStatSchema = z.object({
  total: z.number(),
  matched: z.number(),
  matchRate: z.number(),
  lastExecutedAt: z.string().nullable(),
});

const queryBodySchema = z.object({
  question: z.string().min(1).max(500),
  rules: z.array(serializedRuleSchema).max(200),
  stats: z.record(ruleStatSchema).optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(20)
    .optional(),
});

const interpretBodySchema = z.object({
  message: z.string().min(1).max(500),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(2000),
      }),
    )
    .max(20)
    .optional(),
});

const aiRulesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  fastify.post("/", async (request, reply) => {
    const parse = interpretBodySchema.safeParse(request.body);
    if (!parse.success) {
      return reply
        .status(400)
        .send({ error: parse.error.errors[0]?.message ?? "Invalid request" });
    }

    const { message, conversationHistory } = parse.data;
    const tenantId = request.tenantId;

    // Rate limit: 10 calls per minute per tenant
    const rlKey = `ai:rules:rl:${tenantId}`;
    const count = await fastify.redis.incr(rlKey);
    if (count === 1) await fastify.redis.expire(rlKey, 60);
    if (count > 10) {
      return reply.status(429).send({
        error:
          "Rate limit exceeded. Max 10 AI rule interpretations per minute.",
      });
    }

    try {
      const interpretation = await fastify.ruleInterpreter.interpret(
        message,
        tenantId,
        conversationHistory,
      );
      return reply.send(interpretation);
    } catch (err) {
      if (err instanceof Error) {
        const coded = err as Error & { code?: string };
        if (coded.code === "INJECTION_DETECTED") {
          return reply.status(400).send({ error: err.message });
        }
        if (coded.code === "AI_PARSE_ERROR") {
          return reply.status(422).send({
            error: "AI could not generate a valid rule — try rephrasing.",
            detail: err.message,
          });
        }
      }
      throw err;
    }
  });

  fastify.post("/query", async (request, reply) => {
    const parse = queryBodySchema.safeParse(request.body);
    if (!parse.success) {
      return reply
        .status(400)
        .send({ error: parse.error.errors[0]?.message ?? "Invalid request" });
    }

    const { question, rules, stats, conversationHistory } = parse.data;
    const tenantId = request.tenantId;

    // Shares the same rate limit bucket as /interpret
    const rlKey = `ai:rules:rl:${tenantId}`;
    const count = await fastify.redis.incr(rlKey);
    if (count === 1) await fastify.redis.expire(rlKey, 60);
    if (count > 10) {
      return reply.status(429).send({
        error: "Rate limit exceeded. Max 10 AI rule requests per minute.",
      });
    }

    try {
      const analysis = await fastify.ruleAnalyst.query(
        question,
        tenantId,
        rules as SerializedRule[],
        stats as RuleStatsMap | undefined,
        conversationHistory,
      );
      return reply.send(analysis);
    } catch (err) {
      if (err instanceof Error) {
        const coded = err as Error & { code?: string };
        if (coded.code === "INJECTION_DETECTED") {
          return reply.status(400).send({ error: err.message });
        }
        if (coded.code === "AI_PARSE_ERROR") {
          return reply.status(422).send({
            error: "AI could not analyze rules — try rephrasing.",
            detail: err.message,
          });
        }
      }
      throw err;
    }
  });
};

export default aiRulesRoutes;
