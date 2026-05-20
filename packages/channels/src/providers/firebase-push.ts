import admin from 'firebase-admin';
import { logger } from '@engage/core/utils';

export interface FirebasePushPayload {
  deviceToken: string;
  title: string;
  body: string;
  imageUrl?: string;
  actionUrl?: string;
  badge?: number;
  sound?: string;
  priority?: 'high' | 'default' | 'low';
  ttl?: number;
  data?: Record<string, string>;
}

export interface FirebasePushResult {
  messageId: string;
  status: 'sent' | 'failed';
  error?: string;
}

export class FirebasePushProvider {
  private app: admin.app.App;

  constructor(serviceAccountJson: string) {
    try {
      const serviceAccount = JSON.parse(serviceAccountJson);
      this.app = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    } catch (err) {
      logger.error(`[firebase-push] Failed to initialize: ${err}`);
      throw err;
    }
  }

  async send(payload: FirebasePushPayload): Promise<FirebasePushResult> {
    try {
      const message: admin.messaging.Message = {
        token: payload.deviceToken,
        notification: {
          title: payload.title,
          body: payload.body,
          imageUrl: payload.imageUrl,
        },
        webpush: {
          fcmOptions: {
            link: payload.actionUrl || undefined,
          },
          notification: {
            title: payload.title,
            body: payload.body,
            icon: payload.imageUrl,
            badge: payload.badge?.toString(),
          },
          data: payload.data,
        },
        android: {
          notification: {
            title: payload.title,
            body: payload.body,
            clickAction: payload.actionUrl,
            sound: payload.sound || 'default',
          },
          priority: this.mapPriority(payload.priority),
          ttl: payload.ttl ? payload.ttl * 1000 : undefined,
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body,
              },
              sound: payload.sound || 'default',
              badge: payload.badge,
              'mutable-content': 1,
              'custom-key': payload.data,
            },
          },
        },
        data: payload.data,
      };

      const messageId = await this.app.messaging().send(message);

      logger.info(`[firebase-push] Sent message ${messageId} to ${payload.deviceToken}`);

      return {
        messageId,
        status: 'sent',
      };
    } catch (err) {
      logger.error(`[firebase-push] Failed to send: ${err}`);

      return {
        messageId: '',
        status: 'failed',
        error: String(err),
      };
    }
  }

  async sendMulticast(
    deviceTokens: string[],
    title: string,
    body: string,
    options?: Partial<FirebasePushPayload>
  ): Promise<{ successCount: number; failureCount: number }> {
    try {
      const message: admin.messaging.MulticastMessage = {
        tokens: deviceTokens,
        notification: {
          title,
          body,
          imageUrl: options?.imageUrl,
        },
        android: {
          notification: {
            title,
            body,
            sound: options?.sound || 'default',
          },
          priority: this.mapPriority(options?.priority),
        },
        data: options?.data,
      };

      const response = await this.app.messaging().sendMulticast(message);

      logger.info(
        `[firebase-push] Sent multicast: ${response.successCount} success, ${response.failureCount} failed`
      );

      return {
        successCount: response.successCount,
        failureCount: response.failureCount,
      };
    } catch (err) {
      logger.error(`[firebase-push] Multicast failed: ${err}`);
      return { successCount: 0, failureCount: deviceTokens.length };
    }
  }

  async validateConfig(config: Record<string, any>): Promise<boolean> {
    try {
      if (!config.serviceAccountJson) {
        logger.error('[firebase-push] Missing serviceAccountJson in config');
        return false;
      }

      JSON.parse(config.serviceAccountJson);
      return true;
    } catch (err) {
      logger.error(`[firebase-push] Invalid config: ${err}`);
      return false;
    }
  }

  parseWebhook(
    body: Record<string, any>,
    headers: Record<string, any>
  ): Array<{ type: string; messageId: string; status: string; timestamp: Date }> {
    // Firebase uses different webhook structures for different events
    // Topic subscriptions and direct device token messages have different formats
    const events: Array<{ type: string; messageId: string; status: string; timestamp: Date }> = [];

    // Firebase doesn't have direct delivery webhooks like Twilio/Resend
    // Status tracking is typically handled via:
    // 1. Client SDK reporting delivery/open
    // 2. Analytics events
    // 3. Custom webhook implementation by client

    // Placeholder for custom webhook implementation
    if (body.messageId && body.deliveryStatus) {
      events.push({
        type: body.deliveryStatus, // 'delivered', 'opened', etc.
        messageId: body.messageId,
        status: body.deliveryStatus,
        timestamp: new Date(),
      });
    }

    return events;
  }

  private mapPriority(priority?: string): 'high' | 'normal' {
    return priority === 'high' ? 'high' : 'normal';
  }
}
