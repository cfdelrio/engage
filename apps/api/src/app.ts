import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import redisPlugin from './plugins/redis.js';
import prismaPlugin from './plugins/prisma.js';
import apiKeyAuthPlugin from './plugins/api-key-auth.js';

import eventsRoutes from './routes/events.js';
import usersRoutes from './routes/users.js';
import rulesRoutes from './routes/rules.js';
import analyticsRoutes from './routes/analytics.js';
import feedsRoutes from './routes/feeds.js';
import webhooksRoutes from './routes/webhooks.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: process.env['LOG_LEVEL'] ?? 'info',
      transport:
        process.env['NODE_ENV'] !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    trustProxy: true,
  });

  // ─── Security ─────────────────────────────────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false });
  await app.register(cors, {
    origin: process.env['CORS_ORIGINS']?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  });
  await app.register(rateLimit, {
    global: true,
    max: 1000,
    timeWindow: '1 minute',
    keyGenerator: (req) => (req as { tenantId?: string }).tenantId ?? req.ip,
  });

  // ─── OpenAPI docs ─────────────────────────────────────────────────────────
  await app.register(swagger, {
    openapi: {
      info: { title: 'ORKESTAI ENGAGE API', version: '1.0.0' },
      tags: [{ name: 'events' }, { name: 'users' }, { name: 'rules' }, { name: 'analytics' }],
    },
  });
  await app.register(swaggerUi, { routePrefix: '/docs', uiConfig: { deepLinking: false } });

  // ─── Infrastructure plugins ───────────────────────────────────────────────
  await app.register(redisPlugin);
  await app.register(prismaPlugin);
  await app.register(apiKeyAuthPlugin);

  // ─── Health ───────────────────────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // ─── Routes ───────────────────────────────────────────────────────────────
  await app.register(eventsRoutes, { prefix: '/v1/events' });
  await app.register(usersRoutes, { prefix: '/v1/users' });
  await app.register(rulesRoutes, { prefix: '/v1/rules' });
  await app.register(analyticsRoutes, { prefix: '/v1/analytics' });
  await app.register(feedsRoutes, { prefix: '/v1/feeds' });
  await app.register(webhooksRoutes, { prefix: '/webhooks' });

  return app;
}
