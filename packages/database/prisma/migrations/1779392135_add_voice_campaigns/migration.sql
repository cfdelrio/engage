-- Voice Campaigns Feature
-- Add tables for voice campaign management and call tracking

-- VoiceCampaign
CREATE TABLE IF NOT EXISTS "VoiceCampaign" (
  "id" TEXT NOT NULL PRIMARY KEY,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "VoiceCampaign_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX "VoiceCampaign_tenantId_idx" ON "VoiceCampaign"("tenantId");
CREATE INDEX "VoiceCampaign_status_idx" ON "VoiceCampaign"("status");
CREATE INDEX "VoiceCampaign_createdAt_idx" ON "VoiceCampaign"("createdAt");

-- VoiceCall
CREATE TABLE IF NOT EXISTS "VoiceCall" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voiceCampaignId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'queued',
  "twilioCallSid" TEXT UNIQUE,
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
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "VoiceCall_voiceCampaignId_fkey" FOREIGN KEY ("voiceCampaignId") REFERENCES "VoiceCampaign"("id") ON DELETE CASCADE,
  CONSTRAINT "VoiceCall_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "VoiceCall_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE
);

CREATE INDEX "VoiceCall_voiceCampaignId_idx" ON "VoiceCall"("voiceCampaignId");
CREATE INDEX "VoiceCall_tenantId_idx" ON "VoiceCall"("tenantId");
CREATE INDEX "VoiceCall_userId_idx" ON "VoiceCall"("userId");
CREATE INDEX "VoiceCall_status_idx" ON "VoiceCall"("status");
CREATE INDEX "VoiceCall_createdAt_idx" ON "VoiceCall"("createdAt");

-- VoiceInteraction
CREATE TABLE IF NOT EXISTS "VoiceInteraction" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voiceCallId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "data" JSONB NOT NULL,
  "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  CONSTRAINT "VoiceInteraction_voiceCallId_fkey" FOREIGN KEY ("voiceCallId") REFERENCES "VoiceCall"("id") ON DELETE CASCADE,
  CONSTRAINT "VoiceInteraction_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE
);

CREATE INDEX "VoiceInteraction_voiceCallId_idx" ON "VoiceInteraction"("voiceCallId");
CREATE INDEX "VoiceInteraction_tenantId_idx" ON "VoiceInteraction"("tenantId");
CREATE INDEX "VoiceInteraction_type_idx" ON "VoiceInteraction"("type");

-- VoiceMetric
CREATE TABLE IF NOT EXISTS "VoiceMetric" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "voiceCampaignId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "date" TIMESTAMP(3) NOT NULL,
  "calls_sent" INTEGER NOT NULL DEFAULT 0,
  "calls_answered" INTEGER NOT NULL DEFAULT 0,
  "calls_completed" INTEGER NOT NULL DEFAULT 0,
  "calls_failed" INTEGER NOT NULL DEFAULT 0,
  "avg_duration" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "dtmf_interactions" INTEGER NOT NULL DEFAULT 0,
  "positive_sentiment" INTEGER NOT NULL DEFAULT 0,
  "negative_sentiment" INTEGER NOT NULL DEFAULT 0,
  
  CONSTRAINT "VoiceMetric_voiceCampaignId_fkey" FOREIGN KEY ("voiceCampaignId") REFERENCES "VoiceCampaign"("id") ON DELETE CASCADE,
  CONSTRAINT "VoiceMetric_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE,
  CONSTRAINT "VoiceMetric_voiceCampaignId_date_key" UNIQUE ("voiceCampaignId", "date")
);

CREATE INDEX "VoiceMetric_voiceCampaignId_idx" ON "VoiceMetric"("voiceCampaignId");
CREATE INDEX "VoiceMetric_tenantId_idx" ON "VoiceMetric"("tenantId");
CREATE INDEX "VoiceMetric_date_idx" ON "VoiceMetric"("date");
