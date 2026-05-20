import { PrismaClient } from '@engage/database';
import { RulesEngine } from '@engage/rules-engine';
import {
  AIProviderRegistry,
  AIOrchestrationLayer,
  AnthropicProvider,
  OpenAIProvider,
  MockAIProvider,
} from '@engage/ai';
import {
  ChannelProviderRegistry,
  ResendEmailProvider,
  TwilioSMSProvider,
  FirebasePushProvider,
  TwilioVoiceProvider,
} from '@engage/channels';
import { createWorker, QUEUES, getRedis } from '@engage/event-bus';
import { createEventProcessor } from './processors/event-processor.js';
import { createDeliveryScheduler } from './processors/delivery-scheduler.js';
import { createChannelDeliveryWorker } from './processors/channel-delivery.js';
import { processEmailMessage } from './processors/email-messages.js';
import { processSmsMessage } from './processors/sms-messages.js';
import type { AIProviderName } from '@engage/core';

async function main() {
  const db = new PrismaClient();
  const redis = getRedis();

  await db.$connect();
  console.log('[worker] Database connected');

  // ─── AI Provider Registry ─────────────────────────────────────────────────
  const aiProviders = new Map();

  if (process.env['ANTHROPIC_API_KEY']) {
    aiProviders.set('anthropic', new AnthropicProvider(process.env['ANTHROPIC_API_KEY']));
  }
  if (process.env['OPENAI_API_KEY']) {
    aiProviders.set('openai', new OpenAIProvider(process.env['OPENAI_API_KEY']));
  }
  aiProviders.set('mock', new MockAIProvider());

  const defaultProvider: AIProviderName = (process.env['AI_DEFAULT_PROVIDER'] as AIProviderName | undefined)
    ?? (process.env['ANTHROPIC_API_KEY'] ? 'anthropic' : process.env['OPENAI_API_KEY'] ? 'openai' : 'mock');

  const aiRegistry = new AIProviderRegistry({
    defaultProvider,
    providers: aiProviders,
  });

  const aiLayer = new AIOrchestrationLayer(aiRegistry);
  const rulesEngine = new RulesEngine();

  // ─── Channel Provider Registry ────────────────────────────────────────────
  const channelRegistry = new ChannelProviderRegistry();

  if (process.env['RESEND_API_KEY']) {
    channelRegistry.register(new ResendEmailProvider(process.env['RESEND_API_KEY']));
  }
  if (process.env['TWILIO_ACCOUNT_SID'] && process.env['TWILIO_AUTH_TOKEN'] && process.env['TWILIO_FROM_NUMBER']) {
    channelRegistry.register(new TwilioSMSProvider(
      process.env['TWILIO_ACCOUNT_SID'],
      process.env['TWILIO_AUTH_TOKEN'],
      process.env['TWILIO_FROM_NUMBER'],
    ));
    channelRegistry.register(new TwilioVoiceProvider(
      process.env['TWILIO_ACCOUNT_SID'],
      process.env['TWILIO_AUTH_TOKEN'],
      process.env['TWILIO_FROM_NUMBER'],
    ));
  }
  if (
    process.env['FIREBASE_PROJECT_ID'] &&
    process.env['FIREBASE_CLIENT_EMAIL'] &&
    process.env['FIREBASE_PRIVATE_KEY']
  ) {
    channelRegistry.register(new FirebasePushProvider({
      projectId: process.env['FIREBASE_PROJECT_ID'],
      clientEmail: process.env['FIREBASE_CLIENT_EMAIL'],
      privateKey: process.env['FIREBASE_PRIVATE_KEY'],
    }));
  }

  // ─── Workers ──────────────────────────────────────────────────────────────
  const eventWorker = createWorker(
    QUEUES.EVENTS_INCOMING,
    createEventProcessor(db, redis, rulesEngine, aiLayer),
    10,
  );

  const deliverySchedulerWorker = createWorker(
    QUEUES.DELIVERIES_SCHEDULED,
    createDeliveryScheduler(db, redis),
    10,
  );

  const channelWorkerNames = [
    QUEUES.DELIVERIES_PUSH,
    QUEUES.DELIVERIES_WHATSAPP,
    QUEUES.DELIVERIES_VOICE,
  ] as const;

  const channelWorkers = channelWorkerNames.map((queueName) =>
    createWorker(queueName, createChannelDeliveryWorker(db, channelRegistry), 5),
  );

  // Dedicated workers for email and SMS campaigns
  const emailCampaignWorker = createWorker(QUEUES.DELIVERIES_EMAIL, processEmailMessage, 5);
  const smsCampaignWorker = createWorker(QUEUES.DELIVERIES_SMS, processSmsMessage, 5);

  const allWorkers = [eventWorker, deliverySchedulerWorker, ...channelWorkers, emailCampaignWorker, smsCampaignWorker];

  for (const worker of allWorkers) {
    worker.on('failed', (job, err) => {
      console.error(`[worker] Job ${job?.id} failed:`, err.message);
    });
    worker.on('completed', (job) => {
      console.log(`[worker] Job ${job.id} completed`);
    });
  }

  console.log(`[worker] Started ${allWorkers.length} workers`);
  console.log(`[worker] AI provider: ${defaultProvider}`);
  console.log(`[worker] Channel providers: ${[...channelRegistry['providers'].keys()].join(', ')}`);

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} received, shutting down...`);
    await Promise.all(allWorkers.map((w) => w.close()));
    await redis.quit();
    await db.$disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[worker] Fatal error:', err);
  process.exit(1);
});
