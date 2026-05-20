import type { Job } from 'bullmq';
import { PrismaClient } from '@engage/database';
import Handlebars from 'handlebars';
import { TwilioWhatsAppProvider } from '@engage/channels';

interface WhatsAppMessageJob {
  whatsappCampaignId: string;
  userId: string;
  phone: string;
  body: string;
  headerType?: string;
  headerValue?: string;
  footerText?: string;
  buttons?: Array<{ id: string; title: string }>;
  attempt: number;
}

const prisma = new PrismaClient();

export async function processWhatsAppMessage(job: Job<WhatsAppMessageJob>) {
  const {
    whatsappCampaignId,
    userId,
    phone,
    body,
    headerType,
    headerValue,
    footerText,
    buttons,
    attempt,
  } = job.data;

  console.log(
    `[whatsapp-messages] Processing message ${whatsappCampaignId}:${userId}, attempt ${attempt + 1}`
  );

  try {
    // Fetch campaign and user
    const [campaign, user] = await Promise.all([
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
      // Create WhatsAppMessage record
      const message = await prisma.whatsAppMessage.create({
        data: {
          whatsappCampaignId,
          userId,
          tenantId: campaign.tenantId,
          phone,
          body: renderedBody,
          headerType,
          headerValue,
          footerText,
          buttons,
          status: 'sent',
          twilioMessageSid: result.messageSid,
          sentAt: new Date(),
        },
      });

      // Create interaction record
      await prisma.whatsAppInteraction.create({
        data: {
          whatsappMessageId: message.id,
          tenantId: campaign.tenantId,
          type: 'sent',
          data: { messageSid: result.messageSid },
        },
      });

      console.log(`[whatsapp-messages] Message sent: ${result.messageSid}`);
    } else {
      throw new Error(`Twilio error: ${result.error}`);
    }
  } catch (err) {
    console.error(`[whatsapp-messages] Error processing message: ${err}`);

    if (attempt < 3) {
      const delayMs = attempt === 0 ? 60000 : attempt === 1 ? 300000 : 1800000; // 1m, 5m, 30m
      throw new Error(`Retryable error: ${err}. Retry in ${delayMs / 1000}s`);
    } else {
      // Max retries exceeded
      try {
        const message = await prisma.whatsAppMessage.findFirst({
          where: {
            whatsappCampaignId: job.data.whatsappCampaignId,
            userId: job.data.userId,
          },
        });

        if (message) {
          await prisma.whatsAppMessage.update({
            where: { id: message.id },
            data: {
              status: 'failed',
              failedAt: new Date(),
              errorMessage: String(err),
            },
          });
        }
      } catch (updateErr) {
        console.error(`[whatsapp-messages] Failed to mark as failed: ${updateErr}`);
      }
    }
  }
}
