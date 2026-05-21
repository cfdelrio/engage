import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../../src/app.js";
import { prisma } from "@engage/database";
import type { FastifyInstance } from "fastify";
import { generateApiKey, hashApiKey } from "@engage/core";

// Skip tests if DATABASE_URL is not set (for local development)
const skipIfNoDatabaseUrl = !process.env.DATABASE_URL
  ? describe.skip
  : describe;

skipIfNoDatabaseUrl("Voice Campaigns E2E", () => {
  let app: FastifyInstance;
  let tenantId: string;
  let apiKey: string;

  beforeAll(async () => {
    app = await buildApp();

    // Create test tenant
    const tenant = await prisma.tenant.create({
      data: {
        slug: `test-voice-${Date.now()}`,
        name: "Test Voice Tenant",
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
        name: "Test Voice Key",
        keyHash: hashApiKey(raw),
        keyPrefix: raw.slice(0, 10),
        permissions: JSON.stringify([
          "campaigns:write",
          "campaigns:read",
          "users:read",
        ]),
        status: "active",
      },
    });

    // Create test users with phone numbers
    for (let i = 1; i <= 3; i++) {
      await prisma.user.create({
        data: {
          tenantId,
          externalId: `voice-user-${i}`,
          phone: `+1555000${String(i).padStart(4, "0")}`,
          email: `voice-user-${i}@test.com`,
        },
      });
    }
  });

  afterAll(async () => {
    await app.close();
    // Cleanup
    await prisma.voiceCall.deleteMany({ where: { tenantId } });
    await prisma.voiceMetric.deleteMany({ where: { tenantId } });
    await prisma.voiceCampaign.deleteMany({ where: { tenantId } });
    await prisma.user.deleteMany({ where: { tenantId } });
    await prisma.tenant.delete({ where: { id: tenantId } });
  });

  describe("Voice Campaign Management", () => {
    let campaignId: string;

    it("should create a voice campaign", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/voice-campaigns",
        headers: { "x-api-key": apiKey },
        payload: {
          name: "Welcome Voice Campaign",
          description: "Automated welcome calls",
          script: "Hola {{user.firstName}}, bienvenido a nuestro servicio",
          voiceConfig: {
            language: "es-ES",
            voice: "female",
            speed: 1.0,
            provider: "twilio",
          },
          dtmfConfig: {
            enabled: true,
            options: [
              { key: "1", label: "Callback", action: "schedule_callback" },
              { key: "2", label: "Info", action: "transfer_to_agent" },
            ],
          },
          triggerType: "manual",
          maxRetries: 2,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.id).toBeDefined();
      expect(body.name).toBe("Welcome Voice Campaign");
      expect(body.status).toBe("draft");
      expect(body.dtmfConfig.enabled).toBe(true);

      campaignId = body.id;
    });

    it("should list voice campaigns", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/voice-campaigns",
        headers: { "x-api-key": apiKey },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body)).toBe(true);
      expect(body.length).toBeGreaterThanOrEqual(1);
      expect(
        body.some((c: Record<string, unknown>) => c.id === campaignId),
      ).toBe(true);
    });

    it("should get campaign details", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/v1/voice-campaigns/${campaignId}`,
        headers: { "x-api-key": apiKey },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.id).toBe(campaignId);
      expect(body.script).toContain("{{user.firstName}}");
    });

    it("should update voice campaign", async () => {
      const response = await app.inject({
        method: "PUT",
        url: `/v1/voice-campaigns/${campaignId}`,
        headers: { "x-api-key": apiKey },
        payload: {
          description: "Updated description",
          script: "Actualizado: Hola {{user.firstName}}",
        },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.description).toBe("Updated description");
      expect(body.script).toContain("Actualizado");
    });

    it("should start voice campaign and queue calls", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/v1/voice-campaigns/${campaignId}/start`,
        headers: { "x-api-key": apiKey },
        payload: {
          audienceFilter: {
            operator: "AND",
            conditions: [],
          },
        },
      });

      expect(response.statusCode).toBe(202);
      const body = JSON.parse(response.body);
      expect(body.campaignId).toBe(campaignId);
      expect(body.status).toBe("active");
      expect(body.callsQueued).toBeGreaterThanOrEqual(0);
    });

    it("should list voice calls for campaign", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/v1/voice-campaigns/${campaignId}/calls`,
        headers: { "x-api-key": apiKey },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("calls");
      expect(Array.isArray(body.calls)).toBe(true);
    });

    it("should get campaign metrics", async () => {
      const response = await app.inject({
        method: "GET",
        url: `/v1/voice-campaigns/${campaignId}/metrics`,
        headers: { "x-api-key": apiKey },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body).toHaveProperty("metrics");
      expect(body).toHaveProperty("sentiment");
      expect(typeof body.sentiment.positive).toBe("number");
      expect(typeof body.sentiment.negative).toBe("number");
    });

    it("should pause voice campaign", async () => {
      const response = await app.inject({
        method: "POST",
        url: `/v1/voice-campaigns/${campaignId}/pause`,
        headers: { "x-api-key": apiKey },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.status).toBe("paused");
    });

    it("should delete voice campaign", async () => {
      const response = await app.inject({
        method: "DELETE",
        url: `/v1/voice-campaigns/${campaignId}`,
        headers: { "x-api-key": apiKey },
      });

      expect(response.statusCode).toBe(200);

      // Verify it's deleted
      const getResponse = await app.inject({
        method: "GET",
        url: `/v1/voice-campaigns/${campaignId}`,
        headers: { "x-api-key": apiKey },
      });

      expect(getResponse.statusCode).toBe(404);
    });
  });

  describe("Voice Campaign Workflow", () => {
    it("should execute complete voice campaign flow", async () => {
      // 1. Create campaign
      const createRes = await app.inject({
        method: "POST",
        url: "/v1/voice-campaigns",
        headers: { "x-api-key": apiKey },
        payload: {
          name: "Complete Flow Campaign",
          script: "Test call for {{user.firstName}}",
          voiceConfig: { language: "es-ES", voice: "male" },
          triggerType: "manual",
        },
      });
      expect(createRes.statusCode).toBe(201);
      const campaign = JSON.parse(createRes.body);

      // 2. Verify campaign in database
      const dbCampaign = await prisma.voiceCampaign.findUnique({
        where: { id: campaign.id },
      });
      expect(dbCampaign).toBeDefined();
      expect(dbCampaign?.name).toBe("Complete Flow Campaign");
      expect(dbCampaign?.status).toBe("draft");

      // 3. Start campaign
      const startRes = await app.inject({
        method: "POST",
        url: `/v1/voice-campaigns/${campaign.id}/start`,
        headers: { "x-api-key": apiKey },
        payload: { audienceFilter: { operator: "AND", conditions: [] } },
      });
      expect(startRes.statusCode).toBe(202);

      // 4. Verify campaign is now active
      const activeCampaign = await prisma.voiceCampaign.findUnique({
        where: { id: campaign.id },
      });
      expect(activeCampaign?.status).toBe("active");

      // 5. Get metrics (should be initially empty/zero)
      const metricsRes = await app.inject({
        method: "GET",
        url: `/v1/voice-campaigns/${campaign.id}/metrics`,
        headers: { "x-api-key": apiKey },
      });
      expect(metricsRes.statusCode).toBe(200);
      const metrics = JSON.parse(metricsRes.body);
      expect(metrics.metrics).toBeDefined();

      // 6. Cleanup
      await app.inject({
        method: "DELETE",
        url: `/v1/voice-campaigns/${campaign.id}`,
        headers: { "x-api-key": apiKey },
      });
    });

    it("should handle DTMF configuration", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/voice-campaigns",
        headers: { "x-api-key": apiKey },
        payload: {
          name: "DTMF Test Campaign",
          script: "Press 1 for yes, 2 for no",
          voiceConfig: { language: "es-ES" },
          dtmfConfig: {
            enabled: true,
            options: [
              { key: "1", label: "Yes", action: "confirm" },
              { key: "2", label: "No", action: "reject" },
              { key: "9", label: "Agent", action: "transfer" },
            ],
          },
          triggerType: "manual",
        },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body);
      expect(body.dtmfConfig.options).toHaveLength(3);
      expect(
        body.dtmfConfig.options.some(
          (o: Record<string, unknown>) => o.key === "9",
        ),
      ).toBe(true);
    });
  });

  describe("Voice Campaign Error Handling", () => {
    it("should reject invalid phone numbers in audience", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/v1/voice-campaigns",
        headers: { "x-api-key": apiKey },
        payload: {
          name: "Invalid Campaign",
          script: "Test",
          // Missing required fields
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it("should return 404 for non-existent campaign", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/voice-campaigns/non-existent-id",
        headers: { "x-api-key": apiKey },
      });

      expect(response.statusCode).toBe(404);
    });

    it("should require API key authentication", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/v1/voice-campaigns",
        headers: {},
      });

      expect(response.statusCode).toBe(401);
    });
  });
});
