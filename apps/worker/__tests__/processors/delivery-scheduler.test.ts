import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createDeliveryScheduler } from "../../src/processors/delivery-scheduler.js";
import { prisma } from "@engage/database";
import type { Job } from "bullmq";
import Redis from "ioredis";
import { REDIS_KEYS } from "@engage/core";

vi.mock("@engage/event-bus", () => ({
  getQueue: vi.fn(() => ({ add: vi.fn().mockResolvedValue(undefined) })),
}));

// Skip if DATABASE_URL is not set or DB is not initialized
const skipIfNoDatabaseUrl = !process.env.DATABASE_URL
  ? describe.skip
  : describe;

skipIfNoDatabaseUrl("Delivery Scheduler with User Preferences", () => {
  // Track if DB setup failed (tables don't exist)
  let dbSetupFailed = false;
  let db: typeof prisma;
  let redis: Redis;
  let scheduler: (job: Job) => Promise<void>;
  let tenantId: string;
  let userId: string;
  let engagementDecisionId: string;

  beforeEach(async () => {
    // Skip all tests if setup fails (DB tables don't exist)
    if (dbSetupFailed) {
      return;
    }

    try {
      db = prisma;
      redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379");
      scheduler = createDeliveryScheduler(db, redis);

      // Create test tenant
      const tenant = await db.tenant.create({
        data: {
          slug: `test-delivery-${Date.now()}`,
          name: "Test Delivery Tenant",
          plan: "starter",
        },
      });
      tenantId = tenant.id;
    } catch (error) {
      // If DB setup fails (table doesn't exist), mark and skip all tests
      if (error instanceof Error && error.message.includes("does not exist")) {
        dbSetupFailed = true;
        console.warn(
          "[delivery-scheduler.test] Skipping tests: Database tables not initialized. Run: pnpm --filter @engage/database db:push",
        );
        // Use vi.stubGlobal to prevent test from failing
        return;
      }
      throw error;
    }

    // Create test user
    const user = await db.user.create({
      data: {
        tenantId,
        email: `test-${Date.now()}@example.com`,
        phone: "+1234567890",
        externalId: `ext-${Date.now()}`,
        timezone: "America/New_York",
      },
    });
    userId = user.id;

    // Create test event
    const event = await db.event.create({
      data: {
        tenantId,
        type: "test.event",
        userId,
        payload: JSON.stringify({ test: true }),
        receivedAt: new Date(),
      },
    });

    // Create engagement decision
    const decision = await db.engagementDecision.create({
      data: {
        tenantId,
        eventId: event.id,
        userId,
        channel: "email",
        decisionType: "send",
        reasoning: JSON.stringify({}),
        confidence: 0.95,
      },
    });
    engagementDecisionId = decision.id;

    // Create channel provider
    await db.channelProvider.create({
      data: {
        tenantId,
        channel: "email",
        provider: "resend",
        configEncrypted: JSON.stringify({}),
        isActive: true,
        isDefault: true,
      },
    });

    // Create template
    await db.template.create({
      data: {
        tenantId,
        name: "Test Template",
        channel: "email",
        subject: "Test Subject",
        body: "Test Body",
      },
    });
  });

  afterEach(async () => {
    // Skip cleanup if DB setup failed
    if (dbSetupFailed) {
      return;
    }

    // Cleanup
    try {
      await db.delivery.deleteMany({ where: { tenantId } });
      await db.engagementDecision.deleteMany({ where: { tenantId } });
      await db.event.deleteMany({ where: { tenantId } });
      await db.userPreference.deleteMany({ where: { tenantId } });
      await db.globalUnsubscribe.deleteMany({ where: { tenantId } });
      await db.template.deleteMany({ where: { tenantId } });
      await db.channelProvider.deleteMany({ where: { tenantId } });
      await db.user.deleteMany({ where: { tenantId } });
      await db.tenant.delete({ where: { id: tenantId } });
      await redis.flushdb();
      redis.disconnect();
    } catch (error) {
      // Ignore cleanup errors if DB is not available
      console.warn("[delivery-scheduler.test] Cleanup failed:", error);
    }
  });

  describe("Quiet Hours Enforcement", () => {
    it.skipIf(() => dbSetupFailed)(
      "should suppress delivery if user is in quiet hours",
      async () => {
        // Set user preference: quiet hours 22:00-08:00 (1320-480 minutes)
        await db.userPreference.create({
          data: {
            userId,
            tenantId,
            channel: "email",
            category: "all",
            enabled: true,
            quietHoursStart: 1320,
            quietHoursEnd: 480,
          },
        });

        // Mock current time to 23:00 EST (within quiet hours 22:00-08:00)
        const fakeNow = new Date("2024-01-15T23:00:00-05:00");
        vi.useFakeTimers();
        vi.setSystemTime(fakeNow);

        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("suppressed");
        expect(delivery?.metadata).toEqual({ reason: "quiet_hours" });

        vi.useRealTimers();
      },
    );

    it.skipIf(() => dbSetupFailed)(
      "should allow delivery if user is outside quiet hours",
      async () => {
        // Set user preference: quiet hours 22:00-08:00
        await db.userPreference.create({
          data: {
            userId,
            tenantId,
            channel: "email",
            category: "all",
            enabled: true,
            quietHoursStart: 1320,
            quietHoursEnd: 480,
          },
        });

        // Mock current time to 14:00 EST (outside quiet hours)
        const fakeNow = new Date("2024-01-15T14:00:00-05:00");
        vi.useFakeTimers();
        vi.setSystemTime(fakeNow);

        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("queued");

        vi.useRealTimers();
      },
    );
  });

  describe("Channel Preference Enforcement", () => {
    it.skipIf(() => dbSetupFailed)(
      "should suppress delivery if channel is disabled",
      async () => {
        // Create preference with channel disabled
        await db.userPreference.create({
          data: {
            userId,
            tenantId,
            channel: "email",
            category: "all",
            enabled: false,
          },
        });

        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("suppressed");
        expect(delivery?.metadata).toEqual({
          reason: "user_preference_disabled",
        });
      },
    );

    it.skipIf(() => dbSetupFailed)(
      "should allow delivery if channel is enabled",
      async () => {
        // Create preference with channel enabled
        await db.userPreference.create({
          data: {
            userId,
            tenantId,
            channel: "email",
            category: "all",
            enabled: true,
          },
        });

        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("queued");
      },
    );
  });

  describe("Category-Specific Preferences", () => {
    it.skipIf(() => dbSetupFailed)(
      "should suppress delivery if category-specific preference is disabled",
      async () => {
        // Create category-specific preference (disabled)
        await db.userPreference.create({
          data: {
            userId,
            tenantId,
            channel: "email",
            category: "promotions",
            enabled: false,
          },
        });

        // Create decision with category
        const _decision = await db.engagementDecision.findUnique({
          where: { id: engagementDecisionId },
        });

        await db.engagementDecision.update({
          where: { id: engagementDecisionId },
          data: {
            reasoning: JSON.stringify({ category: "promotions" }),
          },
        });

        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("suppressed");
        expect(delivery?.metadata).toEqual({
          reason: "category_preference_disabled",
        });
      },
    );
  });

  describe("Global Unsubscribe", () => {
    it.skipIf(() => dbSetupFailed)(
      "should suppress delivery if user globally unsubscribed",
      async () => {
        // Create global unsubscribe
        await db.globalUnsubscribe.create({
          data: {
            userId,
            tenantId,
            channel: "email",
            reason: "manual",
          },
        });

        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("suppressed");
        expect(delivery?.metadata).toEqual({ reason: "global_unsubscribe" });
      },
    );
  });

  describe("Frequency Cap", () => {
    it.skipIf(() => dbSetupFailed)(
      "should suppress delivery if frequency cap exceeded",
      async () => {
        // Set frequency cap to 1 per hour
        await db.tenant.update({
          where: { id: tenantId },
          data: {
            settings: JSON.stringify({ maxFrequencyPerHour: 1 }),
          },
        });

        // Simulate one message already sent
        const capKey = REDIS_KEYS.frequencyCap(tenantId, userId, "email");
        await redis.setex(capKey, 3600, "1");

        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("suppressed");
        expect(delivery?.metadata).toEqual({ reason: "frequency_cap" });
      },
    );

    it.skipIf(() => dbSetupFailed)(
      "should allow delivery and increment cap if under limit",
      async () => {
        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("queued");

        // Verify cap was incremented
        const capKey = REDIS_KEYS.frequencyCap(tenantId, userId, "email");
        const count = await redis.get(capKey);
        expect(count).toBe("1");
      },
    );
  });

  describe("Missing Recipient Data", () => {
    it.skipIf(() => dbSetupFailed)(
      "should suppress if email is missing",
      async () => {
        // Update user to remove email
        await db.user.update({
          where: { id: userId },
          data: { email: null },
        });

        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("suppressed");
        expect(delivery?.metadata).toEqual({ reason: "no_email" });
      },
    );

    it.skipIf(() => dbSetupFailed)(
      "should suppress if phone is missing for SMS",
      async () => {
        // Update user to remove phone
        await db.user.update({
          where: { id: userId },
          data: { phone: null },
        });

        // Create new decision for SMS
        const event = await db.event.findFirst({ where: { tenantId } });
        if (!event) throw new Error("Test setup error: event not found");
        const smsDecision = await db.engagementDecision.create({
          data: {
            tenantId,
            eventId: event.id,
            userId,
            channel: "sms",
            decisionType: "send",
            reasoning: JSON.stringify({}),
            confidence: 0.95,
          },
        });

        const mockJob = {
          data: {
            engagementDecisionId: smsDecision.id,
            tenantId,
            userId,
            channel: "sms",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId: smsDecision.id },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("suppressed");
        expect(delivery?.metadata).toEqual({ reason: "no_phone" });
      },
    );
  });

  describe("Template Variable Rendering", () => {
    it.skipIf(() => dbSetupFailed)(
      "renders Handlebars variables from event payload and user data into delivery body",
      async () => {
        // Replace the static template with one that has Handlebars syntax
        await db.template.deleteMany({ where: { tenantId } });
        await db.template.create({
          data: {
            tenantId,
            name: "Handlebars Template",
            channel: "email",
            subject: "Notificación para {{user.email}}",
            body: "Resultado: {{outcome}} — usuario: {{user.email}}",
          },
        });

        // Enrich the event payload with the variable used by the template
        const event = await db.event.findFirst({ where: { tenantId } });
        if (!event) throw new Error("Test setup error: event not found");
        await db.event.update({
          where: { id: event.id },
          data: { payload: JSON.stringify({ outcome: "exacto" }) },
        });

        const mockJob = {
          data: {
            engagementDecisionId,
            tenantId,
            userId,
            channel: "email",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("queued");
        const payload = delivery?.payload as Record<string, string>;
        // Variables must be substituted — no Handlebars syntax remaining
        expect(payload.body).not.toContain("{{outcome}}");
        expect(payload.body).not.toContain("{{user.email}}");
        expect(payload.body).toContain("exacto");
        expect(payload.subject).not.toContain("{{user.email}}");
      },
    );
  });

  describe("WhatsApp SID + templateVars Construction", () => {
    let waDecisionId: string;

    beforeEach(async () => {
      // Create WhatsApp channel provider
      await db.channelProvider.create({
        data: {
          tenantId,
          channel: "whatsapp",
          provider: "twilio-whatsapp",
          configEncrypted: JSON.stringify({}),
          isActive: true,
          isDefault: true,
        },
      });

      // User must have phone + whatsapp_consent
      await db.user.update({
        where: { id: userId },
        data: {
          phone: "+5491123456789",
          metadata: { whatsapp_consent: true },
        },
      });

      // Template with Twilio Content Template SID stored in subject
      await db.template.create({
        data: {
          tenantId,
          name: "wa_ganador_fecha",
          channel: "whatsapp",
          subject: "HX037ab7e8789f1de1575a26737ff8a233",
          body: "🏆 ¡{{1}} ganó {{2}}!\nCon {{3}} puntos exactos.",
        },
      });

      // Event with business_context payload used by the variable mapper
      const event = await db.event.findFirst({ where: { tenantId } });
      if (!event) throw new Error("Test setup error: event not found");
      await db.event.update({
        where: { id: event.id },
        data: {
          payload: JSON.stringify({
            business_context: {
              winner_name: "Carlos",
              position: "1",
              exact_points: "10",
            },
          }),
        },
      });

      const waDecision = await db.engagementDecision.create({
        data: {
          tenantId,
          eventId: event.id,
          userId,
          channel: "whatsapp",
          decisionType: "send",
          reasoning: JSON.stringify({}),
          confidence: 0.95,
        },
      });
      waDecisionId = waDecision.id;
    });

    it.skipIf(() => dbSetupFailed)(
      "stores twilioTemplateSid and mapped templateVars in delivery metadata",
      async () => {
        const mockJob = {
          data: {
            engagementDecisionId: waDecisionId,
            tenantId,
            userId,
            channel: "whatsapp",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId: waDecisionId },
        });

        expect(delivery).toBeDefined();
        expect(delivery?.status).toBe("queued");
        const metadata = delivery?.metadata as Record<string, unknown>;
        expect(metadata.twilioTemplateSid).toBe(
          "HX037ab7e8789f1de1575a26737ff8a233",
        );
        expect(metadata.templateVars).toEqual({
          "1": "Carlos",
          "2": "1",
          "3": "10",
        });
      },
    );

    it.skipIf(() => dbSetupFailed)(
      "does not set twilioTemplateSid when template subject is plain text",
      async () => {
        // Replace the SID template with a freeform one
        await db.template.deleteMany({
          where: { tenantId, channel: "whatsapp" },
        });
        await db.template.create({
          data: {
            tenantId,
            name: "wa_freeform",
            channel: "whatsapp",
            subject: "Mensaje freeform",
            body: "Hola, este es un mensaje libre sin SID",
          },
        });

        const mockJob = {
          data: {
            engagementDecisionId: waDecisionId,
            tenantId,
            userId,
            channel: "whatsapp",
          },
        } as unknown as Job;

        await scheduler(mockJob);

        const delivery = await db.delivery.findFirst({
          where: { tenantId, engagementDecisionId: waDecisionId },
        });

        expect(delivery).toBeDefined();
        const metadata = delivery?.metadata as Record<string, unknown>;
        expect(metadata.twilioTemplateSid).toBeUndefined();
        expect(metadata.templateVars).toBeUndefined();
      },
    );
  });
});
