ALTER TABLE "ExperimentConfig"
  ADD COLUMN "onlineIntegrityEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "idlePromptSeconds" INTEGER NOT NULL DEFAULT 120,
  ADD COLUMN "idleConfirmationGraceSeconds" INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN "heartbeatIntervalSeconds" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN "connectionLostGraceSeconds" INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN "dropoutTimeoutSeconds" INTEGER NOT NULL DEFAULT 180,
  ADD COLUMN "offscreenViolationSeconds" INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN "fullscreenRequired" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "authorizedDialogMaxSeconds" INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN "pasteAfterOffscreenWindowSeconds" INTEGER NOT NULL DEFAULT 30;

ALTER TYPE "SessionStatus" ADD VALUE IF NOT EXISTS 'TERMINATED';

ALTER TABLE "ExperimentRun" ALTER COLUMN "designVersion" SET DEFAULT 'nine_condition_block_v1';

UPDATE "ExperimentConfig" AS config
SET "activeExperimentMode" = 'manual', "activeExperimentRunId" = NULL
WHERE EXISTS (
  SELECT 1 FROM "ExperimentRun" AS run
  WHERE run."id" = config."activeExperimentRunId"
    AND run."designVersion" <> 'nine_condition_block_v1'
);

UPDATE "ExperimentRun"
SET "status" = 'CLOSED', "closedAt" = COALESCE("closedAt", CURRENT_TIMESTAMP)
WHERE "designVersion" <> 'nine_condition_block_v1' AND "status" = 'ACTIVE';

CREATE TABLE "ParticipantIntegrityState" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "role" "ParticipantRole" NOT NULL,
  "currentState" TEXT NOT NULL DEFAULT 'ACTIVE',
  "stateStartedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastHeartbeatAt" TIMESTAMP(3),
  "lastValidActivityAt" TIMESTAMP(3),
  "hasInvalidInactivity" BOOLEAN NOT NULL DEFAULT false,
  "hasOffscreenViolation" BOOLEAN NOT NULL DEFAULT false,
  "hasConnectionLoss" BOOLEAN NOT NULL DEFAULT false,
  "hasFormalDropout" BOOLEAN NOT NULL DEFAULT false,
  "inactivityIntervalCount" INTEGER NOT NULL DEFAULT 0,
  "offscreenIntervalCount" INTEGER NOT NULL DEFAULT 0,
  "offscreenViolationCount" INTEGER NOT NULL DEFAULT 0,
  "disconnectIntervalCount" INTEGER NOT NULL DEFAULT 0,
  "inactivityTotalMs" INTEGER NOT NULL DEFAULT 0,
  "offscreenTotalMs" INTEGER NOT NULL DEFAULT 0,
  "disconnectTotalMs" INTEGER NOT NULL DEFAULT 0,
  "formalDropoutAt" TIMESTAMP(3),
  "formalDropoutReason" TEXT,
  "integrityCommitmentAt" TIMESTAMP(3),
  "comprehensionAnswers" JSONB,
  "comprehensionPassedAt" TIMESTAMP(3),
  "finalSelfReport" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ParticipantIntegrityState_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OnlineIntegrityInterval" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "participantId" TEXT NOT NULL,
  "integrityStateId" TEXT NOT NULL,
  "role" "ParticipantRole" NOT NULL,
  "intervalType" TEXT NOT NULL,
  "phase" "ExperimentPhase" NOT NULL DEFAULT 'FORMAL',
  "segmentIndex" INTEGER,
  "taskAssignmentId" TEXT,
  "companyId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "endedAt" TIMESTAMP(3),
  "durationMs" INTEGER,
  "isViolation" BOOLEAN NOT NULL DEFAULT false,
  "idleCountdownStartedAt" TIMESTAMP(3),
  "promptShownAt" TIMESTAMP(3),
  "confirmationDeadlineAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "invalidStartedAt" TIMESTAMP(3),
  "invalidEndedAt" TIMESTAMP(3),
  "triggerReason" TEXT,
  "endReason" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OnlineIntegrityInterval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ParticipantIntegrityState_sessionId_participantId_key" ON "ParticipantIntegrityState"("sessionId", "participantId");
CREATE INDEX "ParticipantIntegrityState_sessionId_role_idx" ON "ParticipantIntegrityState"("sessionId", "role");
CREATE INDEX "ParticipantIntegrityState_currentState_idx" ON "ParticipantIntegrityState"("currentState");
CREATE INDEX "ParticipantIntegrityState_hasFormalDropout_idx" ON "ParticipantIntegrityState"("hasFormalDropout");
CREATE INDEX "OnlineIntegrityInterval_sessionId_participantId_intervalType_idx" ON "OnlineIntegrityInterval"("sessionId", "participantId", "intervalType");
CREATE INDEX "OnlineIntegrityInterval_integrityStateId_startedAt_idx" ON "OnlineIntegrityInterval"("integrityStateId", "startedAt");
CREATE INDEX "OnlineIntegrityInterval_startedAt_idx" ON "OnlineIntegrityInterval"("startedAt");
CREATE INDEX "OnlineIntegrityInterval_endedAt_idx" ON "OnlineIntegrityInterval"("endedAt");

ALTER TABLE "ParticipantIntegrityState" ADD CONSTRAINT "ParticipantIntegrityState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ParticipantIntegrityState" ADD CONSTRAINT "ParticipantIntegrityState_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineIntegrityInterval" ADD CONSTRAINT "OnlineIntegrityInterval_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineIntegrityInterval" ADD CONSTRAINT "OnlineIntegrityInterval_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnlineIntegrityInterval" ADD CONSTRAINT "OnlineIntegrityInterval_integrityStateId_fkey" FOREIGN KEY ("integrityStateId") REFERENCES "ParticipantIntegrityState"("id") ON DELETE CASCADE ON UPDATE CASCADE;
