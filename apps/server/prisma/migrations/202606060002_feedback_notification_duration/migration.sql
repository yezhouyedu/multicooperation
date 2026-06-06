ALTER TABLE "ExperimentConfig"
ADD COLUMN IF NOT EXISTS "feedbackNotificationDurationSec" INTEGER NOT NULL DEFAULT 10;
