import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { asJson } from '../utils/prisma.js';

const voiceCampaignSchema = z.object({
  name: z.string().min(1).max(256),
  script: z.string().min(1),
  voiceConfig: z.object({
    voice: z.string().default('alice'),
    language: z.string().default('es-MX'),
    pauseSeconds: z.number().default(1),
  }).default({}),
  audienceFilter: z.record(z.unknown()).optional().default({}),
  scheduledFor: z.string().datetime().optional(),
});

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Authenticated campaign management endpoints
const voiceCampaignRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', fastify.authenticateApiKey);

  fastify.get('/campaigns', async (request) => {
    return fastify.prisma.voiceCampaign.findMany({
      where: { tenantId: request.tenantId },
      orderBy: { createdAt: 'desc' },
    });
  });

  fastify.post('/campaigns', async (request, reply) => {
    const body = voiceCampaignSchema.parse(request.body);
    const campaign = await fastify.prisma.voiceCampaign.create({
      data: {
        tenantId: request.tenantId,
        name: body.name,
        script: body.script,
        voiceConfig: asJson(body.voiceConfig),
        audienceFilter: asJson(body.audienceFilter),
        status: 'draft',
        ...(body.scheduledFor ? { scheduledFor: new Date(body.scheduledFor) } : {}),
      },
    });
    return reply.status(201).send(campaign);
  });

  fastify.get('/campaigns/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const campaign = await fastify.prisma.voiceCampaign.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { calls: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
    if (!campaign) return reply.status(404).send({ error: 'Not found' });
    return campaign;
  });
};

// Public TwiML endpoint — called by Twilio during active calls (no API key auth)
// Twilio's request signature should be verified in production
const voiceTwimlRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/twiml/:deliveryId', async (request, reply) => {
    const { deliveryId } = request.params as { deliveryId: string };

    const delivery = await fastify.prisma.delivery.findUnique({
      where: { id: deliveryId },
      include: { engagementDecision: true },
    });

    if (!delivery) {
      reply.header('Content-Type', 'text/xml');
      return reply.send(
        '<?xml version="1.0" encoding="UTF-8"?><Response><Say language="es-MX">Lo sentimos, no se encontró la información solicitada.</Say></Response>',
      );
    }

    const payload = delivery.payload as Record<string, unknown>;
    const message = (payload['body'] as string) ?? 'Este es un mensaje de ORKESTAI ENGAGE.';

    reply.header('Content-Type', 'text/xml');
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
  });
};

// Combined export — route registration in app.ts handles the split
const voiceRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(voiceCampaignRoutes);
  await fastify.register(voiceTwimlRoutes);
};

export default voiceRoutes;
