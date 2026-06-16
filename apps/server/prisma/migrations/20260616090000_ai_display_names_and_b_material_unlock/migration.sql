-- Add configurable AI display names and separate B unlock tracking for A-side source materials.
ALTER TABLE "AiSettings"
  ADD COLUMN IF NOT EXISTS "systemPromptMain" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "systemPromptSide" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "basicDisplayName" TEXT NOT NULL DEFAULT 'aiseek',
  ADD COLUMN IF NOT EXISTS "advancedDisplayName" TEXT NOT NULL DEFAULT 'aiseek pro';

ALTER TABLE "TaskAssignment"
  ADD COLUMN IF NOT EXISTS "bViewedAMaterialsAt" TIMESTAMP(3);

ALTER TABLE "ExperimentConfig"
  ALTER COLUMN "practiceDurationMinutes" SET DEFAULT 5;

UPDATE "ExperimentConfig"
SET "practiceDurationMinutes" = 5
WHERE "id" = 'default' AND "practiceDurationMinutes" = 10;
