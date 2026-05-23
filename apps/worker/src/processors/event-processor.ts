import type { Job } from "bullmq";
import type { PrismaClient } from "@engage/database";
import type { Redis } from "ioredis";
import type { RulesEngine } from "@engage/rules-engine";
import type { AIOrchestrationLayer } from "@engage/ai";
import {
  isQuietHours,
  QUEUES,
  type EventContext,
  type ConditionGroup,
  type RuleAction,
  type AIProviderName,
  REDIS_KEYS,
} from "@engage/core";
import { getQueue } from "@engage/event-bus";

export interface EventJobPayload {
  eventId: string;
  tenantId: string;
  userId: string;
  type: string;
}
export interface DeliveryJobPayload {
  engagementDecisionId: string;
  tenantId: string;
  userId: string;
  channel: string;
}

async function checkAndSetCooldown(
  redis: Redis,
  ruleId: string,
  userId: string,
  cooldownSeconds: number | null,
): Promise<boolean> {
  if (!cooldownSeconds || cooldownSeconds <= 0) return false;
  const key = `cooldown:${ruleId}:${userId}`;
  const existing = await redis.get(key);
  if (existing) return true;
  await redis.setex(key, cooldownSeconds, "1");
  return false;
}

export function createEventProcessor(
  db: PrismaClient,
  redis: Redis,
  rulesEngine: RulesEngine,
  aiLayer: AIOrchestrationLayer,
) {
  return async (job: Job<EventJobPayload>) => {
    const { eventId, tenantId, userId } = job.data;

    try {
      await db.eventProcessingLog.create({
        data: { eventId, step: "started", status: "ok", details: {} },
      });

      const [
        event,
        user,
        tenant,
        engagementScore,
        rules,
        preferences,
        unsubscribes,
      ] = await Promise.all([
        db.event.findUniqueOrThrow({ where: { id: eventId } }),
        db.user.findUniqueOrThrow({ where: { id: userId } }),
        db.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
        db.userEngagementScore.findUnique({ where: { userId } }),
        db.rule.findMany({
          where: { tenantId, enabled: true },
          orderBy: { priority: "desc" },
        }),
        db.userPreference.findMany({ where: { userId, tenantId } }),
        db.globalUnsubscribe.findMany({ where: { userId, tenantId } }),
      ]);

      const recentSession = await db.userSession.findFirst({
        where: {
          userId,
          lastSeenAt: { gte: new Date(Date.now() - 5 * 60 * 1000) },
        },
      });

      const context: EventContext = {
        event: {
          id: event.id,
          tenantId: event.tenantId,
          type: event.type,
          userId: event.userId,
          payload: event.payload as Record<string, unknown>,
          metadata: event.metadata as Record<string, unknown>,
          receivedAt: event.receivedAt,
          ...(event.processedAt ? { processedAt: event.processedAt } : {}),
          ...(event.replayedFrom ? { replayedFrom: event.replayedFrom } : {}),
        },
        user: {
          id: user.id,
          externalId: user.externalId,
          timezone: user.timezone,
          locale: user.locale,
          tags: user.tags,
          fatigueScore: engagementScore?.fatigueScore ?? 0,
          engagementScore: engagementScore?.score ?? 0,
          metadata: user.metadata as Record<string, unknown>,
          isActiveSession: recentSession !== null,
          ...(user.email ? { email: user.email } : {}),
          ...(user.phone ? { phone: user.phone } : {}),
          ...(recentSession ? { lastSeenAt: recentSession.lastSeenAt } : {}),
        },
        tenant: {
          id: tenant.id,
          slug: tenant.slug,
          settings: tenant.settings as Record<string, unknown>,
        },
      };

      const ruleResults = rulesEngine.evaluate(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rules.map((r: any) => ({
          id: r.id,
          name: r.name,
          enabled: r.enabled,
          priority: r.priority,
          conditions: r.conditions as unknown as ConditionGroup,
          actions: r.actions as unknown as RuleAction[],
          cooldownSeconds: r.cooldownSeconds,
        })),
        context,
      );

      // ─── Cooldown filtering ────────────────────────────────────────────────
      const matchedRules = ruleResults.filter((r) => r.matched);
      const activeRules: typeof matchedRules = [];

      for (const result of matchedRules) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rule = rules.find((r: any) => r.id === result.ruleId);
        if (!rule) continue;
        const onCooldown = await checkAndSetCooldown(
          redis,
          result.ruleId,
          userId,
          rule.cooldownSeconds,
        );
        if (!onCooldown) activeRules.push(result);
      }

      // Persist all rule executions (matched + unmatched)
      await Promise.all(
        ruleResults.map((result) =>
          db.ruleExecution.create({
            data: {
              ruleId: result.ruleId,
              eventId,
              userId,
              tenantId,
              matched: result.matched,
              reasoning: { text: result.reasoning },
            },
          }),
        ),
      );

      const actions = rulesEngine.collectActions(activeRules);

      const sendActions = actions.filter((a) => a.type === "SEND_NOTIFICATION");
      const voiceActions = actions.filter(
        (a) => a.type === "START_VOICE_CAMPAIGN",
      );
      const whatsappActions = actions.filter(
        (a) => a.type === "START_WHATSAPP_CAMPAIGN",
      );
      const pushActions = actions.filter(
        (a) => a.type === "START_PUSH_CAMPAIGN",
      );
      const campaignActions = actions.filter(
        (a) => a.type === "ADD_TO_CAMPAIGN",
      );
      const scoreActions = actions.filter((a) => a.type === "UPDATE_SCORE");
      const isSuppressed = actions.some((a) => a.type === "SUPPRESS");

      // ─── UPDATE_SCORE actions ──────────────────────────────────────────────
      for (const action of scoreActions) {
        const params = action.params as Record<string, unknown>;
        const field = params["field"] as string | undefined;
        const increment = Number(params["increment"] ?? 0);

        if (!field || isNaN(increment)) continue;

        const existing = await db.userEngagementScore.findUnique({
          where: { userId },
        });
        if (field === "score") {
          await db.userEngagementScore.upsert({
            where: { userId },
            update: {
              score: Math.min(
                100,
                Math.max(0, (existing?.score ?? 50) + increment),
              ),
            },
            create: {
              userId,
              tenantId,
              score: Math.max(0, 50 + increment),
              fatigueScore: 0,
            },
          });
        } else if (field === "fatigueScore") {
          await db.userEngagementScore.upsert({
            where: { userId },
            update: {
              fatigueScore: Math.min(
                1,
                Math.max(0, (existing?.fatigueScore ?? 0) + increment),
              ),
            },
            create: {
              userId,
              tenantId,
              score: 50,
              fatigueScore: Math.max(0, increment),
            },
          });
        }
      }

      // ─── ADD_TO_CAMPAIGN actions ───────────────────────────────────────────
      for (const action of campaignActions) {
        const params = action.params as Record<string, unknown>;
        const campaignId = params["campaignId"] as string | undefined;
        if (!campaignId) continue;

        const campaign = await db.campaign.findFirst({
          where: { id: campaignId, tenantId, status: "active" },
          include: { template: true },
        });

        if (!campaign || !campaign.template) continue;

        const channel = campaign.channels[0];
        if (!channel) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (unsubscribes.some((u: any) => u.channel === channel)) continue;

        const scheduledFor = new Date();
        const decision = await db.engagementDecision.create({
          data: {
            tenantId,
            eventId,
            userId,
            channel,
            decisionType: "send",
            reasoning: { source: "campaign", campaignId },
            aiGenerated: false,
            confidence: 1.0,
            priority: 1,
            scheduledFor,
          },
        });

        const deliveryQueue = getQueue(QUEUES.DELIVERIES_SCHEDULED);
        await deliveryQueue.add("schedule", {
          engagementDecisionId: decision.id,
          tenantId,
          userId,
          channel,
        } satisfies DeliveryJobPayload);
      }

      if (
        isSuppressed ||
        (sendActions.length === 0 &&
          voiceActions.length === 0 &&
          whatsappActions.length === 0 &&
          pushActions.length === 0)
      ) {
        await db.event.update({
          where: { id: eventId },
          data: { processedAt: new Date() },
        });
        await db.eventProcessingLog.create({
          data: {
            eventId,
            step: "completed",
            status: "ok",
            details: { suppressed: isSuppressed, actionCount: 0 },
          },
        });
        return;
      }

      // ─── Feature flags ─────────────────────────────────────────────────────
      const [aiFlag, voiceFlag, whatsappFlag, pushFlag] = await Promise.all([
        redis
          .get(REDIS_KEYS.featureFlag("ai_engagement_decisions", tenantId))
          .then(
            (v) =>
              v ?? redis.get(REDIS_KEYS.featureFlag("ai_engagement_decisions")),
          ),
        redis
          .get(REDIS_KEYS.featureFlag("voice_campaigns", tenantId))
          .then(
            (v) => v ?? redis.get(REDIS_KEYS.featureFlag("voice_campaigns")),
          ),
        redis
          .get(REDIS_KEYS.featureFlag("whatsapp_campaigns", tenantId))
          .then(
            (v) => v ?? redis.get(REDIS_KEYS.featureFlag("whatsapp_campaigns")),
          ),
        redis
          .get(REDIS_KEYS.featureFlag("push_campaigns", tenantId))
          .then(
            (v) => v ?? redis.get(REDIS_KEYS.featureFlag("push_campaigns")),
          ),
      ]);

      // ─── AI consultation ───────────────────────────────────────────────────
      let aiDecision = null;
      if (aiFlag === "1") {
        try {
          const tenantSettings = tenant.settings as Record<string, unknown>;
          const aiConfig = tenantSettings["aiConfig"] as
            | { provider?: AIProviderName }
            | undefined;
          aiDecision = await aiLayer.consultForDecision(
            context,
            aiConfig?.provider,
          );
        } catch (aiErr) {
          console.error(
            "[event-processor] AI consultation failed, proceeding without:",
            aiErr,
          );
        }
      }

      const deliveryQueue = getQueue(QUEUES.DELIVERIES_SCHEDULED);
      const voiceQueue = getQueue(QUEUES.VOICE_CALLS);

      // ─── SEND_NOTIFICATION actions ─────────────────────────────────────────
      for (const action of sendActions) {
        const params = action.params as Record<string, unknown>;
        const channel = params["channel"] as string;
        const templateId = params["templateId"] as string | undefined;
        const priority = params["priority"] === "high" ? 2 : 1;

        if (!channel) continue;

        const pref = preferences.find(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (p: any) => p.channel === channel && p.category === "all",
        );
        if (pref?.enabled === false) continue;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (unsubscribes.some((u: any) => u.channel === channel)) continue;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const channelPref = preferences.find((p: any) => p.channel === channel);
        if (
          channelPref?.quietHoursStart != null &&
          channelPref?.quietHoursEnd != null &&
          isQuietHours(
            user.timezone,
            channelPref.quietHoursStart,
            channelPref.quietHoursEnd,
          )
        )
          continue;

        // Validate recipient exists for the channel
        if (channel === "email" && !user.email) continue;
        if (
          (channel === "sms" ||
            channel === "voice" ||
            channel === "whatsapp") &&
          !user.phone
        )
          continue;
        if (channel === "push") {
          const tokens = user.deviceTokens as string[] | null;
          if (!tokens || tokens.length === 0) continue;
        }

        const scheduledFor = aiDecision?.schedulingOffsetMinutes
          ? new Date(
              Date.now() + aiDecision.schedulingOffsetMinutes * 60 * 1000,
            )
          : new Date();

        const decision = await db.engagementDecision.create({
          data: {
            tenantId,
            eventId,
            userId,
            channel,
            decisionType: "send",
            reasoning: {
              ruleMatches: activeRules.map((r) => r.reasoning),
              aiSuggestion: aiDecision?.reasoning,
              channelSelectionReason: `Rule: ${channel}`,
              timingReason: aiDecision?.schedulingOffsetMinutes
                ? "ai_optimized"
                : "immediate",
              ...(templateId ? { templateId } : {}),
            },
            aiGenerated: aiDecision !== null,
            confidence: aiDecision?.channelConfidence ?? 1.0,
            priority,
            scheduledFor,
          },
        });

        await deliveryQueue.add(
          "schedule",
          {
            engagementDecisionId: decision.id,
            tenantId,
            userId,
            channel,
          } satisfies DeliveryJobPayload,
          { delay: Math.max(0, scheduledFor.getTime() - Date.now()) },
        );
      }

      // ─── START_VOICE_CAMPAIGN actions ──────────────────────────────────────
      if (voiceFlag === "1") {
        for (const action of voiceActions) {
          const params = action.params as Record<string, unknown>;
          const campaignId = params["campaignId"] as string | undefined;
          if (!campaignId || !user.phone) continue;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (unsubscribes.some((u: any) => u.channel === "voice")) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const voicePref = preferences.find((p: any) => p.channel === "voice");
          if (
            voicePref?.quietHoursStart != null &&
            voicePref?.quietHoursEnd != null &&
            isQuietHours(
              user.timezone,
              voicePref.quietHoursStart,
              voicePref.quietHoursEnd,
            )
          )
            continue;

          const campaign = await db.voiceCampaign.findFirst({
            where: { id: campaignId, tenantId, status: "active" },
          });
          if (!campaign) continue;

          const voiceCall = await db.voiceCall.create({
            data: {
              voiceCampaignId: campaignId,
              tenantId,
              userId,
              phone: user.phone,
              status: "queued",
            },
          });

          const voiceConfig = (campaign.voiceConfig || {}) as Record<
            string,
            unknown
          >;
          await voiceQueue.add("initiate", {
            voiceCallId: voiceCall.id,
            voiceCampaignId: campaignId,
            userId,
            phone: user.phone,
            script: campaign.script,
            languageCode: (voiceConfig["language"] as string) || "es-ES",
            voiceGender:
              (voiceConfig["voice"] as "male" | "female") || "female",
            dtmfConfig: campaign.dtmfConfig,
            attempt: 0,
          });
        }
      }

      // ─── START_WHATSAPP_CAMPAIGN actions ───────────────────────────────────
      if (whatsappFlag === "1") {
        const whatsappQueue = getQueue(QUEUES.WHATSAPP_MESSAGES);
        for (const action of whatsappActions) {
          const params = action.params as Record<string, unknown>;
          const campaignId = params["campaignId"] as string | undefined;
          if (!campaignId || !user.phone) continue;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (unsubscribes.some((u: any) => u.channel === "whatsapp")) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const waPref = preferences.find((p: any) => p.channel === "whatsapp");
          if (
            waPref?.quietHoursStart != null &&
            waPref?.quietHoursEnd != null &&
            isQuietHours(
              user.timezone,
              waPref.quietHoursStart,
              waPref.quietHoursEnd,
            )
          )
            continue;

          const campaign = await db.whatsAppCampaign.findFirst({
            where: { id: campaignId, tenantId, status: "active" },
          });
          if (!campaign) continue;

          await whatsappQueue.add(
            `whatsapp-${campaignId}-${userId}`,
            {
              whatsappCampaignId: campaignId,
              userId,
              phone: user.phone,
              body: campaign.body,
              headerType: campaign.headerType,
              headerValue: campaign.headerValue,
              footerText: campaign.footerText,
              buttons: campaign.buttons,
              attempt: 0,
            },
            {
              attempts: campaign.maxRetries + 1,
              backoff: { type: "exponential", delay: 2000 },
            },
          );
        }
      }

      // ─── START_PUSH_CAMPAIGN actions ───────────────────────────────────────
      if (pushFlag === "1") {
        const pushQueue = getQueue(QUEUES.PUSH_NOTIFICATIONS);
        for (const action of pushActions) {
          const params = action.params as Record<string, unknown>;
          const campaignId = params["campaignId"] as string | undefined;
          if (!campaignId) continue;

          const tokens = user.deviceTokens as string[] | null;
          if (!tokens || tokens.length === 0) continue;

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if (unsubscribes.some((u: any) => u.channel === "push")) continue;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const pushPref = preferences.find((p: any) => p.channel === "push");
          if (
            pushPref?.quietHoursStart != null &&
            pushPref?.quietHoursEnd != null &&
            isQuietHours(
              user.timezone,
              pushPref.quietHoursStart,
              pushPref.quietHoursEnd,
            )
          )
            continue;

          const campaign = await db.pushCampaign.findFirst({
            where: { id: campaignId, tenantId, status: "active" },
          });
          if (!campaign) continue;

          await pushQueue.add(
            `push-${campaignId}-${userId}`,
            {
              pushCampaignId: campaignId,
              userId,
              title: campaign.title,
              body: campaign.body,
              imageUrl: campaign.imageUrl,
              actionUrl: campaign.actionUrl,
              priority: campaign.priority,
              attempt: 0,
            },
            {
              attempts: campaign.maxRetries + 1,
              backoff: { type: "exponential", delay: 2000 },
            },
          );
        }
      }

      await db.event.update({
        where: { id: eventId },
        data: { processedAt: new Date() },
      });
      await db.eventProcessingLog.create({
        data: {
          eventId,
          step: "completed",
          status: "ok",
          details: {
            sendActionsCount: sendActions.length,
            voiceActionsCount: voiceActions.length,
            whatsappActionsCount: whatsappActions.length,
            pushActionsCount: pushActions.length,
            campaignActionsCount: campaignActions.length,
            scoreActionsCount: scoreActions.length,
            cooldownSkipped: matchedRules.length - activeRules.length,
          },
        },
      });

      // Publish event to WebSocket stream for real-time dashboard updates
      await redis.publish(
        REDIS_KEYS.eventStream(tenantId),
        JSON.stringify({
          id: event.id,
          type: event.type,
          userId: event.userId,
          receivedAt: event.receivedAt.toISOString(),
        }),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[event-processor] eventId=${eventId} failed:`, message);
      await db.eventProcessingLog
        .create({
          data: {
            eventId,
            step: "error",
            status: "error",
            details: { error: message },
          },
        })
        .catch(() => {});
      throw err;
    }
  };
}
