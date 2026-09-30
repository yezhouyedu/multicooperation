-- Exact 5 minute 30 second practice duration.
ALTER TABLE "public"."ExperimentConfig"
  ALTER COLUMN "practiceDurationMinutes" TYPE DOUBLE PRECISION
  USING "practiceDurationMinutes"::DOUBLE PRECISION,
  ALTER COLUMN "practiceDurationMinutes" SET DEFAULT 5.5;

-- Server-persisted questionnaire drafts, distinct from submitted responses.
CREATE TABLE "public"."QuestionnaireDraft" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "phase" "public"."ExperimentPhase" NOT NULL DEFAULT 'FORMAL',
  "segmentIndex" INTEGER NOT NULL,
  "questionnaireKind" TEXT NOT NULL,
  "templateId" TEXT,
  "answers" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "firstStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSavedAt" TIMESTAMP(3) NOT NULL,
  "submittedAt" TIMESTAMP(3),
  CONSTRAINT "QuestionnaireDraft_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuestionnaireDraft_sessionId_participantId_phase_segmentIndex_key"
  ON "public"."QuestionnaireDraft"("sessionId", "participantId", "phase", "segmentIndex");
CREATE INDEX "QuestionnaireDraft_sessionId_participantId_idx"
  ON "public"."QuestionnaireDraft"("sessionId", "participantId");
CREATE INDEX "QuestionnaireDraft_status_idx" ON "public"."QuestionnaireDraft"("status");

ALTER TABLE "public"."QuestionnaireDraft"
  ADD CONSTRAINT "QuestionnaireDraft_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."QuestionnaireDraft"
  ADD CONSTRAINT "QuestionnaireDraft_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A non-null key exists only while an integrity interval is open. This makes
-- "one open interval per participant and type" an atomic database invariant.
ALTER TABLE "public"."OnlineIntegrityInterval" ADD COLUMN "openIntervalKey" TEXT;
CREATE UNIQUE INDEX "OnlineIntegrityInterval_openIntervalKey_key"
  ON "public"."OnlineIntegrityInterval"("openIntervalKey");

-- First-release events use a persistent idempotency key; redisplay events may
-- still be recorded separately when explicitly needed.
ALTER TABLE "public"."SideTaskExposureLog" ADD COLUMN "deduplicationKey" TEXT;
CREATE UNIQUE INDEX "SideTaskExposureLog_deduplicationKey_key"
  ON "public"."SideTaskExposureLog"("deduplicationKey");
