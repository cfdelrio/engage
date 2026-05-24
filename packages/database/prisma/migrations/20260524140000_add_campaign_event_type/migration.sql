-- AddColumn eventType to all campaign tables
ALTER TABLE "email_campaigns"     ADD COLUMN "eventType" TEXT;
ALTER TABLE "sms_campaigns"       ADD COLUMN "eventType" TEXT;
ALTER TABLE "whatsapp_campaigns"  ADD COLUMN "eventType" TEXT;
ALTER TABLE "push_campaigns"      ADD COLUMN "eventType" TEXT;
ALTER TABLE "voice_campaigns"     ADD COLUMN "eventType" TEXT;
