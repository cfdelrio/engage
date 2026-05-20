import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createDeliveryScheduler } from '../../src/processors/delivery-scheduler.js';
import { prisma } from '@engage/database';
import type { Job } from 'bullmq';
import Redis from 'ioredis';
import { REDIS_KEYS } from '@engage/core';

// Skip if DATABASE_URL is not set
const skipIfNoDatabaseUrl = !process.env.DATABASE_URL ? describe.skip : describe;

skipIfNoDatabaseUrl('Delivery Scheduler with User Preferences', () => {
  let db: typeof prisma;
  let redis: Redis;
  let scheduler: (job: Job) => Promise<void>;
  let tenantId: string;
  let userId: string;
  let engagementDecisionId: string;

  beforeEach(async () => {
    db = prisma;
    redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    scheduler = createDeliveryScheduler(db, redis);

    // Create test tenant
    const tenant = await db.tenant.create({
      data: {
        slug: `test-delivery-${Date.now()}`,
        name: 'Test Delivery Tenant',
        plan: 'starter',
      },
    });
    tenantId = tenant.id;

    // Create test user
    const user = await db.user.create({
      data: {
        tenantId,
        email: `test-${Date.now()}@example.com`,
        phone: '+1234567890',
        externalId: `ext-${Date.now()}`,
        timezone: 'America/New_York',
      },
    });
    userId = user.id;

    // Create test event
    const event = await db.event.create({
      data: {
        tenantId,
        type: 'test.event',
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
        channel: 'email',
        decisionType: 'send',
        reasoning: JSON.stringify({}),
        confidence: 0.95,
      },
    });
    engagementDecisionId = decision.id;

    // Create channel provider
    await db.channelProvider.create({
      data: {
        tenantId,
        channel: 'email',
        provider: 'resend',
        configEncrypted: JSON.stringify({}),
        isActive: true,
        isDefault: true,
      },
    });

    // Create template
    await db.template.create({
      data: {
        tenantId,
        name: 'Test Template',
        channel: 'email',
        subject: 'Test Subject',
        body: 'Test Body',
      },
    });
  });

  afterEach(async () => {
    // Cleanup
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
  });

  describe('Quiet Hours Enforcement', () => {
    it('should suppress delivery if user is in quiet hours', async () => {
      // Set user preference: quiet hours 22:00-08:00 (1320-480 minutes)
      await db.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: 'email',
          category: 'all',
          enabled: true,
          quietHoursStart: 1320,
          quietHoursEnd: 480,
        },
      });

      // Mock current time to 23:00 EST (within quiet hours 22:00-08:00)
      const fakeNow = new Date('2024-01-15T23:00:00-05:00');
      vi.useFakeTimers();
      vi.setSystemTime(fakeNow);

      const mockJob = {
        data: {
          engagementDecisionId,
          tenantId,
          userId,
          channel: 'email',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('suppressed');
      expect(delivery?.metadata).toEqual({ reason: 'quiet_hours' });

      vi.useRealTimers();
    });

    it('should allow delivery if user is outside quiet hours', async () => {
      // Set user preference: quiet hours 22:00-08:00
      await db.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: 'email',
          category: 'all',
          enabled: true,
          quietHoursStart: 1320,
          quietHoursEnd: 480,
        },
      });

      // Mock current time to 14:00 EST (outside quiet hours)
      const fakeNow = new Date('2024-01-15T14:00:00-05:00');
      vi.useFakeTimers();
      vi.setSystemTime(fakeNow);

      const mockJob = {
        data: {
          engagementDecisionId,
          tenantId,
          userId,
          channel: 'email',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('queued');

      vi.useRealTimers();
    });
  });

  describe('Channel Preference Enforcement', () => {
    it('should suppress delivery if channel is disabled', async () => {
      // Create preference with channel disabled
      await db.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: 'email',
          category: 'all',
          enabled: false,
        },
      });

      const mockJob = {
        data: {
          engagementDecisionId,
          tenantId,
          userId,
          channel: 'email',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('suppressed');
      expect(delivery?.metadata).toEqual({ reason: 'user_preference_disabled' });
    });

    it('should allow delivery if channel is enabled', async () => {
      // Create preference with channel enabled
      await db.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: 'email',
          category: 'all',
          enabled: true,
        },
      });

      const mockJob = {
        data: {
          engagementDecisionId,
          tenantId,
          userId,
          channel: 'email',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('queued');
    });
  });

  describe('Category-Specific Preferences', () => {
    it('should suppress delivery if category-specific preference is disabled', async () => {
      // Create category-specific preference (disabled)
      await db.userPreference.create({
        data: {
          userId,
          tenantId,
          channel: 'email',
          category: 'promotions',
          enabled: false,
        },
      });

      // Create decision with category
      const decision = await db.engagementDecision.findUnique({
        where: { id: engagementDecisionId },
      });

      await db.engagementDecision.update({
        where: { id: engagementDecisionId },
        data: {
          reasoning: JSON.stringify({ category: 'promotions' }),
        },
      });

      const mockJob = {
        data: {
          engagementDecisionId,
          tenantId,
          userId,
          channel: 'email',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('suppressed');
      expect(delivery?.metadata).toEqual({ reason: 'category_preference_disabled' });
    });
  });

  describe('Global Unsubscribe', () => {
    it('should suppress delivery if user globally unsubscribed', async () => {
      // Create global unsubscribe
      await db.globalUnsubscribe.create({
        data: {
          userId,
          tenantId,
          channel: 'email',
          reason: 'manual',
        },
      });

      const mockJob = {
        data: {
          engagementDecisionId,
          tenantId,
          userId,
          channel: 'email',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('suppressed');
      expect(delivery?.metadata).toEqual({ reason: 'global_unsubscribe' });
    });
  });

  describe('Frequency Cap', () => {
    it('should suppress delivery if frequency cap exceeded', async () => {
      // Set frequency cap to 1 per hour
      await db.tenant.update({
        where: { id: tenantId },
        data: {
          settings: JSON.stringify({ maxFrequencyPerHour: 1 }),
        },
      });

      // Simulate one message already sent
      const capKey = REDIS_KEYS.frequencyCap(tenantId, userId, 'email');
      await redis.setex(capKey, 3600, '1');

      const mockJob = {
        data: {
          engagementDecisionId,
          tenantId,
          userId,
          channel: 'email',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('suppressed');
      expect(delivery?.metadata).toEqual({ reason: 'frequency_cap' });
    });

    it('should allow delivery and increment cap if under limit', async () => {
      const mockJob = {
        data: {
          engagementDecisionId,
          tenantId,
          userId,
          channel: 'email',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('queued');

      // Verify cap was incremented
      const capKey = REDIS_KEYS.frequencyCap(tenantId, userId, 'email');
      const count = await redis.get(capKey);
      expect(count).toBe('1');
    });
  });

  describe('Missing Recipient Data', () => {
    it('should suppress if email is missing', async () => {
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
          channel: 'email',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('suppressed');
      expect(delivery?.metadata).toEqual({ reason: 'no_email' });
    });

    it('should suppress if phone is missing for SMS', async () => {
      // Update user to remove phone
      await db.user.update({
        where: { id: userId },
        data: { phone: null },
      });

      // Create new decision for SMS
      const event = await db.event.findFirst({ where: { tenantId } });
      const smsDecision = await db.engagementDecision.create({
        data: {
          tenantId,
          eventId: event!.id,
          userId,
          channel: 'sms',
          decisionType: 'send',
          reasoning: JSON.stringify({}),
          confidence: 0.95,
        },
      });

      const mockJob = {
        data: {
          engagementDecisionId: smsDecision.id,
          tenantId,
          userId,
          channel: 'sms',
        },
      } as unknown as Job;

      await scheduler(mockJob);

      const delivery = await db.delivery.findFirst({
        where: { tenantId, engagementDecisionId: smsDecision.id },
      });

      expect(delivery).toBeDefined();
      expect(delivery?.status).toBe('suppressed');
      expect(delivery?.metadata).toEqual({ reason: 'no_phone' });
    });
  });
});
