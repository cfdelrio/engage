import type { Job } from "bullmq";
import type { PrismaClient } from "@engage/database";
import type { Redis } from "ioredis";
import { QUEUES, isQuietHours, REDIS_KEYS } from "@engage/core";
import type { QueueName } from "@engage/core";
import { getQueue } from "@engage/event-bus";
import type { DeliveryJobPayload } from "./event-processor.js";
import Handlebars from "handlebars";

export function createDeliveryScheduler(db: PrismaClient, redis: Redis) {
  return async (job: Job<DeliveryJobPayload>) => {
    const { engagementDecisionId, tenantId, userId, channel } = job.data;

    try {
      const [decision, user, preferences, unsubscribes] = await Promise.all([
        db.engagementDecision.findUniqueOrThrow({
          where: { id: engagementDecisionId },
        }),
        db.user.findUniqueOrThrow({ where: { id: userId } }),
        db.userPreference.findMany({ where: { userId, tenantId, channel } }),
        db.globalUnsubscribe.findMany({ where: { userId, tenantId, channel } }),
      ]);

      const suppress = async (reason: string) => {
        await db.delivery.create({
          data: {
            tenantId,
            engagementDecisionId,
            userId,
            channel,
            provider: "none",
            status: "suppressed",
            payload: {},
            metadata: { reason },
          },
        });
      };

      // ─── Suppression checks ───────────────────────────────────────────────
      if (unsubscribes.length > 0) {
        await suppress("global_unsubscribe");
        return;
      }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pref = preferences.find((p: any) => p.category === "all");
      if (pref?.enabled === false) {
        await suppress("user_preference_disabled");
        return;
      }

      if (pref?.quietHoursStart != null && pref?.quietHoursEnd != null) {
        if (
          isQuietHours(user.timezone, pref.quietHoursStart, pref.quietHoursEnd)
        ) {
          await suppress("quiet_hours");
          return;
        }
      }

      // ─── Category-specific preferences ────────────────────────────────────
      const decisionCategory =
        ((decision.reasoning as Record<string, unknown> | null)?.[
          "category"
        ] as string | undefined) ?? "all";
      const categoryPref = preferences.find(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (p: any) => p.category === decisionCategory,
      );
      if (categoryPref?.enabled === false) {
        await suppress("category_preference_disabled");
        return;
      }

      // ─── Frequency cap ────────────────────────────────────────────────────
      const capKey = REDIS_KEYS.frequencyCap(tenantId, userId, channel);
      const currentCount = parseInt((await redis.get(capKey)) ?? "0", 10);
      const tenant = await db.tenant.findUniqueOrThrow({
        where: { id: tenantId },
      });
      const settings = tenant.settings as Record<string, unknown>;
      const maxPerHour =
        (settings["maxFrequencyPerHour"] as number | undefined) ?? 2;

      if (currentCount >= maxPerHour) {
        await suppress("frequency_cap");
        return;
      }

      const ttl = await redis.ttl(capKey);
      if (ttl < 0) {
        await redis.setex(capKey, 3600, "1");
      } else {
        await redis.incr(capKey);
      }

      // ─── WhatsApp consent check ───────────────────────────────────────────
      if (channel === "whatsapp") {
        const consent = (user.metadata as Record<string, unknown> | null)
          ?.whatsapp_consent;
        if (!consent) {
          await suppress("whatsapp_consent_missing");
          return;
        }
      }

      // ─── Validate recipient ───────────────────────────────────────────────
      if (channel === "email" && !user.email) {
        await suppress("no_email");
        return;
      }
      if (
        (channel === "sms" || channel === "whatsapp" || channel === "voice") &&
        !user.phone
      ) {
        await suppress("no_phone");
        return;
      }
      if (channel === "push") {
        const tokens = user.deviceTokens as string[] | null;
        if (!tokens || tokens.length === 0) {
          await suppress("no_device_token");
          return;
        }
      }

      // ─── Resolve provider ─────────────────────────────────────────────────
      const providerRecord = await db.channelProvider.findFirst({
        where: { tenantId, channel, isActive: true, isDefault: true },
      });

      if (!providerRecord) {
        await suppress("no_provider_configured");
        return;
      }

      // ─── Build payload ────────────────────────────────────────────────────
      const event = await db.event.findUniqueOrThrow({
        where: { id: decision.eventId },
      });
      const eventPayload = event.payload as Record<string, unknown>;
      const userPayload = {
        ...eventPayload,
        user: {
          id: user.id,
          email: user.email,
          phone: user.phone,
          ...(user.metadata as object),
        },
      };

      // Resolve template — prefer templateId stored in reasoning, then by channel
      const reasoning = decision.reasoning as Record<string, unknown> | null;
      const templateId = reasoning?.["templateId"] as string | undefined;

      const template = await (templateId
        ? db.template.findFirst({ where: { id: templateId, tenantId } })
        : db.template.findFirst({ where: { tenantId, channel } }));

      let renderedSubject = "";
      let renderedBody = event.type;

      if (template) {
        try {
          renderedSubject = template.subject
            ? Handlebars.compile(template.subject)(userPayload)
            : "";
          renderedBody = Handlebars.compile(template.body)(userPayload);
        } catch {
          renderedBody = template.body;
        }
      }

      // ─── Determine recipient ──────────────────────────────────────────────
      let to: string;
      if (channel === "email") {
        to = user.email as string;
      } else if (channel === "push") {
        const tokens = user.deviceTokens as string[];
        to = tokens[0] as string;
      } else {
        to = user.phone as string;
      }

      // ─── Create delivery record ───────────────────────────────────────────
      const delivery = await db.delivery.create({
        data: {
          tenantId,
          engagementDecisionId,
          userId,
          channel,
          provider: providerRecord.provider,
          status: "queued",
          payload: { subject: renderedSubject, body: renderedBody, to },
          metadata: { templateId: template?.id ?? null },
        },
      });

      // ─── Route to channel queue ───────────────────────────────────────────
      const queueMap: Record<string, string> = {
        email: QUEUES.DELIVERIES_EMAIL,
        sms: QUEUES.DELIVERIES_SMS,
        push: QUEUES.DELIVERIES_PUSH,
        whatsapp: QUEUES.DELIVERIES_WHATSAPP,
        voice: QUEUES.DELIVERIES_VOICE,
      };

      const channelQueue = queueMap[channel];
      if (!channelQueue) return;

      // Extract Twilio Content Template SID from aiInstructions if present
      let twilioTemplateMeta: Record<string, unknown> = {};
      if (channel === "whatsapp" && template?.aiInstructions) {
        try {
          const extra = JSON.parse(template.aiInstructions) as Record<
            string,
            unknown
          >;
          if (extra.twilioTemplateSid) {
            twilioTemplateMeta = {
              twilioTemplateSid: extra.twilioTemplateSid,
              templateVars: extra.templateVars ?? {},
            };
          }
        } catch {
          // aiInstructions is plain text, not JSON — skip
        }
      }

      await getQueue(channelQueue as QueueName).add("deliver", {
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
          to,
          subject: renderedSubject,
          body: renderedBody,
          metadata: twilioTemplateMeta,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(
        `[delivery-scheduler] engagementDecisionId=${engagementDecisionId} failed:`,
        message,
      );
      throw err;
    }
  };
}
