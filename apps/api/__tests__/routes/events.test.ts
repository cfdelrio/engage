import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { prisma } from "@engage/database";
import type { FastifyInstance } from "fastify";
import { generateApiKey, hashApiKey } from "@engage/core";

// Skip tests if DATABASE_URL is not set (for local development)
const skipIfNoDatabaseUrl = !process.env.DATABASE_URL
  ? describe.skip
  : describe;

skipIfNoDatabaseUrl("Event Ingestion Routes", () => {
  let app: FastifyInstance;
  let tenantId: string;
  let apiKey: string;
  let setupFailed = false;

  beforeAll(async () => {
    try {
      app = await buildApp();

      // Create test tenant
      const tenant = await prisma.tenant.create({
        data: {
          slug: `test-events-${Date.now()}`,
          name: "Test Events Tenant",
          plan: "starter",
        },
      });
      tenantId = tenant.id;

      // Create API key
      const { raw } = generateApiKey();
      apiKey = raw;
      await prisma.tenantApiKey.create({
        data: {
          tenantId,
          name: "Test Key",
          keyHash: hashApiKey(raw),
          keyPrefix: raw.slice(0, 10),
          permissions: JSON.stringify(["events:write", "events:read"]),
          status: "active",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes("does not exist")) {
        setupFailed = true;
        console.warn(
          "[events.test] Skipping tests: Database tables not initialized. Run: pnpm --filter @engage/database db:push",
        );
        return;
      }
      throw error;
    }
  });

  afterAll(async () => {
    if (app) await app.close();
    if (!tenantId || setupFailed) return;
    try {
      await prisma.tenant.delete({
        where: { id: tenantId },
      });
    } catch (error) {
      console.warn("[events.test] Cleanup failed:", error);
    }
  });

  beforeEach(async () => {
    // Clean up events before each test
    await prisma.event.deleteMany({
      where: { tenantId },
    });
  });

  describe("POST /v1/events", () => {
    it.skipIf(() => setupFailed)(
      "should ingest a single event successfully",
      async () => {
        const response = await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: { "x-api-key": apiKey },
          payload: {
            type: "user.signup",
            userId: "user123",
            payload: { email: "test@example.com" },
            metadata: { source: "web" },
          },
        });

        expect(response.statusCode).toBe(202);
        const body = JSON.parse(response.body);
        expect(body.eventId).toBeDefined();
        expect(body.status).toBe("queued");

        // Verify event was stored in database
        const event = await prisma.event.findFirst({
          where: { id: body.eventId },
        });
        expect(event).toBeDefined();
        expect(event?.type).toBe("user.signup");
        expect(event?.payload).toEqual({ email: "test@example.com" });
      },
    );

    it.skipIf(() => setupFailed)(
      "should automatically create user if not exists",
      async () => {
        const userId = `user-${Date.now()}`;
        const response = await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: { "x-api-key": apiKey },
          payload: {
            type: "user.signup",
            userId,
            payload: {},
          },
        });

        expect(response.statusCode).toBe(202);

        // Verify user was created
        const user = await prisma.user.findFirst({
          where: { tenantId, externalId: userId },
        });
        expect(user).toBeDefined();
      },
    );

    it.skipIf(() => setupFailed)(
      "should reject duplicate events with idempotencyKey",
      async () => {
        const idempotencyKey = `key-${Date.now()}`;

        // First request
        const response1 = await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: { "x-api-key": apiKey },
          payload: {
            type: "user.signup",
            userId: "user123",
            idempotencyKey,
          },
        });
        expect(response1.statusCode).toBe(202);

        // Duplicate request with same idempotencyKey
        const response2 = await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: { "x-api-key": apiKey },
          payload: {
            type: "user.signup",
            userId: "user123",
            idempotencyKey,
          },
        });

        expect(response2.statusCode).toBe(409);
        const body = JSON.parse(response2.body);
        expect(body.error).toBe("Duplicate event");
        expect(body.idempotencyKey).toBe(idempotencyKey);
      },
    );

    it.skipIf(() => setupFailed)(
      "should validate required fields",
      async () => {
        const response = await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: { "x-api-key": apiKey },
          payload: {
            userId: "user123",
            // missing type
          },
        });

        expect(response.statusCode).toBe(400);
      },
    );

    it.skipIf(() => setupFailed)(
      "should reject events without authentication",
      async () => {
        const response = await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: {},
          payload: {
            type: "user.signup",
            userId: "user123",
          },
        });

        expect(response.statusCode).toBe(401);
      },
    );

    it.skipIf(() => setupFailed)(
      "should accept optional timestamp",
      async () => {
        const timestamp = new Date("2024-01-01T10:00:00Z").toISOString();
        const response = await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: { "x-api-key": apiKey },
          payload: {
            type: "user.login",
            userId: "user123",
            timestamp,
          },
        });

        expect(response.statusCode).toBe(202);
        const body = JSON.parse(response.body);
        const event = await prisma.event.findUnique({
          where: { id: body.eventId },
        });
        expect(event?.receivedAt.toISOString()).toBe(timestamp);
      },
    );
  });

  describe("POST /v1/events/batch", () => {
    it.skipIf(() => setupFailed)(
      "should ingest multiple events in batch",
      async () => {
        const response = await app.inject({
          method: "POST",
          url: "/v1/events/batch",
          headers: { "x-api-key": apiKey },
          payload: [
            {
              type: "user.signup",
              userId: "user1",
              payload: { email: "user1@example.com" },
            },
            {
              type: "user.signup",
              userId: "user2",
              payload: { email: "user2@example.com" },
            },
            {
              type: "user.login",
              userId: "user3",
              payload: {},
            },
          ],
        });

        expect(response.statusCode).toBe(202);
        const body = JSON.parse(response.body);
        expect(body.batchId).toBeDefined();
        expect(body.total).toBe(3);
        expect(body.succeeded).toBe(3);
        expect(body.failed).toBe(0);
        expect(body.events).toHaveLength(3);

        // Verify all events were stored
        const events = await prisma.event.findMany({
          where: { tenantId },
        });
        expect(events.length).toBeGreaterThanOrEqual(3);
      },
    );

    it.skipIf(() => setupFailed)(
      "should handle duplicate events in batch",
      async () => {
        const idempotencyKey = `batch-key-${Date.now()}`;

        const response = await app.inject({
          method: "POST",
          url: "/v1/events/batch",
          headers: { "x-api-key": apiKey },
          payload: [
            {
              type: "user.signup",
              userId: "user1",
              idempotencyKey,
            },
            {
              type: "user.signup",
              userId: "user1",
              idempotencyKey, // duplicate
            },
            {
              type: "user.login",
              userId: "user2",
            },
          ],
        });

        expect(response.statusCode).toBe(202);
        const body = JSON.parse(response.body);
        expect(body.total).toBe(3);
        expect(body.succeeded).toBe(2);
        expect(body.failed).toBe(1);
        expect(body.events[1].status).toBe("duplicate");
      },
    );

    it.skipIf(() => setupFailed)(
      "should reject batch with invalid items at validation stage",
      async () => {
        const response = await app.inject({
          method: "POST",
          url: "/v1/events/batch",
          headers: { "x-api-key": apiKey },
          payload: [
            {
              type: "user.signup",
              userId: "valid-user",
            },
            {
              userId: "user-missing-type",
              // missing type - Fastify validates entire batch upfront
            },
          ],
        });

        // Fastify+Zod validates the entire body before handler runs
        // One invalid item → 400 for whole batch (not partial 202)
        expect(response.statusCode).toBe(400);
      },
    );
  });

  describe("POST /v1/events/:eventId/replay", () => {
    it.skipIf(() => setupFailed)(
      "should replay an event successfully",
      async () => {
        // Create an event first
        const createResponse = await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: { "x-api-key": apiKey },
          payload: {
            type: "user.signup",
            userId: "user123",
            payload: { email: "test@example.com" },
          },
        });

        const eventId = JSON.parse(createResponse.body).eventId;

        // Replay the event
        const replayResponse = await app.inject({
          method: "POST",
          url: `/v1/events/${eventId}/replay`,
          headers: { "x-api-key": apiKey },
        });

        expect(replayResponse.statusCode).toBe(202);
        const body = JSON.parse(replayResponse.body);
        expect(body.originalEventId).toBe(eventId);
        expect(body.replayEventId).toBeDefined();
        expect(body.status).toBe("queued");

        // Verify replayed event exists
        const replayedEvent = await prisma.event.findUnique({
          where: { id: body.replayEventId },
        });
        expect(replayedEvent).toBeDefined();
        expect(replayedEvent?.metadata).toEqual({ replayedFrom: eventId });
      },
    );

    it.skipIf(() => setupFailed)(
      "should return 404 for non-existent event",
      async () => {
        const response = await app.inject({
          method: "POST",
          url: "/v1/events/non-existent-id/replay",
          headers: { "x-api-key": apiKey },
        });

        expect(response.statusCode).toBe(404);
      },
    );
  });

  describe("GET /v1/events/:eventId", () => {
    it.skipIf(() => setupFailed)("should retrieve event by ID", async () => {
      // Create an event
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/events",
        headers: { "x-api-key": apiKey },
        payload: {
          type: "user.signup",
          userId: "user123",
          payload: { email: "test@example.com" },
        },
      });

      const eventId = JSON.parse(createResponse.body).eventId;

      // Retrieve the event
      const getResponse = await app.inject({
        method: "GET",
        url: `/v1/events/${eventId}`,
        headers: { "x-api-key": apiKey },
      });

      expect(getResponse.statusCode).toBe(200);
      const body = JSON.parse(getResponse.body);
      expect(body.id).toBe(eventId);
      expect(body.type).toBe("user.signup");
      expect(body.payload).toEqual({ email: "test@example.com" });
    });

    it.skipIf(() => setupFailed)(
      "should return 404 for non-existent event",
      async () => {
        const response = await app.inject({
          method: "GET",
          url: "/v1/events/non-existent-id",
          headers: { "x-api-key": apiKey },
        });

        expect(response.statusCode).toBe(404);
      },
    );
  });

  describe("GET /health/workers", () => {
    it.skipIf(() => setupFailed)(
      "should return queue health metrics",
      async () => {
        const response = await app.inject({
          method: "GET",
          url: "/health/workers",
        });

        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.body);
        expect(body.status).toBe("healthy");
        expect(body.queues).toBeDefined();
        expect(body.timestamp).toBeDefined();

        // Verify queue structure
        Object.values(body.queues).forEach((queue: unknown) => {
          const q = queue as Record<string, unknown>;
          expect(q.name).toBeDefined();
          expect(typeof q.active).toBe("number");
          expect(typeof q.completed).toBe("number");
          expect(typeof q.failed).toBe("number");
        });
      },
    );
  });
});
