import { PrismaClient } from "@engage/database";
import { RulesEngine } from "@engage/rules-engine";
import {
  AIProviderRegistry,
  AIOrchestrationLayer,
  AnthropicProvider,
  OpenAIProvider,
  MockAIProvider,
} from "@engage/ai";
import {
  ChannelProviderRegistry,
  ResendEmailProvider,
  TwilioSMSProvider,
  InfobipSMSProvider,
  FirebasePushProvider,
  TwilioVoiceProvider,
  TwilioWhatsAppChannelProvider,
} from "@engage/channels";
import { createWorker, QUEUES, getRedis } from "@engage/event-bus";
import { logger } from "./logger.js";
import { createEventProcessor } from "./processors/event-processor.js";
import { createDeliveryScheduler } from "./processors/delivery-scheduler.js";
import { createChannelDeliveryWorker } from "./processors/channel-delivery.js";
import { processEmailMessage } from "./processors/email-messages.js";
import { processSmsMessage } from "./processors/sms-messages.js";
import { processVoiceCall } from "./processors/voice-calls.js";
import { processWhatsAppMessage } from "./processors/whatsapp-messages.js";
import type { AIProviderName } from "@engage/core";

async function main() {
  if (!process.env["INTERNAL_API_URL"]) {
    throw new Error(
      "INTERNAL_API_URL environment variable is required (used for Twilio callbacks and service-to-service communication)",
    );
  }

  const db = new PrismaClient();
  const redis = getRedis();

  await db.$connect();
  logger.info("Database connected");

  // ─── AI Provider Registry ─────────────────────────────────────────────────
  const aiProviders = new Map();

  if (process.env["ANTHROPIC_API_KEY"]) {
    aiProviders.set(
      "anthropic",
      new AnthropicProvider(process.env["ANTHROPIC_API_KEY"]),
    );
  }
  if (process.env["OPENAI_API_KEY"]) {
    aiProviders.set(
      "openai",
      new OpenAIProvider(process.env["OPENAI_API_KEY"]),
    );
  }
  aiProviders.set("mock", new MockAIProvider());

  const defaultProvider: AIProviderName =
    (process.env["AI_DEFAULT_PROVIDER"] as AIProviderName | undefined) ??
    (process.env["ANTHROPIC_API_KEY"]
      ? "anthropic"
      : process.env["OPENAI_API_KEY"]
        ? "openai"
        : "mock");

  const aiRegistry = new AIProviderRegistry({
    defaultProvider,
    providers: aiProviders,
  });

  const aiLayer = new AIOrchestrationLayer(aiRegistry);
  const rulesEngine = new RulesEngine();

  // ─── Channel Provider Registry ────────────────────────────────────────────
  const channelRegistry = new ChannelProviderRegistry();

  if (
    process.env["INFOBIP_API_KEY"] &&
    process.env["INFOBIP_BASE_URL"] &&
    process.env["INFOBIP_SMS_FROM"]
  ) {
    channelRegistry.register(
      new InfobipSMSProvider(
        process.env["INFOBIP_API_KEY"],
        process.env["INFOBIP_BASE_URL"],
        process.env["INFOBIP_SMS_FROM"],
      ),
    );
  }

  if (process.env["RESEND_API_KEY"]) {
    channelRegistry.register(
      new ResendEmailProvider(
        process.env["RESEND_API_KEY"],
        process.env["RESEND_FROM_EMAIL"],
      ),
    );
  }
  if (
    process.env["TWILIO_ACCOUNT_SID"] &&
    process.env["TWILIO_AUTH_TOKEN"] &&
    process.env["TWILIO_FROM_NUMBER"]
  ) {
    channelRegistry.register(
      new TwilioSMSProvider(
        process.env["TWILIO_ACCOUNT_SID"],
        process.env["TWILIO_AUTH_TOKEN"],
        process.env["TWILIO_FROM_NUMBER"],
      ),
    );
    channelRegistry.register(
      new TwilioVoiceProvider(
        process.env["TWILIO_ACCOUNT_SID"],
        process.env["TWILIO_AUTH_TOKEN"],
        process.env["TWILIO_FROM_NUMBER"],
      ),
    );
    const waFromNumber =
      process.env["TWILIO_WHATSAPP_FROM_NUMBER"] ??
      process.env["TWILIO_FROM_NUMBER"];
    channelRegistry.register(
      new TwilioWhatsAppChannelProvider(
        process.env["TWILIO_ACCOUNT_SID"],
        process.env["TWILIO_AUTH_TOKEN"],
        waFromNumber,
      ),
    );
  }
  if (
    process.env["FIREBASE_PROJECT_ID"] &&
    process.env["FIREBASE_CLIENT_EMAIL"] &&
    process.env["FIREBASE_PRIVATE_KEY"]
  ) {
    channelRegistry.register(
      new FirebasePushProvider({
        projectId: process.env["FIREBASE_PROJECT_ID"],
        clientEmail: process.env["FIREBASE_CLIENT_EMAIL"],
        privateKey: process.env["FIREBASE_PRIVATE_KEY"],
      }),
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registeredProviders = [...(channelRegistry as any)["providers"].keys()];
  if (registeredProviders.length === 0) {
    logger.warn(
      "No channel providers registered. Check RESEND_API_KEY / TWILIO_* env vars. Deliveries will fail until providers are available.",
    );
  } else {
    logger.info("Channel providers registered", {
      providers: registeredProviders,
    });
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
    QUEUES.DELIVERIES_EMAIL,
    QUEUES.DELIVERIES_SMS,
    QUEUES.DELIVERIES_PUSH,
    QUEUES.DELIVERIES_WHATSAPP,
    QUEUES.DELIVERIES_VOICE,
  ] as const;

  const channelWorkers = channelWorkerNames.map((queueName) =>
    createWorker(
      queueName,
      createChannelDeliveryWorker(db, channelRegistry),
      5,
    ),
  );

  // Dedicated workers for email and SMS campaigns (separate queues from transactional deliveries)
  const emailCampaignWorker = createWorker(
    QUEUES.EMAIL_CAMPAIGN_DELIVERY,
    processEmailMessage,
    5,
  );
  const smsCampaignWorker = createWorker(
    QUEUES.SMS_CAMPAIGN_DELIVERY,
    processSmsMessage,
    5,
  );
  const voiceCallWorker = createWorker("voice.calls", processVoiceCall, 3);
  const whatsappMessageWorker = createWorker(
    "whatsapp.messages",
    processWhatsAppMessage,
    5,
  );

  const allWorkers = [
    eventWorker,
    deliverySchedulerWorker,
    ...channelWorkers,
    emailCampaignWorker,
    smsCampaignWorker,
    voiceCallWorker,
    whatsappMessageWorker,
  ];

  for (const worker of allWorkers) {
    worker.on("failed", (job, err) => {
      logger.error("Job failed", { jobId: job?.id, error: err.message });
    });
    worker.on("completed", (job) => {
      logger.info("Job completed", { jobId: job.id });
    });
  }

  logger.info("Workers started", { count: allWorkers.length });
  logger.info("AI provider", { provider: defaultProvider });

  const shutdown = async (signal: string) => {
    logger.info("Shutting down", { signal });
    await Promise.all(allWorkers.map((w) => w.close()));
    await redis.quit();
    await db.$disconnect();
    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  logger.error("Fatal error", {
    error: err instanceof Error ? err.message : String(err),
  });
  process.exit(1);
});
