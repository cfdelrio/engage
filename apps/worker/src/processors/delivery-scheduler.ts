import type { Job } from 'bullmq';
import type { PrismaClient } from '@engage/database';
import type { Redis } from 'ioredis';
import { QUEUES, isQuietHours, REDIS_KEYS } from '@engage/core';
import { getQueue } from '@engage/event-bus';
import type { DeliveryJobPayload } from './event-processor.js';
import { EngagementScorer } from '@engage/analytics';
import Handlebars from 'handlebars';

const scorer = new EngagementScorer();

export function createDeliveryScheduler(db: PrismaClient, redis: Redis) {
  return async (job: Job<DeliveryJobPayload>) => {
    const { engagementDecisionId, tenantId, userId, channel } = job.data;

    const [decision, user, preferences, unsubscribes] = await Promise.all([
      db.engagementDecision.findUniqueOrThrow({ where: { id: engagementDecisionId } }),
      db.user.findUniqueOrThrow({ where: { id: userId } }),
      db.userPreference.findMany({ where: { userId, tenantId, channel } }),
      db.globalUnsubscribe.findMany({ where: { userId, tenantId, channel } }),
    ]);

    // ─── Suppression checks ───────────────────────────────────────────────────
    if (unsubscribes.length > 0) {
      await db.delivery.create({
        data: {
          tenantId,
          engagementDecisionId,
          userId,
          channel,
          provider: 'none',
          status: 'suppressed',
          payload: {},
          metadata: { reason: 'global_unsubscribe' },
        },
      });
      return;
    }

    const pref = preferences.find((p) => p.category === 'all');
    if (pref?.enabled === false) {
      await db.delivery.create({
        data: {
          tenantId, engagementDecisionId, userId, channel,
          provider: 'none', status: 'suppressed', payload: {},
          metadata: { reason: 'user_preference_disabled' },
        },
      });
      return;
    }

    // Check quiet hours
    if (
      pref?.quietHoursStart !== null && pref?.quietHoursStart !== undefined &&
      pref?.quietHoursEnd !== null && pref?.quietHoursEnd !== undefined
    ) {
      if (isQuietHours(user.timezone, pref.quietHoursStart, pref.quietHoursEnd)) {
        // Re-schedule for end of quiet hours instead of suppressing
        await db.delivery.create({
          data: {
            tenantId, engagementDecisionId, userId, channel,
            provider: 'none', status: 'suppressed', payload: {},
            metadata: { reason: 'quiet_hours' },
          },
        });
        return;
      }
    }

    // ─── Frequency cap check ──────────────────────────────────────────────────
    const capKey = REDIS_KEYS.frequencyCap(tenantId, userId, channel);
    const currentCount = parseInt(await redis.get(capKey) ?? '0', 10);
    const tenant = await db.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    const settings = tenant.settings as Record<string, unknown>;
    const maxPerHour = (settings['maxFrequencyPerHour'] as number | undefined) ?? 2;

    if (currentCount >= maxPerHour) {
      await db.delivery.create({
        data: {
          tenantId, engagementDecisionId, userId, channel,
          provider: 'none', status: 'suppressed', payload: {},
          metadata: { reason: 'frequency_cap', currentCount, maxPerHour },
        },
      });
      return;
    }

    // Increment cap counter
    const ttl = await redis.ttl(capKey);
    if (ttl < 0) {
      await redis.setex(capKey, 3600, '1');
    } else {
      await redis.incr(capKey);
    }

    // ─── Resolve provider ─────────────────────────────────────────────────────
    const providerRecord = await db.channelProvider.findFirst({
      where: { tenantId, channel, isActive: true, isDefault: true },
    });

    if (!providerRecord) {
      await db.delivery.create({
        data: {
          tenantId, engagementDecisionId, userId, channel,
          provider: 'none', status: 'failed', payload: {},
          metadata: { reason: 'no_provider_configured' },
        },
      });
      return;
    }

    // ─── Build delivery payload ───────────────────────────────────────────────
    const template = await db.template.findFirst({
      where: { tenantId, channel },
    });

    const event = await db.event.findUniqueOrThrow({
      where: { id: decision.eventId },
    });

    let renderedSubject = template?.subject ?? '';
    let renderedBody = template?.body ?? event.type;

    if (template) {
      try {
        const payload = event.payload as Record<string, unknown>;
        renderedSubject = Handlebars.compile(template.subject ?? '')(payload);
        renderedBody = Handlebars.compile(template.body)(payload);
      } catch {
        // Template rendering failed — use raw body
      }
    }

    // ─── Route to channel-specific queue ─────────────────────────────────────
    const queueMap: Record<string, string> = {
      email: QUEUES.DELIVERIES_EMAIL,
      sms: QUEUES.DELIVERIES_SMS,
      push: QUEUES.DELIVERIES_PUSH,
      whatsapp: QUEUES.DELIVERIES_WHATSAPP,
      voice: QUEUES.DELIVERIES_VOICE,
    };

    const channelQueue = queueMap[channel];
    if (!channelQueue) {
      return;
    }

    const delivery = await db.delivery.create({
      data: {
        tenantId,
        engagementDecisionId,
        userId,
        channel,
        provider: providerRecord.provider,
        status: 'queued',
        payload: {
          subject: renderedSubject,
          body: renderedBody,
          to: channel === 'email' ? user.email : channel === 'push' ? (user.deviceTokens as string[])[0] : user.phone,
        },
        metadata: { templateId: template?.id },
      },
    });

    await getQueue(channelQueue as import('@engage/core').QueueName).add('deliver', {
      deliveryId: delivery.id,
      tenantId,
      userId,
      channel,
      providerName: providerRecord.provider,
      payload: {
        deliveryId: delivery.id,
        tenantId,
        userId,
        channel,
        provider: providerRecord.provider,
        to: (delivery.payload as Record<string, string>)['to'] ?? '',
        subject: renderedSubject,
        body: renderedBody,
        metadata: {},
      },
    });
  };
}
