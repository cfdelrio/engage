import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import { prisma } from "@engage/database";
import type { FastifyInstance } from "fastify";
import { generateApiKey, hashApiKey } from "@engage/core";

// Skip tests if DATABASE_URL is not set (for local development)
const skipIfNoDatabaseUrl = !process.env.DATABASE_URL
  ? describe.skip
  : describe;

skipIfNoDatabaseUrl("Event-to-Delivery Integration", () => {
  let app: FastifyInstance;
  let tenantId: string;
  let apiKey: string;

  beforeAll(async () => {
    app = await buildApp();

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        slug: `test-e2e-${Date.now()}`,
        name: "Test E2E Tenant",
        plan: "starter",
      },
    });
    tenantId = tenant.id;

    // Create API key with all permissions
    const { raw } = generateApiKey();
    apiKey = raw;
    await prisma.tenantApiKey.create({
      data: {
        tenantId,
        name: "E2E Test Key",
        keyHash: hashApiKey(raw),
        keyPrefix: raw.slice(0, 10),
        permissions: JSON.stringify([
          "events:write",
          "events:read",
          "deliveries:read",
          "campaigns:read",
        ]),
        status: "active",
      },
    });

    // Create a test campaign with rules
    await prisma.campaign.create({
      data: {
        tenantId,
        name: "Test Campaign",
        type: "manual",
        status: "active",
        channels: ["email"],
        trigger: JSON.stringify({
          type: "event-triggered",
          eventType: "user.signup",
        }),
        rules: JSON.stringify({
          operator: "AND",
          conditions: [
            { field: "event.type", operator: "eq", value: "user.signup" },
          ],
        }),
      },
    });

    // Create a template
    await prisma.template.create({
      data: {
        tenantId,
        name: "Welcome Email",
        channel: "email",
        subject: "Welcome to {{service}}",
        body: "Hello {{firstName}}, welcome!",
        variables: ["service", "firstName"],
        version: 1,
      },
    });
  });

  afterAll(async () => {
    if (app) await app.close();
    if (!tenantId) return;
    await prisma.delivery.deleteMany({ where: { tenantId } });
    await prisma.engagementDecision.deleteMany({ where: { tenantId } });
    await prisma.event.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.campaign.deleteMany({ where: { tenantId } });
    await prisma.template.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  describe("Complete event flow with analytics", () => {
    it("should create user, ingest event, and expose analytics", async () => {
      const userId = `test-user-${Date.now()}`;

      // Step 1: Check initial state
      const initialUsers = await app.inject({
        method: "GET",
        url: "/v1/analytics/overview",
        headers: { "x-api-key": apiKey },
      });
      expect(initialUsers.statusCode).toBe(200);
      const initialData = JSON.parse(initialUsers.body);
      const initialUserCount = initialData.totalUsers;

      // Step 2: Ingest an event
      const eventResponse = await app.inject({
        method: "POST",
        url: "/v1/events",
        headers: { "x-api-key": apiKey },
        payload: {
          type: "user.signup",
          userId,
          payload: {
            firstName: "John",
            email: "john@example.com",
          },
          metadata: {
            source: "web",
          },
        },
      });

      expect(eventResponse.statusCode).toBe(202);
      const eventData = JSON.parse(eventResponse.body);
      const eventId = eventData.eventId;
      expect(eventId).toBeDefined();

      // Step 3: Verify event was stored
      const getEventResponse = await app.inject({
        method: "GET",
        url: `/v1/events/${eventId}`,
        headers: { "x-api-key": apiKey },
      });
      expect(getEventResponse.statusCode).toBe(200);
      const storedEvent = JSON.parse(getEventResponse.body);
      expect(storedEvent.type).toBe("user.signup");
      expect(storedEvent.payload.email).toBe("john@example.com");

      // Step 4: Verify user was created
      const user = await prisma.user.findFirst({
        where: { tenantId, externalId: userId },
      });
      expect(user).toBeDefined();
      expect(user?.email).not.toBeDefined(); // Email stored in event payload, not user record

      // Step 5: Check analytics reflect the new user
      const updatedAnalytics = await app.inject({
        method: "GET",
        url: "/v1/analytics/overview",
        headers: { "x-api-key": apiKey },
      });
      expect(updatedAnalytics.statusCode).toBe(200);
      const updatedData = JSON.parse(updatedAnalytics.body);
      expect(updatedData.totalUsers).toBe(initialUserCount + 1);
      expect(updatedData.recentEvents).toBeGreaterThan(0);
    });

    it("should handle batch event ingestion with analytics", async () => {
      const baseUserId = `batch-user-${Date.now()}`;

      // Ingest batch of events
      const batchResponse = await app.inject({
        method: "POST",
        url: "/v1/events/batch",
        headers: { "x-api-key": apiKey },
        payload: [
          {
            type: "user.signup",
            userId: `${baseUserId}-1`,
            payload: { firstName: "Alice" },
          },
          {
            type: "user.signup",
            userId: `${baseUserId}-2`,
            payload: { firstName: "Bob" },
          },
          {
            type: "user.signup",
            userId: `${baseUserId}-3`,
            payload: { firstName: "Charlie" },
          },
        ],
      });

      expect(batchResponse.statusCode).toBe(202);
      const batchData = JSON.parse(batchResponse.body);
      expect(batchData.succeeded).toBe(3);
      expect(batchData.total).toBe(3);

      // Check all users were created
      const users = await prisma.user.findMany({
        where: { tenantId, externalId: { startsWith: baseUserId } },
      });
      expect(users.length).toBe(3);

      // Check all events were stored
      const events = await prisma.event.findMany({
        where: { tenantId, userId: { in: users.map((u) => u.id) } },
      });
      expect(events.length).toBe(3);

      // Check channel analytics
      const channelAnalytics = await app.inject({
        method: "GET",
        url: "/v1/analytics/channels",
        headers: { "x-api-key": apiKey },
      });
      expect(channelAnalytics.statusCode).toBe(200);
    });

    it("should expose event type breakdown in analytics", async () => {
      const userId = `analytics-user-${Date.now()}`;

      // Ingest multiple event types
      const types = ["user.signup", "user.login", "user.profile_updated"];
      for (const type of types) {
        await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: { "x-api-key": apiKey },
          payload: {
            type,
            userId,
            payload: { action: type },
          },
        });
      }

      // Check event breakdown
      const eventsAnalytics = await app.inject({
        method: "GET",
        url: "/v1/analytics/events",
        headers: { "x-api-key": apiKey },
      });

      expect(eventsAnalytics.statusCode).toBe(200);
      const eventBreakdown = JSON.parse(eventsAnalytics.body);

      // Should contain entries for our event types
      const eventTypes = eventBreakdown.map(
        (e: Record<string, unknown>) => e.type,
      );
      expect(eventTypes).toContain("user.signup");
    });

    it("should provide time-series analytics", async () => {
      const userId = `timeseries-user-${Date.now()}`;

      // Ingest a few events
      for (let i = 0; i < 3; i++) {
        await app.inject({
          method: "POST",
          url: "/v1/events",
          headers: { "x-api-key": apiKey },
          payload: {
            type: "user.action",
            userId,
            payload: { action: `action-${i}` },
          },
        });
      }

      // Get time-series data
      const timeseriesResponse = await app.inject({
        method: "GET",
        url: "/v1/analytics/timeseries?windowDays=7",
        headers: { "x-api-key": apiKey },
      });

      expect(timeseriesResponse.statusCode).toBe(200);
      const timeseriesData = JSON.parse(timeseriesResponse.body);

      // Verify structure
      expect(timeseriesData.windowDays).toBe(7);
      expect(Array.isArray(timeseriesData.series)).toBe(true);
      expect(timeseriesData.series.length).toBeGreaterThan(0);

      // Each series entry should have date and channel counts
      const entry = timeseriesData.series[0];
      expect(entry).toHaveProperty("date");
      expect(entry).toHaveProperty("email");
      expect(entry).toHaveProperty("sms");
      expect(entry).toHaveProperty("push");
    });

    it("should handle duplicate events with deduplication", async () => {
      const userId = `dedup-user-${Date.now()}`;
      const idempotencyKey = `dedup-key-${Date.now()}`;

      // First event
      const firstResponse = await app.inject({
        method: "POST",
        url: "/v1/events",
        headers: { "x-api-key": apiKey },
        payload: {
          type: "user.action",
          userId,
          payload: { action: "purchase" },
          idempotencyKey,
        },
      });
      expect(firstResponse.statusCode).toBe(202);

      // Duplicate event with same idempotencyKey
      const secondResponse = await app.inject({
        method: "POST",
        url: "/v1/events",
        headers: { "x-api-key": apiKey },
        payload: {
          type: "user.action",
          userId,
          payload: { action: "purchase" },
          idempotencyKey,
        },
      });
      expect(secondResponse.statusCode).toBe(409);

      // Verify only one event was created
      const events = await prisma.event.findMany({
        where: { tenantId, userId, idempotencyKey },
      });
      expect(events.length).toBe(1);
    });

    it("should replay events correctly", async () => {
      const userId = `replay-user-${Date.now()}`;

      // Create original event
      const createResponse = await app.inject({
        method: "POST",
        url: "/v1/events",
        headers: { "x-api-key": apiKey },
        payload: {
          type: "user.purchase",
          userId,
          payload: { amount: 99.99 },
        },
      });

      const originalEventId = JSON.parse(createResponse.body).eventId;

      // Replay the event
      const replayResponse = await app.inject({
        method: "POST",
        url: `/v1/events/${originalEventId}/replay`,
        headers: { "x-api-key": apiKey },
      });

      expect(replayResponse.statusCode).toBe(202);
      const replayData = JSON.parse(replayResponse.body);
      expect(replayData.originalEventId).toBe(originalEventId);
      expect(replayData.replayEventId).toBeDefined();

      // Verify replayed event has metadata
      const replayedEvent = await prisma.event.findUnique({
        where: { id: replayData.replayEventId },
      });
      expect(replayedEvent).toBeDefined();
      expect(replayedEvent?.metadata).toContain("replayedFrom");
    });
  });

  describe("Error scenarios", () => {
    it("should reject unauthorized requests", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        headers: { "x-api-key": "invalid-key" },
        payload: {
          type: "user.action",
          userId: "user123",
        },
      });

      expect(response.statusCode).toBe(401);
    });

    it("should handle invalid event payloads", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        headers: { "x-api-key": apiKey },
        payload: {
          type: "", // Invalid - too short
          userId: "user123",
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should handle missing required fields", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/events",
        headers: { "x-api-key": apiKey },
        payload: {
          // Missing 'type' and 'userId'
          payload: { action: "test" },
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });
});
