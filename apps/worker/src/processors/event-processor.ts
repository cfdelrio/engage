import type { Job } from 'bullmq';
import type { PrismaClient } from '@engage/database';
import type { Redis } from 'ioredis';
import { RulesEngine } from '@engage/rules-engine';
import { AIOrchestrationLayer } from '@engage/ai';
import {
  isQuietHours, QUEUES, type EventContext, type ConditionGroup, type RuleAction, type AIProviderName, REDIS_KEYS,
} from '@engage/core';
import { getQueue } from '@engage/event-bus';

export interface EventJobPayload { eventId: string; tenantId: string; userId: string; type: string; }
export interface DeliveryJobPayload { engagementDecisionId: string; tenantId: string; userId: string; channel: string; }

export function createEventProcessor(db: PrismaClient, redis: Redis, rulesEngine: RulesEngine, aiLayer: AIOrchestrationLayer) {
  return async (job: Job<EventJobPayload>) => {
    const { eventId, tenantId, userId } = job.data;
    await db.eventProcessingLog.create({ data: { eventId, step: 'started', status: 'ok', details: {} } });

    const [event, user, tenant, engagementScore, rules, preferences, unsubscribes] = await Promise.all([
      db.event.findUniqueOrThrow({ where: { id: eventId } }),
      db.user.findUniqueOrThrow({ where: { id: userId } }),
      db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
      db.userEngagementScore.findUnique({ where: { userId } }),
      db.rule.findMany({ where: { tenantId, enabled: true }, orderBy: { priority: 'desc' } }),
      db.userPreference.findMany({ where: { userId, tenantId } }),
      db.globalUnsubscribe.findMany({ where: { userId, tenantId } }),
    ]);

    const recentSession = await db.userSession.findFirst({ where: { userId, lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) } } });

    const context: EventContext = {
      event: {
        id: event.id, tenantId: event.tenantId, type: event.type, userId: event.userId,
        payload: event.payload as Record<string, unknown>, metadata: event.metadata as Record<string, unknown>,
        receivedAt: event.receivedAt,
        ...(event.processedAt ? { processedAt: event.processedAt } : {}),
        ...(event.replayedFrom ? { replayedFrom: event.replayedFrom } : {}),
      },
      user: {
        id: user.id, externalId: user.externalId, timezone: user.timezone, locale: user.locale, tags: user.tags,
        fatigueScore: engagementScore?.fatigueScore ?? 0, engagementScore: engagementScore?.score ?? 0,
        metadata: user.metadata as Record<string, unknown>, isActiveSession: recentSession !== null,
        ...(user.email ? { email: user.email } : {}),
        ...(user.phone ? { phone: user.phone } : {}),
        ...(recentSession ? { lastSeenAt: recentSession.lastSeenAt } : {}),
      },
      tenant: { id: tenant.id, slug: tenant.slug, settings: tenant.settings as Record<string, unknown> },
    };

    const ruleResults = rulesEngine.evaluate(
      rules.map((r) => ({ id: r.id, name: r.name, enabled: r.enabled, priority: r.priority, conditions: r.conditions as unknown as ConditionGroup, actions: r.actions as unknown as RuleAction[], cooldownSeconds: r.cooldownSeconds })),
      context,
    );

    await Promise.all(ruleResults.map((result) => db.ruleExecution.create({ data: { ruleId: result.ruleId, eventId, userId, tenantId, matched: result.matched, reasoning: { text: result.reasoning } } })));

    const actions = rulesEngine.collectActions(ruleResults);
    const sendActions = actions.filter((a) => a.type === 'SEND_NOTIFICATION');
    const isSuppressed = actions.some((a) => a.type === 'SUPPRESS');

    if (isSuppressed || sendActions.length === 0) {
      await db.event.update({ where: { id: eventId }, data: { processedAt: new Date() } });
      return;
    }

    const aiEnabledTenant = await redis.get(REDIS_KEYS.featureFlag('ai_engagement_decisions', tenantId));
    const aiEnabledGlobal = await redis.get(REDIS_KEYS.featureFlag('ai_engagement_decisions'));
    const aiEnabled = aiEnabledTenant ?? aiEnabledGlobal;

    let aiDecision = null;
    if (aiEnabled === '1') {
      const tenantSettings = tenant.settings as Record<string, unknown>;
      const aiConfig = tenantSettings['aiConfig'] as { provider?: AIProviderName } | undefined;
      aiDecision = await aiLayer.consultForDecision(context, aiConfig?.provider);
    }

    const deliveryQueue = getQueue(QUEUES.DELIVERIES_SCHEDULED);

    for (const action of sendActions) {
      const params = action.params as Record<string, unknown>;
      const channel = params['channel'] as string;
      const priority = params['priority'] === 'high' ? 2 : 1;

      const pref = preferences.find((p) => p.channel === channel && p.category === 'all');
      if (pref?.enabled === false) continue;
      if (unsubscribes.some((u) => u.channel === channel)) continue;

      const channelPref = preferences.find((p) => p.channel === channel);
      if (channelPref?.quietHoursStart !== null && channelPref?.quietHoursStart !== undefined && channelPref?.quietHoursEnd !== null && channelPref?.quietHoursEnd !== undefined) {
        if (isQuietHours(user.timezone, channelPref.quietHoursStart, channelPref.quietHoursEnd)) continue;
      }

      const scheduledFor = aiDecision?.schedulingOffsetMinutes ? new Date(Date.now() + aiDecision.schedulingOffsetMinutes * 60 * 1000) : new Date();

      const decision = await db.engagementDecision.create({
        data: {
          tenantId, eventId, userId, channel, decisionType: 'send',
          reasoning: { ruleMatches: ruleResults.filter((r) => r.matched).map((r) => r.reasoning), aiSuggestion: aiDecision?.reasoning, channelSelectionReason: `Rule: ${channel}`, timingReason: 'immediate' },
          aiGenerated: aiDecision !== null, confidence: aiDecision?.channelConfidence ?? 1.0, priority, scheduledFor,
        },
      });

      await deliveryQueue.add('schedule', { engagementDecisionId: decision.id, tenantId, userId, channel } satisfies DeliveryJobPayload, { delay: Math.max(0, scheduledFor.getTime() - Date.now()) });
    }

    await db.event.update({ where: { id: eventId }, data: { processedAt: new Date() } });
    await db.eventProcessingLog.create({ data: { eventId, step: 'completed', status: 'ok', details: { actionsCount: sendActions.length } } });
  };
}
