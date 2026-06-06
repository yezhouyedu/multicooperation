-- Experiment audit events and server-side export jobs.

ALTER TABLE "AiMessageLog"
  ADD COLUMN "taskAssignmentId" TEXT,
  ADD COLUMN "sideTaskPlanId" TEXT,
  ADD COLUMN "completedAt" TIMESTAMP(3),
  ADD COLUMN "latencyMs" INTEGER,
  ADD COLUMN "providerStatus" TEXT,
  ADD COLUMN "errorMessage" TEXT;

CREATE INDEX "AiMessageLog_taskAssignmentId_idx" ON "AiMessageLog"("taskAssignmentId");
CREATE INDEX "AiMessageLog_sideTaskPlanId_idx" ON "AiMessageLog"("sideTaskPlanId");
CREATE INDEX "AiMessageLog_requestId_idx" ON "AiMessageLog"("requestId");

CREATE TABLE "ExperimentEvent" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT NOT NULL,
  "participantId" TEXT,
  "taskAssignmentId" TEXT,
  "companyId" TEXT,
  "sideTaskPlanId" TEXT,
  "role" "ParticipantRole",
  "eventType" TEXT NOT NULL,
  "phase" "ExperimentPhase",
  "segmentIndex" INTEGER,
  "serverTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "clientTime" TIMESTAMP(3),
  "payload" JSONB,
  "schemaVersion" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExperimentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExperimentEvent_sessionId_participantId_idx" ON "ExperimentEvent"("sessionId", "participantId");
CREATE INDEX "ExperimentEvent_sessionId_eventType_idx" ON "ExperimentEvent"("sessionId", "eventType");
CREATE INDEX "ExperimentEvent_taskAssignmentId_idx" ON "ExperimentEvent"("taskAssignmentId");
CREATE INDEX "ExperimentEvent_companyId_idx" ON "ExperimentEvent"("companyId");
CREATE INDEX "ExperimentEvent_sideTaskPlanId_idx" ON "ExperimentEvent"("sideTaskPlanId");
CREATE INDEX "ExperimentEvent_serverTime_idx" ON "ExperimentEvent"("serverTime");

ALTER TABLE "ExperimentEvent"
  ADD CONSTRAINT "ExperimentEvent_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExperimentEvent"
  ADD CONSTRAINT "ExperimentEvent_participantId_fkey"
  FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ExperimentEvent"
  ADD CONSTRAINT "ExperimentEvent_taskAssignmentId_fkey"
  FOREIGN KEY ("taskAssignmentId") REFERENCES "TaskAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ExperimentEvent"
  ADD CONSTRAINT "ExperimentEvent_sideTaskPlanId_fkey"
  FOREIGN KEY ("sideTaskPlanId") REFERENCES "SideTaskPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "ExportJob" (
  "id" TEXT NOT NULL,
  "sessionId" TEXT,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "scope" JSONB NOT NULL,
  "format" TEXT NOT NULL DEFAULT 'participant_folder_zip',
  "outputDir" TEXT,
  "archivePath" TEXT,
  "errorMessage" TEXT,
  "createdBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "startedAt" TIMESTAMP(3),
  "finishedAt" TIMESTAMP(3),

  CONSTRAINT "ExportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExportJob_status_idx" ON "ExportJob"("status");
CREATE INDEX "ExportJob_createdAt_idx" ON "ExportJob"("createdAt");
CREATE INDEX "ExportJob_sessionId_idx" ON "ExportJob"("sessionId");

ALTER TABLE "ExportJob"
  ADD CONSTRAINT "ExportJob_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SideTaskExposureLog_participantId_sideTaskPlanId_eventType_idx"
  ON "SideTaskExposureLog"("participantId", "sideTaskPlanId", "eventType");

CREATE UNIQUE INDEX "SideTaskExposureLog_participant_answer_unique"
  ON "SideTaskExposureLog"("participantId", "sideTaskPlanId")
  WHERE "eventType" = 'side_task_answered';
