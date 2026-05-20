-- AlterTable: Add status and updatedAt to tenant_api_keys
ALTER TABLE "tenant_api_keys" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active';
ALTER TABLE "tenant_api_keys" ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- Create index for common queries
CREATE INDEX "tenant_api_keys_tenantId_status_idx" ON "tenant_api_keys"("tenantId", "status");
