import type { Job } from "bullmq";
import type { PrismaClient } from "@engage/database";
import type { ChannelProviderRegistry } from "@engage/channels";
import type { DeliveryPayload } from "@engage/core";

interface ChannelDeliveryJobPayload {
  deliveryId: string;
  tenantId: string;
  userId: string;
  eventId?: string;
  channel: string;
  providerName: string;
  payload: DeliveryPayload;
}

export function createChannelDeliveryWorker(
  db: PrismaClient,
  channelRegistry: ChannelProviderRegistry,
) {
  return async (job: Job<ChannelDeliveryJobPayload>) => {
    const { deliveryId, eventId, channel, providerName, payload } = job.data;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const registryKeys = [...(channelRegistry as any)["providers"].keys()];
    console.log(
      `[channel-delivery] job=${job.id} eventId=${eventId ?? "n/a"} channel=${channel} providerName=${providerName} registryKeys=${JSON.stringify(registryKeys)} attempt=${job.attemptsMade}`,
    );

    const provider =
      channelRegistry.resolve(
        channel as DeliveryPayload["channel"],
        providerName,
      ) ??
      channelRegistry.resolveDefault(channel as DeliveryPayload["channel"]);

    if (!provider) {
      const attempt = job.attemptsMade;
      const isLastAttempt = attempt >= (job.opts.attempts ?? 1) - 1;
      console.error(
        `[channel-delivery] No provider for channel=${channel} providerName=${providerName} attempt=${attempt}/${job.opts.attempts ?? 1} registryKeys=${JSON.stringify(registryKeys)}`,
      );
      await db.delivery.update({
        where: { id: deliveryId },
        data: {
          status: isLastAttempt ? "failed" : "queued",
          ...(isLastAttempt
            ? {
                failedAt: new Date(),
                failureReason: `No provider found for channel=${channel}`,
              }
            : {}),
        },
      });
      if (!isLastAttempt) {
        throw new Error(
          `No provider found for channel=${channel} providerName=${providerName} registryKeys=${JSON.stringify(registryKeys)}`,
        );
      }
      return;
    }

    await db.delivery.update({
      where: { id: deliveryId },
      data: { status: "sent", sentAt: new Date() },
    });

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
        status: isLastAttempt ? "failed" : "queued",
      };
      if (isLastAttempt) updateData["failedAt"] = new Date();
      if (result.error) updateData["failureReason"] = result.error;

      await db.delivery.update({
        where: { id: deliveryId },
        data: updateData,
      });

      if (!isLastAttempt) {
        throw new Error(result.error ?? "Delivery failed");
      }
    }
  };
}
