import type { Job } from 'bullmq';
import { PrismaClient } from '@engage/database';
import Handlebars from 'handlebars';
import { FirebasePushProvider } from '@engage/channels';

interface PushNotificationJob {
  pushCampaignId: string;
  userId: string;
  deviceToken: string;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  priority: string;
  attempt: number;
}

const prisma = new PrismaClient();

export async function processPushNotification(job: Job<PushNotificationJob>) {
  const {
    pushCampaignId,
    userId,
    deviceToken,
    title,
    body,
    imageUrl,
    actionUrl,
    priority,
    attempt,
  } = job.data;

  console.log(
    `[push-notifications] Processing notification ${pushCampaignId}:${userId}, attempt ${attempt + 1}`
  );

  try {
    // Fetch campaign and user
    const [campaign, user] = await Promise.all([
      prisma.pushCampaign.findUniqueOrThrow({ where: { id: pushCampaignId } }),
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
          firstName: user.externalId?.split('-')[0] || 'usuario',
          email: user.email,
          phone: user.phone,
          ...metadata,
        },
      });
      renderedTitle = titleTemplate({
        user: {
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
      deliveryId: `push-${campaign.tenantId}-${userId}`,
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
      // Create PushNotification record
      const notification = await prisma.pushNotification.create({
        data: {
          campaignId: pushCampaignId,
          tenantId: campaign.tenantId,
          userId,
          status: 'sent',
          title: renderedTitle,
          body: renderedBody,
          imageUrl,
          actionUrl,
          priority,
          sentAt: new Date(),
        },
      });

      console.log(`[push-notifications] Notification sent: ${notification.id}`);
    } else {
      throw new Error(`Firebase error: ${result.error}`);
    }
  } catch (err) {
    console.error(`[push-notifications] Error processing notification: ${err}`);

    if (attempt < 3) {
      const delayMs = attempt === 0 ? 60000 : attempt === 1 ? 300000 : 1800000; // 1m, 5m, 30m
      throw new Error(`Retryable error: ${err}. Retry in ${delayMs / 1000}s`);
    } else {
      // Max retries exceeded
      try {
        const notification = await prisma.pushNotification.findFirst({
          where: {
            campaignId: job.data.pushCampaignId,
            userId: job.data.userId,
          },
        });

        if (notification) {
          await prisma.pushNotification.update({
            where: { id: notification.id },
            data: {
              status: 'failed',
              failedAt: new Date(),
              errorMessage: String(err),
            },
          });
        }
      } catch (updateErr) {
        console.error(`[push-notifications] Failed to mark as failed: ${updateErr}`);
      }
    }
  }
}

