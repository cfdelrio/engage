import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { asJson } from "../utils/prisma.js";
import { OrkestaiVoiceClient } from "@engage/orkestai-voice-client";

function getVoiceClient(): OrkestaiVoiceClient | null {
  const apiUrl = process.env["ORKESTAI_VOICE_API_URL"];
  const apiKey = process.env["ORKESTAI_VOICE_API_KEY"];
  const tenantId = process.env["ORKESTAI_VOICE_TENANT_ID"];
  if (!apiUrl || !apiKey || !tenantId) return null;
  return new OrkestaiVoiceClient(apiUrl, apiKey, tenantId);
}

const flowStepSchema = z.object({
  id: z.string(),
  type: z.enum(["say", "dtmf_question", "speech_question", "goodbye"]),
  text: z.string(),
  options: z.record(z.string()).optional(),
  timeout: z.number().optional(),
});

const createVoiceCampaignSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().optional(),
  script: z.string().min(1),
  triggerType: z
    .enum(["manual", "scheduled", "rule-based", "event-based"])
    .default("manual"),
  voiceConfig: z
    .object({
      language: z.string().default("es-ES"),
      voice: z.enum(["male", "female"]).default("female"),
      speed: z.number().min(0.5).max(2.0).default(1.0),
      provider: z.string().default("twilio"),
    })
    .default({}),
  aiGenerated: z.boolean().default(false),
  aiInstructions: z.string().optional(),
  recordingUrl: z.string().optional(),
  audienceFilter: z.record(z.unknown()).optional().default({}),
  dtmfConfig: z
    .object({
      enabled: z.boolean().default(false),
      options: z
        .array(
          z.object({
            key: z.string().min(1).max(3),
            label: z.string(),
            action: z.string(),
          }),
        )
        .optional(),
    })
    .optional(),
  callbackWorkflow: z
    .object({
      enabled: z.boolean().default(false),
      conditions: z.array(z.unknown()).optional(),
    })
    .optional(),
  maxRetries: z.number().min(0).max(5).default(2),
  scheduledFor: z.string().datetime().optional(),
  startAt: z.string().datetime().optional(),
  endAt: z.string().datetime().optional(),
});

const updateVoiceCampaignSchema = createVoiceCampaignSchema.partial();

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Authenticated campaign management endpoints
const voiceCampaignRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook("onRequest", fastify.authenticateApiKey);

  // List campaigns
  fastify.get("/", async (request: FastifyRequest) => {
    return fastify.prisma.voiceCampaign.findMany({
      where: { tenantId: request.tenantId },
      orderBy: { createdAt: "desc" },
    });
  });

  // Create campaign
  fastify.post("/", async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createVoiceCampaignSchema.parse(request.body);
    const campaign = await fastify.prisma.voiceCampaign.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        description: body.description,
        script: body.script,
        triggerType: body.triggerType,
        voiceConfig: asJson(body.voiceConfig),
        aiGenerated: body.aiGenerated,
        aiInstructions: body.aiInstructions,
        recordingUrl: body.recordingUrl,
        audienceFilter: asJson(body.audienceFilter),
        dtmfConfig:
          body.dtmfConfig !== undefined ? asJson(body.dtmfConfig) : undefined,
        callbackWorkflow:
          body.callbackWorkflow !== undefined
            ? asJson(body.callbackWorkflow)
            : undefined,
        maxRetries: body.maxRetries,
        status: "draft",
        scheduledFor: body.scheduledFor ? new Date(body.scheduledFor) : null,
        startAt: body.startAt ? new Date(body.startAt) : null,
        endAt: body.endAt ? new Date(body.endAt) : null,
      },
    });
    return reply.status(201).send(campaign);
  });

  // Get call details (must come before /:id to avoid match conflict)
  fastify.get(
    "/calls/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const call = await fastify.prisma.voiceCall.findFirst({
        where: { id, tenantId: request.tenantId },
        include: { interactions: { orderBy: { timestamp: "asc" } } },
      });

      if (!call) return reply.status(404).send({ error: "Not found" });
      return reply.send(call);
    },
  );

  // Schedule callback
  fastify.post(
    "/calls/:id/callback",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          scheduledFor: z.string().datetime(),
          reason: z.string().optional(),
        })
        .parse(request.body);

      const call = await fastify.prisma.voiceCall.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!call) return reply.status(404).send({ error: "Not found" });

      const updated = await fastify.prisma.voiceCall.update({
        where: { id },
        data: {
          callbackScheduled: new Date(body.scheduledFor),
          callbackReason: body.reason,
        },
      });

      return reply.send(updated);
    },
  );

  // Get campaign
  fastify.get("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.voiceCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { calls: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
    if (!campaign) return reply.status(404).send({ error: "Not found" });
    return campaign;
  });

  // Update campaign
  fastify.put("/:id", async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };
    const body = updateVoiceCampaignSchema.parse(request.body);

    const campaign = await fastify.prisma.voiceCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
    });

    if (!campaign) return reply.status(404).send({ error: "Not found" });
    if (campaign.status !== "draft" && campaign.status !== "paused") {
      return reply
        .status(400)
        .send({ error: "Can only update draft or paused campaigns" });
    }

    const updated = await fastify.prisma.voiceCampaign.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.description !== undefined && {
          description: body.description,
        }),
        ...(body.script && { script: body.script }),
        ...(body.triggerType && { triggerType: body.triggerType }),
        ...(body.voiceConfig && { voiceConfig: asJson(body.voiceConfig) }),
        ...(body.aiGenerated !== undefined && {
          aiGenerated: body.aiGenerated,
        }),
        ...(body.aiInstructions !== undefined && {
          aiInstructions: body.aiInstructions,
        }),
        ...(body.recordingUrl !== undefined && {
          recordingUrl: body.recordingUrl,
        }),
        ...(body.audienceFilter && {
          audienceFilter: asJson(body.audienceFilter),
        }),
        ...(body.dtmfConfig && { dtmfConfig: asJson(body.dtmfConfig) }),
        ...(body.callbackWorkflow && {
          callbackWorkflow: asJson(body.callbackWorkflow),
        }),
        ...(body.maxRetries !== undefined && { maxRetries: body.maxRetries }),
        ...(body.startAt && { startAt: new Date(body.startAt) }),
        ...(body.endAt && { endAt: new Date(body.endAt) }),
      },
    });

    return reply.send(updated);
  });

  // Delete campaign
  fastify.delete(
    "/:id",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const campaign = await fastify.prisma.voiceCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign) return reply.status(404).send({ error: "Not found" });
      if (campaign.status !== "draft") {
        return reply
          .status(400)
          .send({ error: "Can only delete draft campaigns" });
      }

      await fastify.prisma.voiceCampaign.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  // Add audience to campaign via orkestai-voice
  fastify.post(
    "/:id/add-audience",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({
          contacts: z.array(
            z.object({
              phone: z.string(),
              firstName: z.string(),
              lastName: z.string().optional(),
              email: z.string().optional(),
              metadata: z.record(z.unknown()).optional(),
            }),
          ),
        })
        .parse(request.body);

      const campaign = await fastify.prisma.voiceCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign) return reply.status(404).send({ error: "Not found" });
      if (campaign.status !== "draft") {
        return reply
          .status(400)
          .send({ error: "Campaign must be in draft status to add audience" });
      }

      const client = getVoiceClient();
      if (!client) {
        return reply
          .status(503)
          .send({ error: "orkestai-voice not configured (missing env vars)" });
      }

      let orkestaiCampaignId = campaign.orkestaiCampaignId;
      if (!orkestaiCampaignId) {
        const voiceConfig =
          (campaign.voiceConfig as Record<string, unknown>) ?? {};
        const created = await client.createCampaign(
          campaign.name,
          (campaign.ttsProvider as "elevenlabs" | "openai") ?? "elevenlabs",
          campaign.elevenLabsVoiceId ?? undefined,
          campaign.aiInstructions ?? undefined,
          campaign.description ?? undefined,
        );
        orkestaiCampaignId = created.id;
        await fastify.prisma.voiceCampaign.update({
          where: { id },
          data: {
            orkestaiCampaignId,
            ttsProvider: (voiceConfig["provider"] as string) ?? "elevenlabs",
          },
        });
      }

      const contactIds: string[] = [];
      for (const c of body.contacts) {
        const contact = await client.createContact(
          c.firstName,
          c.phone,
          c.lastName,
          c.email,
          c.metadata,
        );
        contactIds.push(contact.id);
      }

      const result = await client.addRecipients(orkestaiCampaignId, contactIds);

      await fastify.prisma.voiceCampaign.update({
        where: { id },
        data: { audienceSize: { increment: result.added } },
      });

      return reply.status(201).send({
        added: result.added,
        skipped: result.skipped,
        audienceSize: (campaign.audienceSize ?? 0) + result.added,
      });
    },
  );

  // Start campaign via orkestai-voice
  fastify.post(
    "/:id/start",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const body = z
        .object({ steps: z.array(flowStepSchema).optional() })
        .optional()
        .parse(request.body);

      const campaign = await fastify.prisma.voiceCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign) return reply.status(404).send({ error: "Not found" });
      if (campaign.status !== "draft") {
        return reply
          .status(400)
          .send({ error: "Campaign must be in draft status" });
      }

      const client = getVoiceClient();
      if (!client) {
        return reply
          .status(503)
          .send({ error: "orkestai-voice not configured (missing env vars)" });
      }

      let orkestaiCampaignId = campaign.orkestaiCampaignId;
      if (!orkestaiCampaignId) {
        return reply.status(400).send({
          error: "Add audience first via POST /:id/add-audience",
        });
      }

      const steps = body?.steps ?? [
        { id: "s1", type: "say" as const, text: campaign.script },
      ];

      await client.defineCampaignFlow(orkestaiCampaignId, steps);

      const startResult = await client.startCampaign(orkestaiCampaignId);

      const updated = await fastify.prisma.voiceCampaign.update({
        where: { id },
        data: {
          status: "running",
          startAt: new Date(),
          flowSteps: asJson(steps),
        },
      });

      return reply.send({
        ...updated,
        enqueued: startResult.enqueued,
        message: `${startResult.enqueued} calls enqueued via orkestai-voice`,
      });
    },
  );

  // Pause campaign
  fastify.post(
    "/:id/pause",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const campaign = await fastify.prisma.voiceCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign) return reply.status(404).send({ error: "Not found" });
      if (campaign.status !== "running") {
        return reply
          .status(400)
          .send({ error: "Campaign must be in running status" });
      }

      if (campaign.orkestaiCampaignId) {
        const client = getVoiceClient();
        if (client) await client.pauseCampaign(campaign.orkestaiCampaignId);
      }

      const updated = await fastify.prisma.voiceCampaign.update({
        where: { id },
        data: { status: "paused" },
      });

      return reply.send(updated);
    },
  );

  // Resume campaign
  fastify.post(
    "/:id/resume",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const campaign = await fastify.prisma.voiceCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign) return reply.status(404).send({ error: "Not found" });
      if (campaign.status !== "paused") {
        return reply
          .status(400)
          .send({ error: "Campaign must be in paused status" });
      }

      if (campaign.orkestaiCampaignId) {
        const client = getVoiceClient();
        if (client) await client.resumeCampaign(campaign.orkestaiCampaignId);
      }

      const updated = await fastify.prisma.voiceCampaign.update({
        where: { id },
        data: { status: "running" },
      });

      return reply.send(updated);
    },
  );

  // Get campaign results from orkestai-voice
  fastify.get(
    "/:id/results",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const campaign = await fastify.prisma.voiceCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign) return reply.status(404).send({ error: "Not found" });

      if (!campaign.orkestaiCampaignId) {
        return reply.send({ campaign, stats: null, recipients: [] });
      }

      const client = getVoiceClient();
      if (!client) {
        return reply
          .status(503)
          .send({ error: "orkestai-voice not configured" });
      }

      const results = await client.getCampaignResults(
        campaign.orkestaiCampaignId,
      );
      return reply.send(results);
    },
  );

  // List calls for campaign
  fastify.get(
    "/:id/calls",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const campaign = await fastify.prisma.voiceCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign) return reply.status(404).send({ error: "Not found" });

      const calls = await fastify.prisma.voiceCall.findMany({
        where: { voiceCampaignId: id },
        include: { interactions: { orderBy: { timestamp: "asc" } } },
        orderBy: { createdAt: "desc" },
      });

      return reply.send({ calls });
    },
  );

  // Get campaign metrics
  fastify.get(
    "/:id/metrics",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };

      const campaign = await fastify.prisma.voiceCampaign.findFirst({
        where: { id, tenantId: request.tenantId },
      });

      if (!campaign) return reply.status(404).send({ error: "Not found" });

      const [metrics, interactions] = await Promise.all([
        fastify.prisma.voiceMetric.findMany({
          where: { voiceCampaignId: id },
          orderBy: { date: "asc" },
        }),
        fastify.prisma.voiceInteraction.findMany({
          where: {
            tenantId: request.tenantId,
            type: "sentiment",
            call: { voiceCampaignId: id },
          },
          select: { data: true },
        }),
      ]);

      const sentiment = { positive: 0, neutral: 0, negative: 0 };
      for (const i of interactions) {
        const d = i.data as Record<string, unknown>;
        const s = d["sentiment"] as string | undefined;
        if (s === "positive") sentiment.positive++;
        else if (s === "negative") sentiment.negative++;
        else sentiment.neutral++;
      }

      return reply.send({ metrics, sentiment });
    },
  );
};

// Public TwiML endpoint — called by Twilio during active calls (no API key auth)
// Twilio's request signature should be verified in production
const voiceTwimlRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/twiml/:deliveryId",
    async (request: FastifyRequest, reply: FastifyReply) => {
      const { deliveryId } = request.params as { deliveryId: string };

      const delivery = await fastify.prisma.delivery.findUnique({
        where: { id: deliveryId },
        include: { engagementDecision: true },
      });

      if (!delivery) {
        reply.header("Content-Type", "text/xml");
        return reply.send(
          '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-MX">Lo sentimos, no se encontró la información solicitada.</Say></Response>',
        );
      }

      const payload = delivery.payload as Record<string, unknown>;
      const message =
        (payload["body"] as string) ?? "Este es un mensaje de ORKESTAI ENGAGE.";

      reply.header("Content-Type", "text/xml");
      return reply.send(
        `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say language="es-MX" voice="alice">${escapeXml(message)}</Say>
  <Pause length="1"/>
  <Say language="es-MX" voice="alice">Para confirmar que recibiste este mensaje, presioná 1. Para no recibir más llamadas, presioná 9.</Say>
  <Gather numDigits="1" action="/webhooks/twilio/voice-dtmf/${deliveryId}" method="POST" timeout="5">
  </Gather>
  <Say language="es-MX" voice="alice">No recibimos respuesta. Hasta pronto.</Say>
</Response>`,
      );
    },
  );
};

// Combined export — route registration in app.ts handles the split
const voiceRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(voiceCampaignRoutes);
  await fastify.register(voiceTwimlRoutes);
};

export default voiceRoutes;
