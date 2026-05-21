import type { Job } from "bullmq";
import { PrismaClient } from "@engage/database";
import Handlebars from "handlebars";
import { ResendEmailProvider } from "@engage/channels";

interface EmailMessageJob {
  deliveryId: string;
  emailCampaignId: string;
  userId: string;
  email: string;
  subject: string;
  bodyHtml: string;
  bodyText?: string;
  fromName?: string;
  fromEmail?: string;
  replyTo?: string;
  unsubscribeUrl?: string;
}

const prisma = new PrismaClient();

export async function processEmailMessage(job: Job<EmailMessageJob>) {
  const {
    deliveryId,
    emailCampaignId,
    userId,
    email,
    subject,
    bodyHtml,
    bodyText,
    fromName,
    fromEmail,
    replyTo,
    unsubscribeUrl,
  } = job.data;

  console.log(
    `[email-messages] Processing delivery ${deliveryId}, attempt ${job.attemptsMade + 1}`,
  );

  try {
    const [campaign, _delivery, user] = await Promise.all([
      prisma.emailCampaign.findUniqueOrThrow({
        where: { id: emailCampaignId },
      }),
      prisma.emailDelivery.findUniqueOrThrow({ where: { id: deliveryId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);

    // Render templates with user context
    const userContext = {
      user: {
        id: user.id,
        externalId: user.externalId,
        email: user.email,
        phone: user.phone,
        firstName: user.externalId?.split("-")[0] || "usuario",
        ...((user.metadata as Record<string, unknown>) ?? {}),
      },
    };

    let renderedSubject = subject;
    let renderedBodyHtml = bodyHtml;
    let renderedBodyText = bodyText;

    try {
      renderedSubject = Handlebars.compile(subject)(userContext);
      renderedBodyHtml = Handlebars.compile(bodyHtml)(userContext);
      if (bodyText)
        renderedBodyText = Handlebars.compile(bodyText)(userContext);
    } catch (err) {
      console.error(`[email-messages] Template render failed: ${err}`);
    }

    // Resolve provider config
    const providerRecord = await prisma.channelProvider.findFirst({
      where: { tenantId: campaign.tenantId, channel: "email", isActive: true },
    });
    if (!providerRecord) throw new Error("No active email provider configured");

    const config = JSON.parse(providerRecord.configEncrypted) as {
      apiKey: string;
    };
    const emailProvider = new ResendEmailProvider(config.apiKey);

    // Send rendered email
    const result = await emailProvider.send({
      deliveryId,
      tenantId: campaign.tenantId,
      userId,
      channel: "email",
      provider: "resend",
      to: email,
      subject: renderedSubject,
      body: renderedBodyHtml,
      metadata: {
        bodyText: renderedBodyText,
        fromName: fromName ?? campaign.fromName ?? "ORKESTAI ENGAGE",
        fromEmail: fromEmail ?? campaign.fromEmail ?? "noreply@orkestai.com",
        replyTo: replyTo ?? campaign.replyTo,
        unsubscribeUrl: unsubscribeUrl ?? campaign.unsubscribeUrl,
      },
    });

    if (result.success) {
      await prisma.emailDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "sent",
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
      throw new Error(result.error ?? "Send failed");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[email-messages] Error processing ${deliveryId}: ${message}`,
    );

    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1) - 1;
    await prisma.emailDelivery
      .update({
        where: { id: deliveryId },
        data: {
          status: isLastAttempt ? "failed" : "queued",
          ...(isLastAttempt
            ? { failedAt: new Date(), errorMessage: message }
            : {}),
        },
      })
      .catch(() => {});

    throw err;
  }
}
