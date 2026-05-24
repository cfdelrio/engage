-- AlterTable
ALTER TABLE "whatsapp_campaigns" ADD COLUMN "deletedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "whatsapp_campaigns_tenantId_deletedAt_idx" ON "whatsapp_campaigns"("tenantId", "deletedAt");
