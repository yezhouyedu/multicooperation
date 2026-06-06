-- Experiment 1/2/3 mode presets and session-level snapshots.
ALTER TABLE "ExperimentConfig"
ADD COLUMN "activeExperimentMode" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "experimentModeSettings" JSONB,
ADD COLUMN "instructionBlocks" JSONB;

ALTER TABLE "Session"
ADD COLUMN "experimentMode" TEXT NOT NULL DEFAULT 'manual',
ADD COLUMN "upgradeCohort" TEXT,
ADD COLUMN "experimentSnapshot" JSONB;

ALTER TABLE "TaskAssignment"
ADD COLUMN "aAiLevelAtWindow" "AiLevel",
ADD COLUMN "bPreAAiLevel" "AiLevel",
ADD COLUMN "bPostAAiLevel" "AiLevel",
ADD COLUMN "crossUpgradeBoundaryFlag" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "AiMessageLog"
ADD COLUMN "modelVersion" TEXT,
ADD COLUMN "imageUploadEnabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "RandomizationAudit"
ADD COLUMN "experimentMode" TEXT,
ADD COLUMN "experimentRandomization" JSONB;
