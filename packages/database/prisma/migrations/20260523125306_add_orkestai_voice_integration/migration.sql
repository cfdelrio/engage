-- Add orkestai-voice integration fields to voice_campaigns
ALTER TABLE "voice_campaigns" ADD COLUMN IF NOT EXISTS "orkestaiCampaignId" TEXT;
ALTER TABLE "voice_campaigns" ADD COLUMN IF NOT EXISTS "flowSteps" JSONB;
ALTER TABLE "voice_campaigns" ADD COLUMN IF NOT EXISTS "ttsProvider" TEXT;
ALTER TABLE "voice_campaigns" ADD COLUMN IF NOT EXISTS "elevenLabsVoiceId" TEXT;
ALTER TABLE "voice_campaigns" ADD COLUMN IF NOT EXISTS "audienceSize" INTEGER NOT NULL DEFAULT 0;

-- Add unique constraint on orkestaiCampaignId
CREATE UNIQUE INDEX IF NOT EXISTS "voice_campaigns_orkestaiCampaignId_key" ON "voice_campaigns"("orkestaiCampaignId");

-- Add orkestai-voice integration fields to voice_calls
ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "orkestaiCallId" TEXT;
ALTER TABLE "voice_calls" ADD COLUMN IF NOT EXISTS "responses" JSONB NOT NULL DEFAULT '[]';

-- Add unique constraint on orkestaiCallId
CREATE UNIQUE INDEX IF NOT EXISTS "voice_calls_orkestaiCallId_key" ON "voice_calls"("orkestaiCallId");

-- Create webhook_events table for idempotency
CREATE TABLE IF NOT EXISTS "webhook_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "orkestaiEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "webhook_events_source_orkestaiEventId_key" ON "webhook_events"("source", "orkestaiEventId");
CREATE INDEX IF NOT EXISTS "webhook_events_tenantId_source_eventType_idx" ON "webhook_events"("tenantId", "source", "eventType");
