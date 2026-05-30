CREATE TABLE "whatsapp_sessions" (
  "id" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "phone" TEXT NOT NULL,
  "lastInboundAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "whatsapp_sessions_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "whatsapp_sessions" ADD CONSTRAINT "whatsapp_sessions_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "whatsapp_sessions_tenantId_userId_key"
  ON "whatsapp_sessions"("tenantId", "userId");

CREATE INDEX "whatsapp_sessions_tenantId_expiresAt_isActive_idx"
  ON "whatsapp_sessions"("tenantId", "expiresAt", "isActive");
