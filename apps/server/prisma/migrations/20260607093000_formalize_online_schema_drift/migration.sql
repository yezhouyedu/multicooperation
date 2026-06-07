-- Formalize columns that were first hot-fixed on the P0 bare-IP server.
-- Keep this migration idempotent so `prisma migrate deploy` succeeds on
-- databases where the emergency ALTER TABLE has already been applied.

ALTER TABLE "public"."TaskAssignment"
ADD COLUMN IF NOT EXISTS "bSequenceIndex" INTEGER;

CREATE INDEX IF NOT EXISTS "TaskAssignment_sessionId_bSequenceIndex_idx"
ON "public"."TaskAssignment"("sessionId", "bSequenceIndex");

ALTER TABLE "public"."RandomizationAudit"
ADD COLUMN IF NOT EXISTS "bAssignmentMethod" TEXT,
ADD COLUMN IF NOT EXISTS "bAssignmentLog" JSONB;
