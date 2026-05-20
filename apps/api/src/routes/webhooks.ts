import type { FastifyPluginAsync } from 'fastify';
import { asJson, asJsonNullable } from '../utils/prisma.js';

const webhooksRoutes: FastifyPluginAsync = async (fastify) => {
  // Resend webhooks
  fastify.post('/resend', async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown> | undefined;
    const messageId = (data?.['email_id'] ?? data?.['message_id']) as string | undefined;

    if (!messageId) return reply.status(200).send({ ok: true });

    const delivery = await fastify.prisma.delivery.findFirst({
      where: { providerMessageId: messageId },
    });

    if (!delivery) return reply.status(200).send({ ok: true });

    const eventType = body['type'] as string;
    const statusMap: Record<string, string> = {
      'email.delivered': 'delivered',
      'email.opened': 'opened',
      'email.clicked': 'clicked',
      'email.bounced': 'bounced',
      'email.complained': 'unsubscribed',
    };

    const status = statusMap[eventType];
    if (status) {
      const update: Record<string, Date | string> = { status };
      if (status === 'delivered') update['deliveredAt'] = new Date();
      if (status === 'opened') update['openedAt'] = new Date();
      if (status === 'clicked') update['clickedAt'] = new Date();

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
  });

  // Twilio SMS/Voice webhooks
  fastify.post('/twilio', async (request, reply) => {
    const form = request.body as Record<string, string>;
    const sid = form['MessageSid'] ?? form['CallSid'];
    const status = form['MessageStatus'] ?? form['CallStatus'];

    if (!sid) return reply.status(200).send({ ok: true });

    const delivery = await fastify.prisma.delivery.findFirst({
      where: { providerMessageId: sid },
    });

    if (!delivery) return reply.status(200).send({ ok: true });

    const statusMap: Record<string, string> = {
      delivered: 'delivered',
      sent: 'sent',
      undelivered: 'failed',
      failed: 'failed',
      completed: 'delivered',
      'no-answer': 'failed',
      busy: 'failed',
    };

    const mapped = statusMap[status ?? ''];
    if (mapped) {
      await fastify.prisma.delivery.update({
        where: { id: delivery.id },
        data: { status: mapped, ...(mapped === 'delivered' ? { deliveredAt: new Date() } : {}) },
      });

      await fastify.prisma.deliveryEvent.create({
        data: { deliveryId: delivery.id, event: mapped, data: asJson({ status }), rawWebhook: asJsonNullable(form) },
      });
    }

    return reply.status(200).send({ ok: true });
  });
};

export default webhooksRoutes;
