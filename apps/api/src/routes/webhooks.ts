import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { verifySvixSignature, verifyTwilioSignature } from "@engage/core";
import { asJson, asJsonNullable } from "../utils/prisma.js";
import {
  verifyWebhookSignature,
  parseWebhookPayload,
  isCallCompletedEvent,
  isCampaignCompletedEvent,
} from "@engage/orkestai-voice-client";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

const warnedMissingSecret = new Set<string>();
function warnOnce(provider: string): void {
  if (warnedMissingSecret.has(provider)) return;
  warnedMissingSecret.add(provider);
  console.warn(
    `[webhooks] ${provider} signature verification disabled (env var not set). ` +
      `Set the appropriate secret in production to prevent forged webhook calls.`,
  );
}

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // Capture raw body for signature verification — scoped to this plugin only.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (req, body, done) => {
      const buf = body as Buffer;
      req.rawBody = buf;
      try {
        const json = buf.length === 0 ? {} : JSON.parse(buf.toString("utf8"));
        done(null, json);
      } catch (err) {
        done(err as Error, undefined);
      }
    },
  );

  fastify.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "buffer" },
    (req, body, done) => {
      const buf = body as Buffer;
      req.rawBody = buf;
      const text = buf.toString("utf8");
      const parsed: Record<string, string> = {};
      for (const pair of text.split("&")) {
        if (!pair) continue;
        const eqIdx = pair.indexOf("=");
        const key = eqIdx === -1 ? pair : pair.slice(0, eqIdx);
        const value = eqIdx === -1 ? "" : pair.slice(eqIdx + 1);
        parsed[decodeURIComponent(key.replace(/\+/g, " "))] =
          decodeURIComponent(value.replace(/\+/g, " "));
      }
      done(null, parsed);
    },
  );

  function reconstructUrl(req: FastifyRequest): string {
    const proto = (req.headers["x-forwarded-proto"] as string) ?? req.protocol;
    const host =
      (req.headers["x-forwarded-host"] as string) ??
      req.headers.host ??
      "localhost";
    return `${proto}://${host}${req.url}`;
  }

  function verifyTwilio(request: FastifyRequest, reply: FastifyReply): boolean {
    const authToken = process.env["TWILIO_AUTH_TOKEN"];
    if (!authToken) {
      warnOnce("twilio");
      return true;
    }
    const signature = request.headers["x-twilio-signature"];
    const headerValue = Array.isArray(signature) ? signature[0] : signature;
    const valid = verifyTwilioSignature({
      url: reconstructUrl(request),
      authToken,
      signature: headerValue,
      params: request.body as Record<string, string>,
    });
    if (!valid) {
      reply.status(401).send({ error: "Invalid Twilio signature" });
      return false;
    }
    return true;
  }

  // Resend webhooks - Email campaigns
  fastify.post(
    "/resend",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const secret = process.env["RESEND_WEBHOOK_SECRET"];
      if (secret) {
        const valid = verifySvixSignature({
          rawBody: request.rawBody ?? Buffer.alloc(0),
          headers: request.headers as Record<
            string,
            string | string[] | undefined
          >,
          secret,
        });
        if (!valid) {
          return reply.status(401).send({ error: "Invalid Resend signature" });
        }
      } else {
        warnOnce("resend");
      }

      const body = request.body as Record<string, unknown>;
      const data = body["data"] as Record<string, unknown> | undefined;
      const messageId = (data?.["email_id"] ?? data?.["message_id"]) as
        | string
        | undefined;
      const eventType = body["type"] as string;

      if (!messageId) return reply.status(200).send({ ok: true });

      // Try EmailDelivery first (new campaigns model)
      const emailDelivery = await fastify.prisma.emailDelivery.findFirst({
        where: { resendMessageId: messageId },
        include: { campaign: true },
      });

      if (emailDelivery) {
        const eventMap: Record<string, string> = {
          "email.delivered": "delivered",
          "email.opened": "opened",
          "email.clicked": "clicked",
          "email.bounced": "bounced",
          "email.complained": "bounced",
        };

        const event = eventMap[eventType];
        if (event) {
          const updateData: Record<string, Date> = {};
          if (event === "delivered") updateData.deliveredAt = new Date();
          if (event === "opened") updateData.openedAt = new Date();
          if (event === "clicked") updateData.clickedAt = new Date();
          if (event === "bounced") updateData.bouncedAt = new Date();

          await fastify.prisma.emailDelivery.update({
            where: { id: emailDelivery.id },
            data: updateData,
          });

          // Update daily metrics
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);

          const metricUpdate: Record<string, number> = {};
          if (event === "delivered") metricUpdate.delivered = 1;
          if (event === "opened") metricUpdate.opened = 1;
          if (event === "clicked") metricUpdate.clicked = 1;
          if (event === "bounced") metricUpdate.bounced = 1;

          await fastify.prisma.emailMetric.upsert({
            where: {
              campaignId_date: {
                campaignId: emailDelivery.emailCampaignId,
                date: today,
              },
            },
            update: metricUpdate,
            create: {
              campaignId: emailDelivery.emailCampaignId,
              tenantId: emailDelivery.tenantId,
              date: today,
              ...metricUpdate,
            },
          });
        }

        return reply.status(200).send({ ok: true });
      }

      // Fallback to generic Delivery model for backward compatibility
      const delivery = await fastify.prisma.delivery.findFirst({
        where: { providerMessageId: messageId },
      });

      if (!delivery) return reply.status(200).send({ ok: true });

      const statusMap: Record<string, string> = {
        "email.delivered": "delivered",
        "email.opened": "opened",
        "email.clicked": "clicked",
        "email.bounced": "bounced",
        "email.complained": "unsubscribed",
      };

      const status = statusMap[eventType];
      if (status) {
        const update: Record<string, Date | string> = { status };
        if (status === "delivered") update["deliveredAt"] = new Date();
        if (status === "opened") update["openedAt"] = new Date();
        if (status === "clicked") update["clickedAt"] = new Date();

        await fastify.prisma.delivery.update({
          where: { id: delivery.id },
          data: update,
        });

        await fastify.prisma.deliveryEvent.create({
          data: {
            deliveryId: delivery.id,
            event: status,
            data: asJson(data ?? {}),
            rawWebhook: asJsonNullable(body),
          },
        });
      }

      return reply.status(200).send({ ok: true });
    },
  );

  // Twilio SMS/Voice webhooks (legacy delivery endpoint + SMS campaigns)
  fastify.post(
    "/twilio",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!verifyTwilio(request, reply)) return;
      const form = request.body as Record<string, string>;
      const messageSid = form["MessageSid"];
      const messageStatus = form["MessageStatus"];

      if (!messageSid || !messageStatus)
        return reply.status(200).send({ ok: true });

      // Try SmsDelivery first (new campaigns model)
      const smsDelivery = await fastify.prisma.smsDelivery.findFirst({
        where: { twilioMessageSid: messageSid },
        include: { campaign: true },
      });

      if (smsDelivery) {
        const statusMap: Record<string, string> = {
          sent: "sent",
          delivered: "delivered",
          failed: "failed",
          undelivered: "failed",
        };

        const mappedStatus = statusMap[messageStatus];
        if (mappedStatus) {
          const updateData: Record<string, string | Date> = {
            status: mappedStatus,
          };
          if (mappedStatus === "delivered") updateData.deliveredAt = new Date();
          if (mappedStatus === "failed") updateData.failedAt = new Date();

          await fastify.prisma.smsDelivery.update({
            where: { id: smsDelivery.id },
            data: updateData,
          });

          // Update daily metrics
          const today = new Date();
          today.setUTCHours(0, 0, 0, 0);

          const metricIncrement: Record<string, number> = {};
          if (mappedStatus === "delivered") metricIncrement.delivered = 1;
          if (mappedStatus === "failed") metricIncrement.failed = 1;

          if (Object.keys(metricIncrement).length > 0) {
            await fastify.prisma.smsMetric.upsert({
              where: {
                campaignId_date: {
                  campaignId: smsDelivery.smsCampaignId,
                  date: today,
                },
              },
              update: metricIncrement,
              create: {
                campaignId: smsDelivery.smsCampaignId,
                tenantId: smsDelivery.tenantId,
                date: today,
                ...metricIncrement,
              },
            });
          }
        }

        return reply.status(200).send({ ok: true });
      }

      // Fallback to generic Delivery model for backward compatibility
      const delivery = await fastify.prisma.delivery.findFirst({
        where: { providerMessageId: messageSid },
      });

      if (!delivery) return reply.status(200).send({ ok: true });

      const statusMap: Record<string, string> = {
        delivered: "delivered",
        sent: "sent",
        undelivered: "failed",
        failed: "failed",
        completed: "delivered",
        "no-answer": "failed",
        busy: "failed",
      };

      const mapped = statusMap[messageStatus ?? ""];
      if (mapped) {
        await fastify.prisma.delivery.update({
          where: { id: delivery.id },
          data: {
            status: mapped,
            ...(mapped === "delivered" ? { deliveredAt: new Date() } : {}),
          },
        });

        await fastify.prisma.deliveryEvent.create({
          data: {
            deliveryId: delivery.id,
            event: mapped,
            data: asJson({ status: messageStatus }),
            rawWebhook: asJsonNullable(form),
          },
        });
      }

      return reply.status(200).send({ ok: true });
    },
  );

  // Twilio Voice Campaign Status Updates
  fastify.post(
    "/twilio/voice",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!verifyTwilio(request, reply)) return;
      const form = request.body as Record<string, string>;
      const callSid = form["CallSid"];
      const callStatus = form["CallStatus"];

      if (!callSid || !callStatus) return reply.status(200).send({ ok: true });

      // Check for idempotency - don't process same event twice
      await fastify.prisma.voiceInteraction.findFirst({
        where: {
          data: { path: ["callSid"], equals: callSid },
        },
      });

      const voiceCall = await fastify.prisma.voiceCall.findFirst({
        where: { twilioCallSid: callSid },
      });

      if (!voiceCall) return reply.status(200).send({ ok: true });

      const statusMap: Record<string, string> = {
        initiated: "queued",
        ringing: "ringing",
        answered: "in_progress",
        completed: "completed",
        "no-answer": "no_answer",
        busy: "failed",
        failed: "failed",
      };

      const mappedStatus = statusMap[callStatus];
      if (mappedStatus && mappedStatus !== voiceCall.status) {
        const update: Record<string, string | Date | number> = {
          status: mappedStatus,
        };

        if (mappedStatus === "in_progress" && !voiceCall.answeredAt) {
          update["answeredAt"] = new Date();
        }

        if (["completed", "no_answer", "failed"].includes(mappedStatus)) {
          update["completedAt"] = new Date();
          update["duration"] = parseInt(form["CallDuration"] || "0", 10);
          update["terminationReason"] =
            form["CallStatus"] === "completed"
              ? "completed"
              : (form["CallStatus"] ?? "failed");
        }

        await fastify.prisma.voiceCall.update({
          where: { id: voiceCall.id },
          data: update,
        });

        // Record interaction
        await fastify.prisma.voiceInteraction.create({
          data: {
            voiceCallId: voiceCall.id,
            tenantId: voiceCall.tenantId,
            type: "call_status",
            data: asJson({
              status: mappedStatus,
              callSid,
              duration: form["CallDuration"],
              timestamp: new Date(),
            }),
          },
        });
      }

      return reply.status(200).send({ ok: true });
    },
  );

  // Twilio DTMF Gather
  fastify.post(
    "/twilio/gather",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!verifyTwilio(request, reply)) return;
      const form = request.body as Record<string, string>;
      const callSid = form["CallSid"];
      const digits = form["Digits"];

      if (!callSid || !digits) return reply.status(200).send({ ok: true });

      const voiceCall = await fastify.prisma.voiceCall.findFirst({
        where: { twilioCallSid: callSid },
      });

      if (!voiceCall) return reply.status(200).send({ ok: true });

      // Update DTMF response
      await fastify.prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: { dtmfResponse: digits },
      });

      // Record DTMF interaction
      await fastify.prisma.voiceInteraction.create({
        data: {
          voiceCallId: voiceCall.id,
          tenantId: voiceCall.tenantId,
          type: "dtmf",
          data: asJson({
            digits,
            timestamp: new Date(),
          }),
        },
      });

      return reply.status(200).send({ ok: true });
    },
  );

  // Twilio Recording Completion
  fastify.post(
    "/twilio/recording",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!verifyTwilio(request, reply)) return;
      const form = request.body as Record<string, string>;
      const callSid = form["CallSid"];
      const recordingUrl = form["RecordingUrl"];
      const recordingDuration = parseInt(form["RecordingDuration"] || "0", 10);

      if (!callSid || !recordingUrl)
        return reply.status(200).send({ ok: true });

      const voiceCall = await fastify.prisma.voiceCall.findFirst({
        where: { twilioCallSid: callSid },
      });

      if (!voiceCall) return reply.status(200).send({ ok: true });

      // Update recording
      await fastify.prisma.voiceCall.update({
        where: { id: voiceCall.id },
        data: {
          recordingUrl,
          recordingDuration,
        },
      });

      // Record recording interaction
      await fastify.prisma.voiceInteraction.create({
        data: {
          voiceCallId: voiceCall.id,
          tenantId: voiceCall.tenantId,
          type: "recording",
          data: asJson({
            recordingUrl,
            recordingDuration,
            timestamp: new Date(),
          }),
        },
      });

      return reply.status(200).send({ ok: true });
    },
  );

  // Twilio WhatsApp Message Status Updates
  fastify.post(
    "/twilio/whatsapp/status",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!verifyTwilio(request, reply)) return;
      const form = request.body as Record<string, string>;
      const messageSid = form["MessageSid"];
      const messageStatus = form["MessageStatus"];

      if (!messageSid || !messageStatus)
        return reply.status(200).send({ ok: true });

      const whatsappMessage = await fastify.prisma.whatsAppMessage.findFirst({
        where: { twilioMessageSid: messageSid },
      });

      if (!whatsappMessage) return reply.status(200).send({ ok: true });

      const statusMap: Record<string, string> = {
        sent: "sent",
        delivered: "delivered",
        read: "read",
        failed: "failed",
        undelivered: "failed",
      };

      const mappedStatus = statusMap[messageStatus];
      if (mappedStatus && mappedStatus !== whatsappMessage.status) {
        const update: Record<string, string | Date> = { status: mappedStatus };

        if (mappedStatus === "delivered") update["deliveredAt"] = new Date();
        if (mappedStatus === "read") update["readAt"] = new Date();
        if (mappedStatus === "failed") update["failedAt"] = new Date();

        await fastify.prisma.whatsAppMessage.update({
          where: { id: whatsappMessage.id },
          data: update,
        });

        await fastify.prisma.whatsAppInteraction.create({
          data: {
            whatsappMessageId: whatsappMessage.id,
            tenantId: whatsappMessage.tenantId,
            type: "status",
            data: asJson({
              status: mappedStatus,
              messageSid,
              timestamp: new Date(),
            }),
          },
        });
      }

      return reply.status(200).send({ ok: true });
    },
  );

  // Twilio WhatsApp Incoming Messages
  fastify.post(
    "/twilio/whatsapp/incoming",
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!verifyTwilio(request, reply)) return;
      const form = request.body as Record<string, string>;
      const from = form["From"];
      const body = form["Body"];
      const messageSid = form["MessageSid"];

      if (!from || !messageSid) return reply.status(200).send({ ok: true });

      // Find user by phone (from format: "whatsapp:+5491123456789")
      const phoneNumber = from.replace("whatsapp:", "");
      const user = await fastify.prisma.user.findFirst({
        where: { phone: phoneNumber },
      });

      if (!user) return reply.status(200).send({ ok: true });

      // Record incoming message as interaction (no delivery record, it's incoming)
      await fastify.prisma.whatsAppInteraction.create({
        data: {
          whatsappMessageId: messageSid,
          tenantId: user.tenantId,
          type: "incoming_message",
          data: asJson({
            from: phoneNumber,
            body,
            messageSid,
            mediaUrl: form["MediaUrl0"],
            timestamp: new Date(),
          }),
        },
      });

      return reply.status(200).send({ ok: true });
    },
  );

  // orkestai-voice webhooks: call.completed, campaign.completed
  fastify.post(
    "/orkestai-voice",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const secret = process.env["ORKESTAI_VOICE_WEBHOOK_SECRET"];
      const signature = request.headers["x-orkestai-signature"] as
        | string
        | undefined;

      if (secret && signature) {
        const rawBody =
          request.rawBody ?? Buffer.from(JSON.stringify(request.body));
        if (!verifyWebhookSignature(rawBody, signature, secret)) {
          return reply.status(401).send({ error: "Invalid webhook signature" });
        }
      } else if (secret && !signature) {
        return reply
          .status(401)
          .send({ error: "Missing x-orkestai-signature header" });
      }

      let payload;
      try {
        payload = parseWebhookPayload(request.body);
      } catch {
        return reply.status(400).send({ error: "Invalid webhook payload" });
      }

      // Idempotency: skip if already processed
      const idempotencyId = `${payload.timestamp}:${payload.tenantId}:${payload.event}`;
      const existing = await fastify.prisma.webhookEvent.findUnique({
        where: {
          source_orkestaiEventId: {
            source: "orkestai-voice",
            orkestaiEventId: idempotencyId,
          },
        },
      });
      if (existing?.processed) {
        return reply.status(200).send({ ok: true, skipped: true });
      }

      const webhookRecord = await fastify.prisma.webhookEvent.upsert({
        where: {
          source_orkestaiEventId: {
            source: "orkestai-voice",
            orkestaiEventId: idempotencyId,
          },
        },
        create: {
          tenantId: payload.tenantId,
          source: "orkestai-voice",
          orkestaiEventId: idempotencyId,
          eventType: payload.event,
          payload: asJson(payload.data),
        },
        update: {},
      });

      if (
        payload.event === "call.completed" &&
        isCallCompletedEvent(payload.data)
      ) {
        const data = payload.data;

        const campaign = await fastify.prisma.voiceCampaign.findFirst({
          where: {
            orkestaiCampaignId: data.campaignId,
            tenantId: payload.tenantId,
          },
        });

        if (campaign) {
          const user = await fastify.prisma.user.findFirst({
            where: { tenantId: payload.tenantId },
          });

          if (user) {
            const call = await fastify.prisma.voiceCall.upsert({
              where: { orkestaiCallId: data.callId },
              create: {
                voiceCampaignId: campaign.id,
                tenantId: payload.tenantId,
                userId: user.id,
                phone: "",
                status: "completed",
                orkestaiCallId: data.callId,
                duration: data.duration,
                responses: asJson(data.responses),
                completedAt: new Date(data.endedAt),
                answeredAt: new Date(data.startedAt),
              },
              update: {
                status: "completed",
                duration: data.duration,
                responses: asJson(data.responses),
                completedAt: new Date(data.endedAt),
              },
            });

            for (const response of data.responses) {
              await fastify.prisma.voiceInteraction.create({
                data: {
                  voiceCallId: call.id,
                  tenantId: payload.tenantId,
                  type: "dtmf",
                  data: asJson(response),
                },
              });
            }
          }
        }
      }

      if (
        payload.event === "campaign.completed" &&
        isCampaignCompletedEvent(payload.data)
      ) {
        const data = payload.data;
        await fastify.prisma.voiceCampaign.updateMany({
          where: {
            orkestaiCampaignId: data.campaignId,
            tenantId: payload.tenantId,
          },
          data: { status: "completed", endAt: new Date(data.completedAt) },
        });
      }

      await fastify.prisma.webhookEvent.update({
        where: { id: webhookRecord.id },
        data: { processed: true, processedAt: new Date() },
      });

      return reply.status(200).send({ ok: true });
    },
  );
};

export default webhooksRoutes;
