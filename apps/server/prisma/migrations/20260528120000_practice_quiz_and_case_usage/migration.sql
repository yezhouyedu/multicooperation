-- Practice quiz flow, practice case usage, and dual questionnaire templates

ALTER TYPE "RuntimePhase" ADD VALUE IF NOT EXISTS 'PRACTICE_QUIZ';

ALTER TABLE "Company"
ADD COLUMN IF NOT EXISTS "usage" TEXT NOT NULL DEFAULT 'formal';

ALTER TABLE "ExperimentConfig"
ADD COLUMN IF NOT EXISTS "practiceDurationMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN IF NOT EXISTS "practiceQuizTemplateId" TEXT,
ADD COLUMN IF NOT EXISTS "practiceQuizPassCount" INTEGER NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'ExperimentConfig_practiceQuizTemplateId_fkey'
  ) THEN
    ALTER TABLE "ExperimentConfig"
    ADD CONSTRAINT "ExperimentConfig_practiceQuizTemplateId_fkey"
    FOREIGN KEY ("practiceQuizTemplateId")
    REFERENCES "QuestionnaireTemplate"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
  END IF;
END $$;
