-- Add eventId to deliveries and voice_calls for end-to-end traceability.
-- Allows tracing: event → engagement_decision → delivery → voice_call
-- without manual cross-table timestamp joins.

ALTER TABLE "deliveries"   ADD COLUMN IF NOT EXISTS "eventId" TEXT;
ALTER TABLE "voice_calls"  ADD COLUMN IF NOT EXISTS "eventId" TEXT;

CREATE INDEX IF NOT EXISTS "deliveries_eventId_idx"   ON "deliveries"  ("eventId");
CREATE INDEX IF NOT EXISTS "voice_calls_eventId_idx"  ON "voice_calls" ("eventId");
