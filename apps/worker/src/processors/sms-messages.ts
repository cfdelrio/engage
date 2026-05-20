import type { Job } from 'bullmq';
import { PrismaClient } from '@engage/database';
import Handlebars from 'handlebars';
import { TwilioSMSProvider } from '@engage/channels';

interface SmsMessageJob {
  smsCampaignId: string;
  userId: string;
  phone: string;
  body: string;
  fromNumber?: string;
  attempt: number;
}

const prisma = new PrismaClient();

export async function processSmsMessage(job: Job<SmsMessageJob>) {
  const { smsCampaignId, userId, phone, body, fromNumber, attempt } = job.data;

  console.log(`[sms-messages] Processing ${smsCampaignId}:${userId}, attempt ${attempt + 1}`);

  let deliveryId: string | null = null;

  try {
    const [campaign, user] = await Promise.all([
      prisma.smsCampaign.findUniqueOrThrow({ where: { id: smsCampaignId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);

    // Create delivery record
    const delivery = await prisma.smsDelivery.create({
      data: {
        smsCampaignId,
        tenantId: campaign.tenantId,
        userId,
        phone,
        status: 'queued',
      },
    });
    deliveryId = delivery.id;

    // Render body with user context
    let renderedBody = body;
    try {
      const userContext = {
        user: {
          email: user.email,
          phone: user.phone,
          ...((user.metadata as Record<string, unknown>) ?? {}),
        },
      };
      renderedBody = Handlebars.compile(body)(userContext);
    } catch (err) {
      console.error(`[sms-messages] Template render failed: ${err}`);
    }

    // Resolve provider config
    const providerRecord = await prisma.channelProvider.findFirst({
      where: { tenantId: campaign.tenantId, channel: 'sms', isActive: true },
    });
    if (!providerRecord) throw new Error('No active SMS provider configured');

    const config = JSON.parse(providerRecord.configEncrypted) as {
      accountSid: string;
      authToken: string;
      fromNumber: string;
    };

    const smsProvider = new TwilioSMSProvider(
      config.accountSid,
      config.authToken,
      fromNumber ?? campaign.fromNumber ?? config.fromNumber,
    );

    // Send
    const result = await smsProvider.send({
      deliveryId: delivery.id,
      tenantId: campaign.tenantId,
      userId,
      channel: 'sms',
      provider: 'twilio',
      to: phone,
      body: renderedBody,
      metadata: {},
    });

    if (result.success) {
      await prisma.smsDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          twilioMessageSid: result.providerMessageId ?? null,
        },
      });

      // Update campaign stats
      await prisma.$executeRaw`
        UPDATE sms_campaigns
        SET stats = jsonb_set(stats, '{sent}', (COALESCE((stats->>'sent')::int, 0) + 1)::text::jsonb)
        WHERE id = ${smsCampaignId}
      `;

      console.log(`[sms-messages] Sent: ${result.providerMessageId}`);
    } else {
      throw new Error(result.error ?? 'Send failed');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sms-messages] Error: ${message}`);

    if (deliveryId) {
      const isLast = attempt >= 2;
      await prisma.smsDelivery.update({
        where: { id: deliveryId },
        data: {
          status: isLast ? 'failed' : 'queued',
          ...(isLast ? { failedAt: new Date(), errorMessage: message } : {}),
        },
      }).catch(() => {});
    }

    if (attempt < 2) throw new Error(message);
  }
}
