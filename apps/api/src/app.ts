import Fastify, { type FastifyInstance } from "fastify";
import {
  validatorCompiler,
  serializerCompiler,
  jsonSchemaTransform,
} from "fastify-type-provider-zod";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import { getQueue, QUEUES } from "@engage/event-bus";
import { ensureVoiceServiceRegistration } from "./startup/voice-registration.js";

import redisPlugin from "./plugins/redis.js";
import prismaPlugin from "./plugins/prisma.js";
import apiKeyAuthPlugin from "./plugins/api-key-auth.js";
import { rateLimitApiKeyPlugin } from "./plugins/rate-limit-api-key.js";
import aiPlugin from "./plugins/ai.js";

import eventsRoutes from "./routes/events.js";
import eventStreamRoutes from "./routes/event-stream.js";
import usersRoutes from "./routes/users.js";
import userPreferencesRoutes from "./routes/user-preferences.js";
import { publicPreferencesRoutes } from "./routes/public-preferences.js";
import rulesRoutes from "./routes/rules.js";
import analyticsRoutes from "./routes/analytics.js";
import feedsRoutes from "./routes/feeds.js";
import webhooksRoutes from "./routes/webhooks.js";
import adminRoutes from "./routes/admin.js";
import campaignsRoutes from "./routes/campaigns.js";
import voiceRoutes from "./routes/voice.js";
import whatsappRoutes from "./routes/whatsapp.js";
import pushRoutes from "./routes/push.js";
import emailCampaignsRoutes from "./routes/email-campaigns.js";
import smsCampaignsRoutes from "./routes/sms-campaigns.js";
import providersRoutes from "./routes/providers.js";
import templatesRoutes from "./routes/templates.js";
import deliveriesRoutes from "./routes/deliveries.js";
import embedRoutes from "./routes/embed.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger:
      process.env["NODE_ENV"] === "test"
        ? false
        : {
            level: process.env["LOG_LEVEL"] ?? "info",
            transport:
              process.env["NODE_ENV"] !== "production"
                ? { target: "pino-pretty", options: { colorize: true } }
                : undefined,
          },
    trustProxy: true,
  });

  app.setValidatorCompiler(validatorCompiler);
  app.setSerializerCompiler(serializerCompiler);

  // ─── Security ─────────────────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: process.env["CORS_ORIGINS"]?.split(",") ?? [
      "http://localhost:3000",
    ],
    credentials: true,
  });
  await app.register(rateLimit, {
    global: true,
    max: 1000,
    timeWindow: "1 minute",
    keyGenerator: (req) =>
      (req as { tenantId?: string; ip: string }).tenantId ??
      (req as { ip: string }).ip,
  });

  // ─── OpenAPI docs ─────────────────────────────────────────────────────────
  await app.register(swagger, {
    transform: jsonSchemaTransform,
    openapi: {
      info: { title: "ORKESTAI ENGAGE API", version: "1.0.0" },
      tags: [
        { name: "events" },
        { name: "users" },
        { name: "rules" },
        { name: "analytics" },
        { name: "campaigns" },
        { name: "admin" },
      ],
    },
  });
  await app.register(swaggerUi, {
    routePrefix: "/docs",
    uiConfig: { deepLinking: false },
  });

  // ─── Infrastructure plugins ───────────────────────────────────────────────
  await app.register(redisPlugin);
  await app.register(prismaPlugin);
  await app.register(aiPlugin);
  await ensureVoiceServiceRegistration(app.redis);
  await app.register(apiKeyAuthPlugin);
  await app.register(rateLimitApiKeyPlugin);

  // ─── Health ───────────────────────────────────────────────────────────────
  app.get("/health", async () => ({
    status: "ok",
    timestamp: new Date().toISOString(),
  }));

  app.get("/health/workers", async (_request, reply) => {
    const queueNames = [
      QUEUES.EVENTS_INCOMING,
      QUEUES.DELIVERIES_SCHEDULED,
      QUEUES.DELIVERIES_EMAIL,
      QUEUES.DELIVERIES_SMS,
      QUEUES.DELIVERIES_PUSH,
      QUEUES.DELIVERIES_VOICE,
      QUEUES.DELIVERIES_WHATSAPP,
    ];

    const queues = {} as Record<
      string,
      {
        name: string;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
        paused: number;
        waiting: number;
      }
    >;

    for (const queueName of queueNames) {
      try {
        const queue = getQueue(queueName);
        const [active, completed, failed, delayed, waiting] = await Promise.all(
          [
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
            queue.getWaitingCount(),
          ],
        );
        queues[queueName] = {
          name: queueName,
          active: active ?? 0,
          completed: completed ?? 0,
          failed: failed ?? 0,
          delayed: delayed ?? 0,
          paused: 0,
          waiting: waiting ?? 0,
        };
      } catch {
        queues[queueName] = {
          name: queueName,
          active: 0,
          completed: 0,
          failed: 0,
          delayed: 0,
          paused: 0,
          waiting: 0,
        };
      }
    }

    return reply.send({
      status: "healthy",
      queues,
      timestamp: new Date().toISOString(),
    });
  });

  // ─── Routes ───────────────────────────────────────────────────────────────
  await app.register(eventsRoutes, { prefix: "/v1/events" });
  await app.register(eventStreamRoutes, { prefix: "/v1/events" });
  await app.register(usersRoutes, { prefix: "/v1/users" });
  await app.register(userPreferencesRoutes, { prefix: "/v1" });
  await app.register(publicPreferencesRoutes); // Registers /v1/public/preferences routes
  await app.register(rulesRoutes, { prefix: "/v1/rules" });
  await app.register(analyticsRoutes, { prefix: "/v1/analytics" });
  await app.register(feedsRoutes, { prefix: "/v1/feeds" });
  await app.register(campaignsRoutes, { prefix: "/v1/campaigns" });
  await app.register(voiceRoutes, { prefix: "/v1/voice-campaigns" });
  await app.register(whatsappRoutes, { prefix: "/v1/whatsapp-campaigns" });
  await app.register(pushRoutes, { prefix: "/v1/push-campaigns" });
  await app.register(emailCampaignsRoutes, { prefix: "/v1/email-campaigns" });
  await app.register(smsCampaignsRoutes, { prefix: "/v1/sms-campaigns" });
  await app.register(providersRoutes, { prefix: "/v1/providers" });
  await app.register(templatesRoutes, { prefix: "/v1/templates" });
  await app.register(deliveriesRoutes, { prefix: "/v1/deliveries" });
  await app.register(webhooksRoutes, { prefix: "/webhooks" });
  await app.register(adminRoutes, { prefix: "/admin" });
  await app.register(embedRoutes, { prefix: "/embed" });

  return app;
}
