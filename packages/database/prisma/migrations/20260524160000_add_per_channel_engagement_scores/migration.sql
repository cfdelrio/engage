-- AlterTable
ALTER TABLE "user_engagement_scores"
  ADD COLUMN "emailOpenRate30d"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "emailClickRate30d"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "whatsappReadRate30d" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "smsDeliveryRate30d"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "voiceAnswerRate30d"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "pushOpenRate30d"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "preferredChannel"    TEXT;

-- CreateIndex
CREATE INDEX "user_engagement_scores_tenantId_preferredChannel_idx" ON "user_engagement_scores"("tenantId", "preferredChannel");
