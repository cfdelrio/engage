import type { Job } from 'bullmq';
import { PrismaClient } from '@engage/database';
import { FirebasePushProvider } from '@engage/channels/providers/firebase-push';

interface PushNotificationJob {
  pushCampaignId: string;
  userId: string;
  deviceToken: string;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  badge?: number;
  sound?: string;
  priority?: 'high' | 'default' | 'low';
  ttl?: number;
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
    badge,
    sound,
    priority,
    ttl,
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
    const firebaseProvider = new FirebasePushProvider(config.serviceAccountJson);

    // Send notification
    const result = await firebaseProvider.send({
      deviceToken,
      title,
      body,
      imageUrl,
      actionUrl,
      badge,
      sound,
      priority: (priority as any) || 'high',
      ttl,
      data: {
        campaignId: pushCampaignId,
        userId,
      },
    });

    if (result.status === 'sent') {
      // Create PushNotification record
      const notification = await prisma.pushNotification.create({
        data: {
          pushCampaignId,
          userId,
          tenantId: campaign.tenantId,
          deviceToken,
          status: 'sent',
          firebaseMessageId: result.messageId,
        },
      });

      // Create interaction record
      await prisma.pushInteraction.create({
        data: {
          pushNotificationId: notification.id,
          tenantId: campaign.tenantId,
          type: 'sent',
          data: { messageId: result.messageId },
        },
      });

      console.log(`[push-notifications] Notification sent: ${result.messageId}`);
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
        // Try to find and mark notification as failed
        const notification = await prisma.pushNotification.findFirst({
          where: {
            pushCampaignId: job.data.pushCampaignId,
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
