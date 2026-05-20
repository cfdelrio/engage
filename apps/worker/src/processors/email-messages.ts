import type { Job } from 'bullmq';
import { PrismaClient } from '@engage/database';
import Handlebars from 'handlebars';
import { ResendEmailProvider } from '@engage/channels';

interface EmailMessageJob {
  emailCampaignId: string;
  userId: string;
  email: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  attempt: number;
}

const prisma = new PrismaClient();

export async function processEmailMessage(job: Job<EmailMessageJob>) {
  const { emailCampaignId, userId, email, subject, bodyHtml, bodyText, fromName, fromEmail, replyTo, attempt } = job.data;

  console.log(`[email-messages] Processing ${emailCampaignId}:${userId}, attempt ${attempt + 1}`);

  let deliveryId: string | null = null;

  try {
    const [campaign, user] = await Promise.all([
      prisma.emailCampaign.findUniqueOrThrow({ where: { id: emailCampaignId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);

    // Create delivery record
    const delivery = await prisma.emailDelivery.create({
      data: {
        emailCampaignId,
        tenantId: campaign.tenantId,
        userId,
        email,
        status: 'queued',
      },
    });
    deliveryId = delivery.id;

    // Render templates with user context
    const userContext = {
      user: {
        email: user.email,
        phone: user.phone,
        ...((user.metadata as Record<string, unknown>) ?? {}),
      },
    };

    let renderedSubject = subject;
    let renderedBodyHtml = bodyHtml;
    let renderedBodyText = bodyText;

    try {
      renderedSubject = Handlebars.compile(subject)(userContext);
      renderedBodyHtml = Handlebars.compile(bodyHtml)(userContext);
      if (bodyText) renderedBodyText = Handlebars.compile(bodyText)(userContext);
    } catch (err) {
      console.error(`[email-messages] Template render failed: ${err}`);
    }

    // Resolve provider config
    const providerRecord = await prisma.channelProvider.findFirst({
      where: { tenantId: campaign.tenantId, channel: 'email', isActive: true },
    });
    if (!providerRecord) throw new Error('No active email provider configured');

    const config = JSON.parse(providerRecord.configEncrypted) as { apiKey: string };
    const emailProvider = new ResendEmailProvider(config.apiKey);

    // Send
    const result = await emailProvider.send({
      deliveryId: delivery.id,
      tenantId: campaign.tenantId,
      userId,
      channel: 'email',
      provider: 'resend',
      to: email,
      subject: renderedSubject,
      body: renderedBodyHtml,
      metadata: {
        bodyText: renderedBodyText,
        fromName: fromName ?? campaign.fromName ?? undefined,
        fromEmail: fromEmail ?? campaign.fromEmail ?? undefined,
        replyTo: replyTo ?? campaign.replyTo ?? undefined,
      },
    });

    if (result.success) {
      await prisma.emailDelivery.update({
        where: { id: delivery.id },
        data: {
          status: 'sent',
          sentAt: new Date(),
          resendMessageId: result.providerMessageId ?? null,
        },
      });

      // Update campaign stats
      await prisma.$executeRaw`
        UPDATE email_campaigns
        SET stats = jsonb_set(stats, '{sent}', (COALESCE((stats->>'sent')::int, 0) + 1)::text::jsonb)
        WHERE id = ${emailCampaignId}
      `;

      console.log(`[email-messages] Sent: ${result.providerMessageId}`);
    } else {
      throw new Error(result.error ?? 'Send failed');
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[email-messages] Error: ${message}`);

    if (deliveryId) {
      const isLast = attempt >= 2;
      await prisma.emailDelivery.update({
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
