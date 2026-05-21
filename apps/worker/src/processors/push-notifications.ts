import type { Job } from 'bullmq';
import { PrismaClient } from '@engage/database';
import Handlebars from 'handlebars';
import { FirebasePushProvider } from '@engage/channels';

interface PushNotificationJob {
  notificationId: string;
  pushCampaignId: string;
  userId: string;
  deviceToken: string;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  priority: string;
}

const prisma = new PrismaClient();

export async function processPushNotification(job: Job<PushNotificationJob>) {
  const {
    notificationId,
    pushCampaignId,
    userId,
    deviceToken,
    title,
    body,
    imageUrl,
    actionUrl,
    priority,
  } = job.data;

  console.log(
    `[push-notifications] Processing notification ${notificationId}, attempt ${job.attemptsMade + 1}`
  );

  try {
    // Fetch campaign, notification, and user
    const [campaign, notification, user] = await Promise.all([
      prisma.pushCampaign.findUniqueOrThrow({ where: { id: pushCampaignId } }),
      prisma.pushNotification.findUniqueOrThrow({ where: { id: notificationId } }),
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
    ]);

    // Render message body with user variables
    let renderedBody = body;
    let renderedTitle = title;
    try {
      const bodyTemplate = Handlebars.compile(body);
      const titleTemplate = Handlebars.compile(title);
      const metadata = (user.metadata as Record<string, unknown>) || {};
      renderedBody = bodyTemplate({
        user: {
          id: user.id,
          externalId: user.externalId,
          firstName: user.externalId?.split('-')[0] || 'usuario',
          email: user.email,
          phone: user.phone,
          ...metadata,
        },
      });
      renderedTitle = titleTemplate({
        user: {
          id: user.id,
          externalId: user.externalId,
          firstName: user.externalId?.split('-')[0] || 'usuario',
          email: user.email,
          phone: user.phone,
          ...metadata,
        },
      });
    } catch (err) {
      console.error(`[push-notifications] Failed to render template: ${err}`);
    }

    // Get Firebase credentials from ChannelProvider
    const provider = await prisma.channelProvider.findFirst({
      where: {
        tenantId: campaign.tenantId,
        channel: 'push',
        isActive: true,
      },
    });

    if (!provider) {
      throw new Error('No active Firebase provider configured');
    }

    // Decrypt config
    const config = JSON.parse(provider.configEncrypted);
    const pushProvider = new FirebasePushProvider(config);

    // Send notification via Firebase
    const result = await pushProvider.send({
      deliveryId: notificationId,
      tenantId: campaign.tenantId,
      userId,
      to: deviceToken,
      channel: 'push',
      provider: 'firebase_fcm',
      subject: renderedTitle,
      body: renderedBody,
      metadata: {
        imageUrl,
        actionUrl,
        priority,
      },
    });

    if (result.success) {
      // Update existing PushNotification record
      await prisma.pushNotification.update({
        where: { id: notificationId },
        data: {
          status: 'sent',
          title: renderedTitle,
          body: renderedBody,
          sentAt: new Date(),
        },
      });

      // Update campaign stats
      await prisma.$executeRaw`
        UPDATE push_campaigns
        SET stats = jsonb_set(stats, '{sent}', (COALESCE((stats->>'sent')::int, 0) + 1)::text::jsonb)
        WHERE id = ${pushCampaignId}
      `;

      console.log(`[push-notifications] Notification sent: ${notificationId}`);
    } else {
      throw new Error(`Firebase error: ${result.error}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[push-notifications] Error processing ${notificationId}: ${message}`);

    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1) - 1;
    await prisma.pushNotification.update({
      where: { id: notificationId },
      data: {
        status: isLastAttempt ? 'failed' : 'queued',
        ...(isLastAttempt ? { failedAt: new Date(), errorMessage: message } : {}),
      },
    }).catch(() => {});

    throw err;
  }
}

