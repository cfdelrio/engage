import type { Job } from "bullmq";
import { prisma } from "@engage/database";
import Handlebars from "handlebars";
import { TwilioSMSProvider } from "@engage/channels";

interface SmsMessageJob {
  deliveryId: string;
  smsCampaignId: string;
  userId: string;
  phone: string;
  body: string;
  fromNumber?: string;
}

function parseProviderConfig(encrypted: string): Record<string, unknown> {
  try {
    return JSON.parse(encrypted) as Record<string, unknown>;
  } catch (err) {
    throw new Error(
      `Failed to parse provider config: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

export async function processSmsMessage(job: Job<SmsMessageJob>) {
  const { deliveryId, smsCampaignId, userId, phone, body, fromNumber } =
    job.data;

  console.log(
    `[sms-messages] Processing delivery ${deliveryId}, attempt ${job.attemptsMade + 1}`,
  );

  try {
    const [campaign, _delivery, user] = await Promise.all([
      prisma.smsCampaign.findUniqueOrThrow({ where: { id: smsCampaignId } }),
      prisma.smsDelivery.findUniqueOrThrow({ where: { id: deliveryId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);

    // Render body with user context
    let renderedBody = body;
    try {
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
      renderedBody = Handlebars.compile(body)(userContext);
    } catch (err) {
      console.error(`[sms-messages] Template render failed: ${err}`);
    }

    // Resolve provider config
    const providerRecord = await prisma.channelProvider.findFirst({
      where: { tenantId: campaign.tenantId, channel: "sms", isActive: true },
    });
    if (!providerRecord) throw new Error("No active SMS provider configured");

    const config = parseProviderConfig(providerRecord.configEncrypted);
    if (!config.accountSid || !config.authToken || !config.fromNumber) {
      throw new Error(
        "Provider config missing required fields (accountSid, authToken, fromNumber)",
      );
    }

    const smsProvider = new TwilioSMSProvider(
      String(config.accountSid),
      String(config.authToken),
      fromNumber ?? campaign.fromNumber ?? String(config.fromNumber),
    );

    // Send
    const result = await smsProvider.send({
      deliveryId,
      tenantId: campaign.tenantId,
      userId,
      channel: "sms",
      provider: "twilio",
      to: phone,
      body: renderedBody,
      metadata: {},
    });

    if (result.success) {
      await prisma.smsDelivery.update({
        where: { id: deliveryId },
        data: {
          status: "sent",
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
      throw new Error(result.error ?? "Send failed");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sms-messages] Error processing ${deliveryId}: ${message}`);

    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1) - 1;
    await prisma.smsDelivery
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
