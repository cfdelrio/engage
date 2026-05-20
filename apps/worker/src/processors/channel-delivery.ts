import type { Job } from 'bullmq';
import type { PrismaClient } from '@engage/database';
import type { ChannelProviderRegistry } from '@engage/channels';
import type { DeliveryPayload } from '@engage/core';

interface ChannelDeliveryJobPayload {
  deliveryId: string;
  tenantId: string;
  userId: string;
  channel: string;
  providerName: string;
  payload: DeliveryPayload;
}

export function createChannelDeliveryWorker(
  db: PrismaClient,
  channelRegistry: ChannelProviderRegistry,
) {
  return async (job: Job<ChannelDeliveryJobPayload>) => {
    const { deliveryId, channel, providerName, payload } = job.data;

    const provider = channelRegistry.resolve(channel as DeliveryPayload['channel'], providerName)
      ?? channelRegistry.resolveDefault(channel as DeliveryPayload['channel']);

    if (!provider) {
      await db.delivery.update({
        where: { id: deliveryId },
        data: { status: 'failed', failedAt: new Date(), failureReason: 'No provider found' },
      });
      return;
    }

    await db.delivery.update({ where: { id: deliveryId }, data: { status: 'sent', sentAt: new Date() } });

    const result = await provider.send(payload);

    if (result.success) {
      if (result.providerMessageId) {
        await db.delivery.update({
          where: { id: deliveryId },
          data: { providerMessageId: result.providerMessageId },
        });
      }
    } else {
      const attempt = job.attemptsMade;
      const isLastAttempt = attempt >= (job.opts.attempts ?? 1) - 1;

      const updateData: Record<string, unknown> = {
        status: isLastAttempt ? 'failed' : 'queued',
      };
      if (isLastAttempt) updateData['failedAt'] = new Date();
      if (result.error) updateData['failureReason'] = result.error;

      await db.delivery.update({
        where: { id: deliveryId },
        data: updateData,
      });

      if (!isLastAttempt) {
        throw new Error(result.error ?? 'Delivery failed');
      }
    }
  };
}
