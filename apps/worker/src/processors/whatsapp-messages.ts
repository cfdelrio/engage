import type { Job } from 'bullmq';
import { PrismaClient } from '@engage/database';
import Handlebars from 'handlebars';
import { TwilioWhatsAppProvider } from '@engage/channels';

interface WhatsAppMessageJob {
  whatsappMessageId: string;
  whatsappCampaignId: string;
  userId: string;
  phone: string;
  body: string;
  headerType?: string;
  headerValue?: string;
  footerText?: string;
  buttons?: Array<{ id: string; title: string }>;
}

const prisma = new PrismaClient();

export async function processWhatsAppMessage(job: Job<WhatsAppMessageJob>) {
  const {
    whatsappMessageId,
    whatsappCampaignId,
    userId,
    phone,
    body,
    headerType,
    headerValue,
    footerText,
    buttons,
  } = job.data;

  console.log(`[whatsapp-messages] Processing message ${whatsappMessageId}, attempt ${job.attemptsMade + 1}`);

  try {
    // Fetch message, campaign, and user
    const [message, campaign, user] = await Promise.all([
      prisma.whatsAppMessage.findUniqueOrThrow({ where: { id: whatsappMessageId } }),
      prisma.whatsAppCampaign.findUniqueOrThrow({ where: { id: whatsappCampaignId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);

    // Render message body with user variables
    let renderedBody = body;
    try {
      const template = Handlebars.compile(body);
      const metadata = (user.metadata as Record<string, unknown>) || {};
      renderedBody = template({
        user: {
          firstName: user.externalId?.split('-')[0] || 'usuario',
          email: user.email,
          phone: user.phone,
          ...metadata,
        },
      });
    } catch (err) {
      console.error(`[whatsapp-messages] Failed to render template: ${err}`);
    }

    // Get Twilio credentials from ChannelProvider
    const provider = await prisma.channelProvider.findFirst({
      where: {
        tenantId: campaign.tenantId,
        channel: 'whatsapp',
        isActive: true,
      },
    });

    if (!provider) {
      throw new Error('No active Twilio WhatsApp provider configured');
    }

    // Decrypt config
    const config = JSON.parse(provider.configEncrypted);
    const whatsappProvider = new TwilioWhatsAppProvider(
      config.accountSid,
      config.authToken,
      config.from
    );

    // Send message
    const result = await whatsappProvider.send({
      phone,
      body: renderedBody,
      headerType: (headerType as any) || 'text',
      headerValue,
      footerText,
      buttons,
    });

    if (result.status === 'queued' || result.status === 'sent') {
      // Update WhatsAppMessage record
      await prisma.whatsAppMessage.update({
        where: { id: whatsappMessageId },
        data: {
          status: 'sent',
          body: renderedBody,
          twilioMessageSid: result.messageSid,
          sentAt: new Date(),
        },
      });

      // Create interaction record
      await prisma.whatsAppInteraction.create({
        data: {
          whatsappMessageId,
          tenantId: campaign.tenantId,
          type: 'sent',
          data: { messageSid: result.messageSid },
        },
      });

      // Update campaign stats
      await prisma.$executeRaw`
        UPDATE whatsapp_campaigns
        SET stats = jsonb_set(stats, '{sent}', (COALESCE((stats->>'sent')::int, 0) + 1)::text::jsonb)
        WHERE id = ${whatsappCampaignId}
      `;

      console.log(`[whatsapp-messages] Message sent: ${result.messageSid}`);
    } else {
      throw new Error(`Twilio error: ${result.error}`);
    }
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[whatsapp-messages] Error processing message: ${errMsg}`);

    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1) - 1;
    await prisma.whatsAppMessage.update({
      where: { id: whatsappMessageId },
      data: {
        status: isLastAttempt ? 'failed' : 'queued',
        ...(isLastAttempt ? { failedAt: new Date(), errorMessage: errMsg } : {}),
      },
    }).catch(() => {});

    throw err;
  }
}
