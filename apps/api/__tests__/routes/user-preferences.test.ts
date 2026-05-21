import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { buildApp } from "../../src/app.js";
import { prisma } from "@engage/database";
import type { FastifyInstance } from "fastify";
import { generateApiKey, hashApiKey } from "@engage/core";

// Skip tests if DATABASE_URL is not set (for local development)
const skipIfNoDatabaseUrl = !process.env.DATABASE_URL
  ? describe.skip
  : describe;

skipIfNoDatabaseUrl("User Preferences Routes", () => {
  let app: FastifyInstance;
  let tenantId: string;
  let userId: string;
  let apiKey: string;

  beforeAll(async () => {
    app = await buildApp();

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        slug: `test-pref-${Date.now()}`,
        name: "Test Preferences Tenant",
        plan: "starter",
      },
    });
    tenantId = tenant.id;

    // Create API key
    const { raw, hash: _hash } = generateApiKey();
    apiKey = raw;
    await prisma.tenantApiKey.create({
      data: {
        tenantId,
        name: "Test Key",
        keyHash: hashApiKey(raw),
        keyPrefix: raw.slice(0, 10),
        permissions: JSON.stringify([
          "events:write",
          "users:read",
          "users:write",
        ]),
        status: "active",
      },
    });

    // Create test user
    const user = await prisma.user.create({
      data: {
        tenantId,
        email: `test-${Date.now()}@example.com`,
        externalId: `ext-${Date.now()}`,
        timezone: "America/Buenos_Aires",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    // Cleanup
    await prisma.userPreference.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenantApiKey.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
    await app.close();
  });

  beforeEach(async () => {
    // Clean preferences before each test
    await prisma.userPreference.deleteMany({ where: { tenantId } });
  });

  describe("GET /v1/users/:userId/preferences", () => {
    it("should return empty array for new user", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/users/${userId}/preferences`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(200);
      expect(JSON.parse(res.body)).toEqual([]);
    });

    it("should list all preferences for a user", async () => {
      // Create some preferences
      await prisma.userPreference.createMany({
        data: [
          {
            userId,
            tenantId,
            channel: "email",
            category: "all",
            enabled: true,
            quietHoursStart: null,
            quietHoursEnd: null,
          },
          {
            userId,
            tenantId,
            channel: "sms",
            category: "promotions",
            enabled: false,
            quietHoursStart: 1320,
            quietHoursEnd: 480,
          },
          {
            userId,
            tenantId,
            channel: "push",
            category: "all",
            enabled: true,
            quietHoursStart: null,
            quietHoursEnd: null,
          },
        ],
      });

      const res = await app.inject({
        method: "GET",
        url: `/v1/users/${userId}/preferences`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(200);
      const prefs = JSON.parse(res.body);
      expect(prefs).toHaveLength(3);
      expect(prefs[0].channel).toBe("email");
      expect(prefs[1].channel).toBe("push");
      expect(prefs[2].channel).toBe("sms");
    });

    it("should return 404 for non-existent user", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/users/nonexistent-user-id/preferences`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("User not found");
    });

    it("should filter preferences by tenant", async () => {
      // Create another tenant
      const otherTenant = await prisma.tenant.create({
        data: {
          slug: `other-pref-${Date.now()}`,
          name: "Other Tenant",
          plan: "starter",
        },
      });

      // Create API key for other tenant
      const { raw } = generateApiKey();
      await prisma.tenantApiKey.create({
        data: {
          tenantId: otherTenant.id,
          name: "Other Key",
          keyHash: hashApiKey(raw),
          keyPrefix: raw.slice(0, 10),
          permissions: JSON.stringify(["events:write"]),
          status: "active",
        },
      });

      // Create preference in other tenant
      await prisma.userPreference.create({
        data: {
          userId,
          tenantId: otherTenant.id,
          channel: "email",
          category: "all",
          enabled: true,
        },
      });

      // Create preference in current tenant
      await prisma.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: "sms",
          category: "all",
          enabled: true,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/v1/users/${userId}/preferences`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(200);
      const prefs = JSON.parse(res.body);
      expect(prefs).toHaveLength(1);
      expect(prefs[0].channel).toBe("sms");

      // Cleanup
      await prisma.userPreference.deleteMany({
        where: { tenantId: otherTenant.id },
      });
      await prisma.tenant.delete({ where: { id: otherTenant.id } });
    });
  });

  describe("GET /v1/users/:userId/preferences/:channel", () => {
    it("should get preference for specific channel", async () => {
      await prisma.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: "email",
          category: "all",
          enabled: true,
          quietHoursStart: 1380,
          quietHoursEnd: 420,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/v1/users/${userId}/preferences/email`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(200);
      const pref = JSON.parse(res.body);
      expect(pref.channel).toBe("email");
      expect(pref.enabled).toBe(true);
      expect(pref.quietHoursStart).toBe(1380);
      expect(pref.quietHoursEnd).toBe(420);
    });

    it("should get preference with category query param", async () => {
      await prisma.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: "sms",
          category: "promotions",
          enabled: false,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/v1/users/${userId}/preferences/sms?category=promotions`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(200);
      const pref = JSON.parse(res.body);
      expect(pref.category).toBe("promotions");
      expect(pref.enabled).toBe(false);
    });

    it('should default to "all" category', async () => {
      await prisma.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: "push",
          category: "all",
          enabled: true,
        },
      });

      const res = await app.inject({
        method: "GET",
        url: `/v1/users/${userId}/preferences/push`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(200);
      const pref = JSON.parse(res.body);
      expect(pref.category).toBe("all");
    });

    it("should return 404 for non-existent preference", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/users/${userId}/preferences/email`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("Preference not found");
    });
  });

  describe("PUT /v1/users/:userId/preferences", () => {
    it("should create new preferences", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/v1/users/${userId}/preferences`,
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        payload: {
          preferences: [
            {
              channel: "email",
              category: "alerts",
              enabled: true,
              quietHoursStart: 1320,
              quietHoursEnd: 480,
            },
            {
              channel: "sms",
              enabled: false,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const prefs = JSON.parse(res.body);
      expect(prefs).toHaveLength(2);
      expect(prefs[0].channel).toBe("email");
      expect(prefs[0].category).toBe("alerts");
      expect(prefs[0].quietHoursStart).toBe(1320);
      expect(prefs[1].channel).toBe("sms");
      expect(prefs[1].category).toBe("all");
      expect(prefs[1].enabled).toBe(false);
    });

    it("should update existing preferences via upsert", async () => {
      // Create initial preference
      await prisma.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: "email",
          category: "all",
          enabled: true,
          quietHoursStart: null,
          quietHoursEnd: null,
        },
      });

      // Update via PUT
      const res = await app.inject({
        method: "PUT",
        url: `/v1/users/${userId}/preferences`,
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        payload: {
          preferences: [
            {
              channel: "email",
              enabled: false,
              quietHoursStart: 1320,
              quietHoursEnd: 480,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const prefs = JSON.parse(res.body);
      expect(prefs[0].enabled).toBe(false);
      expect(prefs[0].quietHoursStart).toBe(1320);
    });

    it("should validate quiet hours range", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/v1/users/${userId}/preferences`,
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        payload: {
          preferences: [
            {
              channel: "email",
              quietHoursStart: 1500, // Invalid: > 1439
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should require channel field", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/v1/users/${userId}/preferences`,
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        payload: {
          preferences: [
            {
              enabled: true,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(400);
    });

    it("should return 404 for non-existent user", async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/v1/users/nonexistent-user-id/preferences`,
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        payload: {
          preferences: [
            {
              channel: "email",
              enabled: true,
            },
          ],
        },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("User not found");
    });

    it('should default category to "all" and enabled to true', async () => {
      const res = await app.inject({
        method: "PUT",
        url: `/v1/users/${userId}/preferences`,
        headers: { "x-api-key": apiKey, "content-type": "application/json" },
        payload: {
          preferences: [
            {
              channel: "email",
            },
          ],
        },
      });

      expect(res.statusCode).toBe(200);
      const prefs = JSON.parse(res.body);
      expect(prefs[0].category).toBe("all");
      expect(prefs[0].enabled).toBe(true);
    });
  });

  describe("DELETE /v1/users/:userId/preferences/:channel", () => {
    it("should soft delete preference by disabling", async () => {
      await prisma.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: "email",
          category: "all",
          enabled: true,
        },
      });

      const res = await app.inject({
        method: "DELETE",
        url: `/v1/users/${userId}/preferences/email`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(204);

      const pref = await prisma.userPreference.findUnique({
        where: {
          userId_tenantId_channel_category: {
            userId,
            tenantId,
            channel: "email",
            category: "all",
          },
        },
      });

      expect(pref?.enabled).toBe(false);
    });

    it("should support category query param", async () => {
      await prisma.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: "sms",
          category: "promotions",
          enabled: true,
        },
      });

      const res = await app.inject({
        method: "DELETE",
        url: `/v1/users/${userId}/preferences/sms?category=promotions`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(204);

      const pref = await prisma.userPreference.findUnique({
        where: {
          userId_tenantId_channel_category: {
            userId,
            tenantId,
            channel: "sms",
            category: "promotions",
          },
        },
      });

      expect(pref?.enabled).toBe(false);
    });

    it("should return 404 for non-existent preference", async () => {
      const res = await app.inject({
        method: "DELETE",
        url: `/v1/users/${userId}/preferences/email`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("Preference not found");
    });
  });

  describe("POST /v1/users/:userId/preferences/reset", () => {
    it("should delete all preferences for user", async () => {
      // Create some preferences
      await prisma.userPreference.createMany({
        data: [
          {
            userId,
            tenantId,
            channel: "email",
            category: "all",
            enabled: true,
          },
          {
            userId,
            tenantId,
            channel: "sms",
            category: "all",
            enabled: false,
          },
          {
            userId,
            tenantId,
            channel: "push",
            category: "promotions",
            enabled: true,
          },
        ],
      });

      const res = await app.inject({
        method: "POST",
        url: `/v1/users/${userId}/preferences/reset`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(204);

      const remaining = await prisma.userPreference.findMany({
        where: { userId, tenantId },
      });

      expect(remaining).toHaveLength(0);
    });

    it("should return 404 for non-existent user", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/v1/users/nonexistent-user-id/preferences/reset`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(404);
      expect(JSON.parse(res.body).error).toBe("User not found");
    });

    it("should handle resetting empty preferences gracefully", async () => {
      const res = await app.inject({
        method: "POST",
        url: `/v1/users/${userId}/preferences/reset`,
        headers: { "x-api-key": apiKey },
      });

      expect(res.statusCode).toBe(204);
    });
  });

  describe("Authentication", () => {
    it("should reject requests without API key", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/users/${userId}/preferences`,
      });

      expect(res.statusCode).toBe(401);
    });

    it("should reject requests with invalid API key", async () => {
      const res = await app.inject({
        method: "GET",
        url: `/v1/users/${userId}/preferences`,
        headers: { "x-api-key": "invalid-key" },
      });

      expect(res.statusCode).toBe(401);
    });
  });
});
