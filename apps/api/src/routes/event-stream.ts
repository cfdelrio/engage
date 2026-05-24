import type { FastifyPluginAsync } from "fastify";
import websocket from "@fastify/websocket";
import { Redis } from "ioredis";
import { REDIS_KEYS } from "@engage/core";

const eventStreamRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(websocket);

  fastify.get("/stream", { websocket: true }, async (socket, request) => {
    // Authenticate via query param or header (WS can't set custom headers easily)
    const apiKey =
      (request.query as Record<string, string>)["apiKey"] ??
      request.headers["x-api-key"];

    if (!apiKey) {
      socket.close(4001, "Unauthorized");
      return;
    }

    // Reuse the existing auth logic by temporarily setting the header
    let tenantId: string;
    try {
      const { createHash } = await import("node:crypto");
      const keyHash = createHash("sha256")
        .update(apiKey as string)
        .digest("hex");

      const cached = await fastify.redis.get(REDIS_KEYS.apiKeyCache(keyHash));
      if (cached) {
        const parsed = JSON.parse(cached) as { tenantId: string };
        tenantId = parsed.tenantId;
      } else {
        const keyRecord = await fastify.prisma.tenantApiKey.findUnique({
          where: { keyHash },
          include: { tenant: true },
        });
        if (!keyRecord) {
          socket.close(4001, "Unauthorized");
          return;
        }
        tenantId = keyRecord.tenantId;
        await fastify.redis.setex(
          REDIS_KEYS.apiKeyCache(keyHash),
          300,
          JSON.stringify({ tenantId }),
        );
      }
    } catch {
      socket.close(4001, "Unauthorized");
      return;
    }

    // Create a dedicated subscriber connection per socket
    const subscriber = new Redis(
      process.env["REDIS_URL"] ?? "redis://localhost:6379",
      {
        maxRetriesPerRequest: null,
        enableReadyCheck: false,
      },
    );

    const channel = REDIS_KEYS.eventStream(tenantId);
    try {
      await subscriber.subscribe(channel);
    } catch (err) {
      fastify.log.error(
        { err, channel, tenantId },
        "Failed to subscribe to event stream channel",
      );
      socket.close(4500, "Subscription failed");
      await subscriber.quit().catch(() => {});
      return;
    }

    subscriber.on("message", (_chan: string, message: string) => {
      if (socket.readyState === socket.OPEN) {
        socket.send(message);
      }
    });

    // Send heartbeat every 30s to keep connection alive
    const heartbeat = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.send(JSON.stringify({ type: "ping", ts: Date.now() }));
      }
    }, 30_000);

    socket.on("close", async () => {
      clearInterval(heartbeat);
      await subscriber.unsubscribe(channel);
      await subscriber.quit();
    });

    socket.on("error", async () => {
      clearInterval(heartbeat);
      await subscriber.quit().catch(() => {});
    });
  });
};

export default eventStreamRoutes;
