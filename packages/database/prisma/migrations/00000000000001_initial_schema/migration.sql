-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "brandingConfig" JSONB NOT NULL DEFAULT '{}',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "plan" TEXT NOT NULL DEFAULT 'starter',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_api_keys" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "tenant_api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "deviceTokens" JSONB NOT NULL DEFAULT '[]',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "tags" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "preference_tokens" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenPrefix" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revokedAt" TIMESTAMP(3),

    CONSTRAINT "preference_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'all',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_engagement_scores" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatigueScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "openRate30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clickRate30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_engagement_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "platform" TEXT,
    "appVersion" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_definitions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "schema" JSONB NOT NULL DEFAULT '{}',
    "version" INTEGER NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sourceIp" TEXT,
    "idempotencyKey" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "replayedFrom" TEXT,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_processing_logs" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "details" JSONB NOT NULL DEFAULT '{}',
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_processing_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rules" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "conditions" JSONB NOT NULL,
    "actions" JSONB NOT NULL,
    "cooldownSeconds" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rule_executions" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "matched" BOOLEAN NOT NULL,
    "reasoning" JSONB NOT NULL DEFAULT '{}',
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rule_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "bodyHtml" TEXT,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "aiInstructions" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_versions" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,

    CONSTRAINT "template_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'triggered',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "trigger" JSONB NOT NULL DEFAULT '{}',
    "rules" JSONB NOT NULL DEFAULT '{}',
    "channels" TEXT[],
    "templateId" TEXT,
    "aiConfig" JSONB NOT NULL DEFAULT '{}',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "campaign_runs" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "stats" JSONB NOT NULL DEFAULT '{}',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "campaign_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_decisions" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "decisionType" TEXT NOT NULL,
    "reasoning" JSONB NOT NULL DEFAULT '{}',
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "engagement_decisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliveries" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "engagementDecisionId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "providerMessageId" TEXT,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "delivery_events" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" JSONB NOT NULL DEFAULT '{}',
    "rawWebhook" JSONB,

    CONSTRAINT "delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "channel_providers" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "configEncrypted" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "channel_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_unsubscribes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "global_unsubscribes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frequency_caps" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "windowSeconds" INTEGER NOT NULL,
    "maxCount" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "windowStart" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resetAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "frequency_caps_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public_feeds" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'activity',
    "config" JSONB NOT NULL DEFAULT '{}',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "embedToken" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "public_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_entries" (
    "id" TEXT NOT NULL,
    "feedId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "reactions" JSONB NOT NULL DEFAULT '{}',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "polls" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "feedId" TEXT,
    "question" TEXT NOT NULL,
    "options" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "endAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "polls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "poll_votes" (
    "id" TEXT NOT NULL,
    "pollId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "optionIndex" INTEGER NOT NULL,
    "votedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "poll_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "engagement_metrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "channel" TEXT NOT NULL,
    "eventType" TEXT,
    "campaignId" TEXT,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "converted" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "unsubscribed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "engagement_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_decision_metrics" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "decisions" INTEGER NOT NULL DEFAULT 0,
    "accepted" INTEGER NOT NULL DEFAULT 0,
    "overridden" INTEGER NOT NULL DEFAULT 0,
    "avgConfidence" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "ai_decision_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "voiceConfig" JSONB NOT NULL DEFAULT '{}',
    "script" TEXT NOT NULL,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiInstructions" TEXT,
    "recordingUrl" TEXT,
    "audienceFilter" JSONB NOT NULL DEFAULT '{}',
    "dtmfConfig" JSONB,
    "callbackWorkflow" JSONB,
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "scheduledFor" TIMESTAMP(3),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "stats" JSONB NOT NULL DEFAULT '{"sent": 0, "answered": 0, "completed": 0, "failed": 0, "avgDuration": 0}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_calls" (
    "id" TEXT NOT NULL,
    "voiceCampaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "twilioCallSid" TEXT,
    "externalId" TEXT,
    "startedAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "recordingUrl" TEXT,
    "recordingDuration" INTEGER,
    "sentiment" TEXT,
    "transcription" TEXT,
    "dtmfResponse" TEXT,
    "dtmfAction" TEXT,
    "terminationReason" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "callbackScheduled" TIMESTAMP(3),
    "callbackReason" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_interactions" (
    "id" TEXT NOT NULL,
    "voiceCallId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "voice_metrics" (
    "id" TEXT NOT NULL,
    "voiceCampaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "calls_sent" INTEGER NOT NULL DEFAULT 0,
    "calls_answered" INTEGER NOT NULL DEFAULT 0,
    "calls_completed" INTEGER NOT NULL DEFAULT 0,
    "calls_failed" INTEGER NOT NULL DEFAULT 0,
    "avg_duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dtmf_interactions" INTEGER NOT NULL DEFAULT 0,
    "positive_sentiment" INTEGER NOT NULL DEFAULT 0,
    "negative_sentiment" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "voice_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "body" TEXT NOT NULL,
    "headerType" TEXT,
    "headerValue" TEXT,
    "footerText" TEXT,
    "buttons" JSONB,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiInstructions" TEXT,
    "audienceFilter" JSONB NOT NULL DEFAULT '{}',
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "scheduledFor" TIMESTAMP(3),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "stats" JSONB NOT NULL DEFAULT '{"sent": 0, "delivered": 0, "read": 0, "failed": 0}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_messages" (
    "id" TEXT NOT NULL,
    "whatsappCampaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "twilioMessageSid" TEXT,
    "headerType" TEXT,
    "headerValue" TEXT,
    "footerText" TEXT,
    "buttons" JSONB,
    "body" TEXT NOT NULL,
    "errorMessage" TEXT,
    "failedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_interactions" (
    "id" TEXT NOT NULL,
    "whatsappMessageId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "whatsapp_interactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_metrics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "read" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "whatsapp_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "actionUrl" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'high',
    "audienceFilter" JSONB NOT NULL DEFAULT '{}',
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "scheduledFor" TIMESTAMP(3),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "stats" JSONB NOT NULL DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "failed": 0}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_notifications" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "actionUrl" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'high',
    "errorMessage" TEXT,
    "failedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "push_metrics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "push_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "subject" TEXT NOT NULL,
    "bodyHtml" TEXT NOT NULL,
    "bodyText" TEXT,
    "fromName" TEXT,
    "fromEmail" TEXT,
    "replyTo" TEXT,
    "unsubscribeUrl" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiInstructions" TEXT,
    "audienceFilter" JSONB NOT NULL DEFAULT '{}',
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "scheduledFor" TIMESTAMP(3),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "stats" JSONB NOT NULL DEFAULT '{"sent": 0, "delivered": 0, "opened": 0, "clicked": 0, "bounced": 0, "failed": 0}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_deliveries" (
    "id" TEXT NOT NULL,
    "emailCampaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "resendMessageId" TEXT,
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "bouncedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "email_metrics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "opened" INTEGER NOT NULL DEFAULT 0,
    "clicked" INTEGER NOT NULL DEFAULT 0,
    "bounced" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "email_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_campaigns" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "triggerType" TEXT NOT NULL DEFAULT 'manual',
    "body" TEXT NOT NULL,
    "fromNumber" TEXT,
    "aiGenerated" BOOLEAN NOT NULL DEFAULT false,
    "aiInstructions" TEXT,
    "audienceFilter" JSONB NOT NULL DEFAULT '{}',
    "maxRetries" INTEGER NOT NULL DEFAULT 2,
    "scheduledFor" TIMESTAMP(3),
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "stats" JSONB NOT NULL DEFAULT '{"sent": 0, "delivered": 0, "failed": 0}',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_deliveries" (
    "id" TEXT NOT NULL,
    "smsCampaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "twilioMessageSid" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sms_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sms_metrics" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "delivered" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "sms_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resourceId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "tenant_api_keys_keyHash_key" ON "tenant_api_keys"("keyHash");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "users_tenantId_externalId_key" ON "users"("tenantId", "externalId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "preference_tokens_tokenHash_key" ON "preference_tokens"("tokenHash");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "preference_tokens_userId_tenantId_tokenHash_key" ON "preference_tokens"("userId", "tenantId", "tokenHash");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "user_preferences_userId_tenantId_channel_category_key" ON "user_preferences"("userId", "tenantId", "channel", "category");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "user_engagement_scores_userId_key" ON "user_engagement_scores"("userId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "event_definitions_tenantId_type_version_key" ON "event_definitions"("tenantId", "type", "version");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "template_versions_templateId_version_key" ON "template_versions"("templateId", "version");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "channel_providers_tenantId_channel_provider_key" ON "channel_providers"("tenantId", "channel", "provider");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "global_unsubscribes_userId_tenantId_channel_key" ON "global_unsubscribes"("userId", "tenantId", "channel");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "frequency_caps_tenantId_userId_channel_windowSeconds_key" ON "frequency_caps"("tenantId", "userId", "channel", "windowSeconds");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "public_feeds_embedToken_key" ON "public_feeds"("embedToken");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "public_feeds_tenantId_slug_key" ON "public_feeds"("tenantId", "slug");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "poll_votes_pollId_userId_key" ON "poll_votes"("pollId", "userId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "engagement_metrics_tenantId_date_channel_eventType_campaignId_key" ON "engagement_metrics"("tenantId", "date", "channel", "eventType", "campaignId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "ai_decision_metrics_tenantId_date_provider_model_key" ON "ai_decision_metrics"("tenantId", "date", "provider", "model");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "voice_calls_twilioCallSid_key" ON "voice_calls"("twilioCallSid");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "voice_metrics_voiceCampaignId_date_key" ON "voice_metrics"("voiceCampaignId", "date");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "whatsapp_messages_twilioMessageSid_key" ON "whatsapp_messages"("twilioMessageSid");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "whatsapp_metrics_campaignId_date_key" ON "whatsapp_metrics"("campaignId", "date");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "push_metrics_campaignId_date_key" ON "push_metrics"("campaignId", "date");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "email_deliveries_resendMessageId_key" ON "email_deliveries"("resendMessageId");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "email_metrics_campaignId_date_key" ON "email_metrics"("campaignId", "date");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "sms_deliveries_twilioMessageSid_key" ON "sms_deliveries"("twilioMessageSid");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "sms_metrics_campaignId_date_key" ON "sms_metrics"("campaignId", "date");

-- CreateIndex
CREATE INDEX "tenant_api_keys_tenantId_idx" ON "tenant_api_keys"("tenantId");

-- CreateIndex
CREATE INDEX "tenant_api_keys_tenantId_status_idx" ON "tenant_api_keys"("tenantId", "status");

-- CreateIndex
CREATE INDEX "users_tenantId_idx" ON "users"("tenantId");

-- CreateIndex
CREATE INDEX "users_tenantId_email_idx" ON "users"("tenantId", "email");

-- CreateIndex
CREATE INDEX "preference_tokens_tenantId_userId_idx" ON "preference_tokens"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "user_preferences_userId_tenantId_idx" ON "user_preferences"("userId", "tenantId");

-- CreateIndex
CREATE INDEX "user_engagement_scores_tenantId_fatigueScore_idx" ON "user_engagement_scores"("tenantId", "fatigueScore");

-- CreateIndex
CREATE INDEX "user_sessions_userId_lastSeenAt_idx" ON "user_sessions"("userId", "lastSeenAt");

-- CreateIndex
CREATE INDEX "event_definitions_tenantId_idx" ON "event_definitions"("tenantId");

-- CreateIndex
CREATE INDEX "events_tenantId_type_receivedAt_idx" ON "events"("tenantId", "type", "receivedAt");

-- CreateIndex
CREATE INDEX "events_tenantId_userId_receivedAt_idx" ON "events"("tenantId", "userId", "receivedAt");

-- CreateIndex
CREATE INDEX "events_idempotencyKey_idx" ON "events"("idempotencyKey");

-- CreateIndex
CREATE INDEX "event_processing_logs_eventId_idx" ON "event_processing_logs"("eventId");

-- CreateIndex
CREATE INDEX "rules_tenantId_enabled_priority_idx" ON "rules"("tenantId", "enabled", "priority");

-- CreateIndex
CREATE INDEX "rule_executions_ruleId_executedAt_idx" ON "rule_executions"("ruleId", "executedAt");

-- CreateIndex
CREATE INDEX "rule_executions_eventId_idx" ON "rule_executions"("eventId");

-- CreateIndex
CREATE INDEX "templates_tenantId_channel_idx" ON "templates"("tenantId", "channel");

-- CreateIndex
CREATE INDEX "campaigns_tenantId_status_idx" ON "campaigns"("tenantId", "status");

-- CreateIndex
CREATE INDEX "campaign_runs_campaignId_idx" ON "campaign_runs"("campaignId");

-- CreateIndex
CREATE INDEX "engagement_decisions_tenantId_scheduledFor_idx" ON "engagement_decisions"("tenantId", "scheduledFor");

-- CreateIndex
CREATE INDEX "engagement_decisions_userId_createdAt_idx" ON "engagement_decisions"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "deliveries_tenantId_channel_status_idx" ON "deliveries"("tenantId", "channel", "status");

-- CreateIndex
CREATE INDEX "deliveries_tenantId_userId_createdAt_idx" ON "deliveries"("tenantId", "userId", "createdAt");

-- CreateIndex
CREATE INDEX "deliveries_providerMessageId_idx" ON "deliveries"("providerMessageId");

-- CreateIndex
CREATE INDEX "delivery_events_deliveryId_idx" ON "delivery_events"("deliveryId");

-- CreateIndex
CREATE INDEX "channel_providers_tenantId_channel_isActive_idx" ON "channel_providers"("tenantId", "channel", "isActive");

-- CreateIndex
CREATE INDEX "global_unsubscribes_tenantId_channel_idx" ON "global_unsubscribes"("tenantId", "channel");

-- CreateIndex
CREATE INDEX "frequency_caps_tenantId_userId_channel_idx" ON "frequency_caps"("tenantId", "userId", "channel");

-- CreateIndex
CREATE INDEX "feed_entries_feedId_createdAt_idx" ON "feed_entries"("feedId", "createdAt");

-- CreateIndex
CREATE INDEX "polls_tenantId_idx" ON "polls"("tenantId");

-- CreateIndex
CREATE INDEX "engagement_metrics_tenantId_date_idx" ON "engagement_metrics"("tenantId", "date");

-- CreateIndex
CREATE INDEX "ai_decision_metrics_tenantId_date_idx" ON "ai_decision_metrics"("tenantId", "date");

-- CreateIndex
CREATE INDEX "voice_campaigns_tenantId_status_idx" ON "voice_campaigns"("tenantId", "status");

-- CreateIndex
CREATE INDEX "voice_calls_voiceCampaignId_idx" ON "voice_calls"("voiceCampaignId");

-- CreateIndex
CREATE INDEX "voice_calls_tenantId_userId_idx" ON "voice_calls"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "voice_interactions_voiceCallId_idx" ON "voice_interactions"("voiceCallId");

-- CreateIndex
CREATE INDEX "voice_interactions_tenantId_timestamp_idx" ON "voice_interactions"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "voice_metrics_tenantId_date_idx" ON "voice_metrics"("tenantId", "date");

-- CreateIndex
CREATE INDEX "whatsapp_campaigns_tenantId_status_idx" ON "whatsapp_campaigns"("tenantId", "status");

-- CreateIndex
CREATE INDEX "whatsapp_messages_whatsappCampaignId_idx" ON "whatsapp_messages"("whatsappCampaignId");

-- CreateIndex
CREATE INDEX "whatsapp_messages_tenantId_userId_idx" ON "whatsapp_messages"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "whatsapp_interactions_whatsappMessageId_idx" ON "whatsapp_interactions"("whatsappMessageId");

-- CreateIndex
CREATE INDEX "whatsapp_interactions_tenantId_timestamp_idx" ON "whatsapp_interactions"("tenantId", "timestamp");

-- CreateIndex
CREATE INDEX "whatsapp_metrics_tenantId_date_idx" ON "whatsapp_metrics"("tenantId", "date");

-- CreateIndex
CREATE INDEX "push_campaigns_tenantId_status_idx" ON "push_campaigns"("tenantId", "status");

-- CreateIndex
CREATE INDEX "push_notifications_campaignId_idx" ON "push_notifications"("campaignId");

-- CreateIndex
CREATE INDEX "push_notifications_tenantId_userId_idx" ON "push_notifications"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "push_metrics_tenantId_date_idx" ON "push_metrics"("tenantId", "date");

-- CreateIndex
CREATE INDEX "email_campaigns_tenantId_status_idx" ON "email_campaigns"("tenantId", "status");

-- CreateIndex
CREATE INDEX "email_deliveries_emailCampaignId_idx" ON "email_deliveries"("emailCampaignId");

-- CreateIndex
CREATE INDEX "email_deliveries_tenantId_userId_idx" ON "email_deliveries"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "email_metrics_tenantId_date_idx" ON "email_metrics"("tenantId", "date");

-- CreateIndex
CREATE INDEX "sms_campaigns_tenantId_status_idx" ON "sms_campaigns"("tenantId", "status");

-- CreateIndex
CREATE INDEX "sms_deliveries_smsCampaignId_idx" ON "sms_deliveries"("smsCampaignId");

-- CreateIndex
CREATE INDEX "sms_deliveries_tenantId_userId_idx" ON "sms_deliveries"("tenantId", "userId");

-- CreateIndex
CREATE INDEX "sms_metrics_tenantId_date_idx" ON "sms_metrics"("tenantId", "date");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_createdAt_idx" ON "audit_logs"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_resource_resourceId_idx" ON "audit_logs"("tenantId", "resource", "resourceId");

-- AddForeignKey
ALTER TABLE "tenant_api_keys" ADD CONSTRAINT "tenant_api_keys_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "preference_tokens" ADD CONSTRAINT "preference_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_engagement_scores" ADD CONSTRAINT "user_engagement_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_definitions" ADD CONSTRAINT "event_definitions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_processing_logs" ADD CONSTRAINT "event_processing_logs_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rules" ADD CONSTRAINT "rules_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rule_executions" ADD CONSTRAINT "rule_executions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "templates" ADD CONSTRAINT "templates_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "template_versions" ADD CONSTRAINT "template_versions_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaigns" ADD CONSTRAINT "campaigns_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "campaign_runs" ADD CONSTRAINT "campaign_runs_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_decisions" ADD CONSTRAINT "engagement_decisions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_decisions" ADD CONSTRAINT "engagement_decisions_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_decisions" ADD CONSTRAINT "engagement_decisions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_engagementDecisionId_fkey" FOREIGN KEY ("engagementDecisionId") REFERENCES "engagement_decisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliveries" ADD CONSTRAINT "deliveries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "delivery_events" ADD CONSTRAINT "delivery_events_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "channel_providers" ADD CONSTRAINT "channel_providers_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_unsubscribes" ADD CONSTRAINT "global_unsubscribes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "global_unsubscribes" ADD CONSTRAINT "global_unsubscribes_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequency_caps" ADD CONSTRAINT "frequency_caps_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "frequency_caps" ADD CONSTRAINT "frequency_caps_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public_feeds" ADD CONSTRAINT "public_feeds_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_entries" ADD CONSTRAINT "feed_entries_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "public_feeds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "polls" ADD CONSTRAINT "polls_feedId_fkey" FOREIGN KEY ("feedId") REFERENCES "public_feeds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_pollId_fkey" FOREIGN KEY ("pollId") REFERENCES "polls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "poll_votes" ADD CONSTRAINT "poll_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "engagement_metrics" ADD CONSTRAINT "engagement_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_decision_metrics" ADD CONSTRAINT "ai_decision_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_campaigns" ADD CONSTRAINT "voice_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_voiceCampaignId_fkey" FOREIGN KEY ("voiceCampaignId") REFERENCES "voice_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_calls" ADD CONSTRAINT "voice_calls_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_interactions" ADD CONSTRAINT "voice_interactions_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "voice_calls"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_metrics" ADD CONSTRAINT "voice_metrics_voiceCampaignId_fkey" FOREIGN KEY ("voiceCampaignId") REFERENCES "voice_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "voice_metrics" ADD CONSTRAINT "voice_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_whatsappCampaignId_fkey" FOREIGN KEY ("whatsappCampaignId") REFERENCES "whatsapp_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_messages" ADD CONSTRAINT "whatsapp_messages_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_interactions" ADD CONSTRAINT "whatsapp_interactions_whatsappMessageId_fkey" FOREIGN KEY ("whatsappMessageId") REFERENCES "whatsapp_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_metrics" ADD CONSTRAINT "whatsapp_metrics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatsapp_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "whatsapp_metrics" ADD CONSTRAINT "whatsapp_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_campaigns" ADD CONSTRAINT "push_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "push_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_notifications" ADD CONSTRAINT "push_notifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_metrics" ADD CONSTRAINT "push_metrics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "push_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_metrics" ADD CONSTRAINT "push_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_campaigns" ADD CONSTRAINT "email_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_emailCampaignId_fkey" FOREIGN KEY ("emailCampaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_deliveries" ADD CONSTRAINT "email_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_metrics" ADD CONSTRAINT "email_metrics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "email_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "email_metrics" ADD CONSTRAINT "email_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_campaigns" ADD CONSTRAINT "sms_campaigns_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_deliveries" ADD CONSTRAINT "sms_deliveries_smsCampaignId_fkey" FOREIGN KEY ("smsCampaignId") REFERENCES "sms_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_deliveries" ADD CONSTRAINT "sms_deliveries_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_metrics" ADD CONSTRAINT "sms_metrics_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "sms_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sms_metrics" ADD CONSTRAINT "sms_metrics_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
