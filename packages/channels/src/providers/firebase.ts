import admin from 'firebase-admin';
import type { ChannelProvider } from '../provider.interface.js';
import type { DeliveryPayload, ProviderResult, DeliveryEvent } from '@engage/core';

export class FirebasePushProvider implements ChannelProvider {
  readonly channel = 'push' as const;
  readonly providerName = 'firebase_fcm';
  private app: admin.app.App;

  constructor(config: {
    projectId: string;
    clientEmail: string;
    privateKey: string;
    appName?: string;
  }) {
    const appName = config.appName ?? 'engage-default';
    const existing = admin.apps.find((a) => a?.name === appName);
    this.app = existing ?? admin.initializeApp(
      {
        credential: admin.credential.cert({
          projectId: config.projectId,
          clientEmail: config.clientEmail,
          privateKey: config.privateKey.replace(/\\n/g, '\n'),
        }),
      },
      appName,
    );
  }

  async send(payload: DeliveryPayload): Promise<ProviderResult> {
    try {
      const messaging = this.app.messaging();
      const notification: admin.messaging.Notification = { body: payload.body };
      if (payload.subject) notification.title = payload.subject;
      const messageId = await messaging.send({
        token: payload.to,
        notification,
        data: {
          deliveryId: payload.deliveryId,
          tenantId: payload.tenantId,
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } },
      });
      return { success: true, providerMessageId: messageId };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }

  async validateConfig(_config: Record<string, unknown>): Promise<boolean> {
    return true;
  }

  parseWebhook(_body: unknown, _headers: Record<string, string>): DeliveryEvent[] {
    // FCM doesn't send delivery webhooks — track via client SDK
    return [];
  }
}
