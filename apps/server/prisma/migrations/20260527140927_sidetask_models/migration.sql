/*
  Warnings:

  - A unique constraint covering the columns `[phone]` on the table `Participant` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "public"."RuntimePhase" AS ENUM ('INSTRUCTION', 'PRACTICE_READY', 'PRACTICE', 'FORMAL_READY', 'FORMAL_WORK', 'FORMAL_BREAK', 'END');

-- CreateEnum
CREATE TYPE "public"."SegmentType" AS ENUM ('PRACTICE', 'WORK', 'BREAK');

-- CreateEnum
CREATE TYPE "public"."ExperimentPhase" AS ENUM ('PRACTICE', 'FORMAL');

-- CreateEnum
CREATE TYPE "public"."AiLevel" AS ENUM ('BASIC', 'ADVANCED');

-- AlterTable
ALTER TABLE "public"."Participant" ADD COLUMN     "phone" TEXT;

-- AlterTable
ALTER TABLE "public"."Session" ADD COLUMN     "currentPhase" "public"."ExperimentPhase",
ADD COLUMN     "currentSegmentEnds" TIMESTAMP(3),
ADD COLUMN     "currentSegmentIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "currentSegmentStarts" TIMESTAMP(3),
ADD COLUMN     "currentSegmentType" "public"."SegmentType",
ADD COLUMN     "practiceCompletedAt" TIMESTAMP(3),
ADD COLUMN     "runtimePhase" "public"."RuntimePhase" NOT NULL DEFAULT 'INSTRUCTION';

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roundLabel" TEXT NOT NULL,
    "sector" TEXT NOT NULL,
    "tags" JSONB NOT NULL,
    "summary" TEXT NOT NULL,
    "materials" JSONB NOT NULL,
    "researchProfile" JSONB,
    "autoFillSourceMaterialId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskAssignment" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "phase" "public"."ExperimentPhase" NOT NULL DEFAULT 'FORMAL',
    "sortOrder" INTEGER NOT NULL,
    "sequenceIndex" INTEGER NOT NULL,
    "aStartedAt" TIMESTAMP(3),
    "aDeadlineAt" TIMESTAMP(3),
    "aRemainingSeconds" INTEGER NOT NULL DEFAULT 300,
    "aSubmittedAt" TIMESTAMP(3),
    "aUnlockedForBAt" TIMESTAMP(3),
    "bViewedAInfoAt" TIMESTAMP(3),
    "bCanSubmitAt" TIMESTAMP(3),
    "bCompletedAt" TIMESTAMP(3),
    "frozenAt" TIMESTAMP(3),
    "resumedAt" TIMESTAMP(3),
    "aDraft" JSONB,
    "bDraft" JSONB,
    "bFeedbackDraft" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ExperimentConfig" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "workDurationMinutes" INTEGER NOT NULL DEFAULT 20,
    "breakDurationMinutes" INTEGER NOT NULL DEFAULT 5,
    "segmentOneAiLevel" "public"."AiLevel" NOT NULL DEFAULT 'BASIC',
    "segmentTwoAiLevel" "public"."AiLevel" NOT NULL DEFAULT 'BASIC',
    "segmentThreeAiLevel" "public"."AiLevel" NOT NULL DEFAULT 'ADVANCED',
    "activeQuestionnaireTemplateId" TEXT,
    "sideTaskContinuousIntervalSec" INTEGER NOT NULL DEFAULT 45,
    "sideTaskContinuousJitterSec" INTEGER NOT NULL DEFAULT 15,
    "sideTaskScrollDurationSec" INTEGER NOT NULL DEFAULT 12,
    "sideTaskHoldSec" INTEGER NOT NULL DEFAULT 5,
    "sideTaskFadeSec" INTEGER NOT NULL DEFAULT 2,
    "sideTaskContinuousPauseSec" INTEGER NOT NULL DEFAULT 15,
    "sideTaskBatchSizes" TEXT NOT NULL DEFAULT '10,15,15',
    "sideTaskBatchTriggerSec" INTEGER NOT NULL DEFAULT 180,
    "sideTaskBatchPauseSec" INTEGER NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExperimentConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SessionSegmentState" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "phase" "public"."ExperimentPhase" NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "type" "public"."SegmentType" NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SessionSegmentState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskSnapshot" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "taskAssignmentId" TEXT NOT NULL,
    "participantId" TEXT,
    "snapshotType" TEXT NOT NULL,
    "scope" TEXT,
    "role" TEXT,
    "section" TEXT,
    "segmentIndex" INTEGER,
    "restoreSourceSnapshotId" TEXT,
    "takenReason" TEXT,
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "label" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestionnaireTemplate" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "items" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuestionnaireTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QuestionnaireResponse" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "templateId" TEXT,
    "phase" "public"."ExperimentPhase" NOT NULL DEFAULT 'FORMAL',
    "segmentIndex" INTEGER NOT NULL,
    "answers" JSONB NOT NULL,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionnaireResponse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiSettings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "basicBaseUrl" TEXT NOT NULL DEFAULT 'https://api.deepseek.com',
    "basicModel" TEXT NOT NULL DEFAULT 'deepseek-chat',
    "basicApiKey" TEXT NOT NULL DEFAULT '',
    "basicContextLimit" INTEGER NOT NULL DEFAULT 20,
    "advancedBaseUrl" TEXT NOT NULL DEFAULT 'https://api.deepseek.com',
    "advancedModel" TEXT NOT NULL DEFAULT 'deepseek-chat',
    "advancedApiKey" TEXT NOT NULL DEFAULT '',
    "advancedContextLimit" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AiMessageLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT,
    "companyId" TEXT,
    "contextType" TEXT NOT NULL,
    "phase" "public"."ExperimentPhase",
    "segmentIndex" INTEGER,
    "aiLevel" "public"."AiLevel" NOT NULL,
    "messageRole" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "attachments" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SideTaskResponseLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SideTaskResponseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SideTaskItem" (
    "id" TEXT NOT NULL,
    "itemCode" TEXT NOT NULL,
    "poolType" TEXT NOT NULL,
    "workSegment" INTEGER NOT NULL,
    "surfaceScenario" TEXT,
    "skeletonType" TEXT,
    "narrativeCategory" TEXT,
    "narrativeSubtype" TEXT,
    "directAiFlag" BOOLEAN NOT NULL DEFAULT false,
    "text" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionVariantId" TEXT,
    "optionA" TEXT NOT NULL,
    "optionB" TEXT NOT NULL,
    "goldAnswer" TEXT,
    "evidenceSpan" TEXT,
    "distractorType" TEXT,
    "distractorNote" TEXT,
    "spilloverRiskFlag" BOOLEAN NOT NULL DEFAULT false,
    "spilloverRiskNote" TEXT,
    "difficulty" TEXT,
    "version" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SideTaskItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SideTaskPlan" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "itemId" TEXT NOT NULL,
    "dispatchMode" TEXT NOT NULL,
    "narrativeGroup" TEXT NOT NULL,
    "themeLabel" TEXT,
    "queueOrder" INTEGER NOT NULL,
    "batchNo" INTEGER,
    "scheduledAt" TIMESTAMP(3),
    "releasedAt" TIMESTAMP(3),
    "isArchivedAtSegmentEnd" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SideTaskPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SideTaskExposureLog" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "sideTaskPlanId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,

    CONSTRAINT "SideTaskExposureLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SideTaskSessionConfig" (
    "sessionId" TEXT NOT NULL,
    "dispatchMode" TEXT NOT NULL,
    "narrativeGroup" TEXT NOT NULL,
    "themeOrder" JSONB,
    "segment1Theme" TEXT,
    "segment2Theme" TEXT,
    "segment3Theme" TEXT,
    "segment1PlannedCount" INTEGER NOT NULL DEFAULT 40,
    "segment2PlannedCount" INTEGER NOT NULL DEFAULT 40,
    "segment3PlannedCount" INTEGER NOT NULL DEFAULT 40,
    "newsSequenceSeed" TEXT NOT NULL,
    "distributionVersion" TEXT NOT NULL DEFAULT 'v1',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SideTaskSessionConfig_pkey" PRIMARY KEY ("sessionId")
);

-- CreateIndex
CREATE INDEX "TaskAssignment_sessionId_idx" ON "public"."TaskAssignment"("sessionId");

-- CreateIndex
CREATE INDEX "TaskAssignment_sessionId_phase_sortOrder_idx" ON "public"."TaskAssignment"("sessionId", "phase", "sortOrder");

-- CreateIndex
CREATE INDEX "SessionSegmentState_sessionId_phase_segmentIndex_idx" ON "public"."SessionSegmentState"("sessionId", "phase", "segmentIndex");

-- CreateIndex
CREATE INDEX "TaskSnapshot_sessionId_taskAssignmentId_idx" ON "public"."TaskSnapshot"("sessionId", "taskAssignmentId");

-- CreateIndex
CREATE INDEX "TaskSnapshot_sessionId_taskAssignmentId_snapshotType_idx" ON "public"."TaskSnapshot"("sessionId", "taskAssignmentId", "snapshotType");

-- CreateIndex
CREATE INDEX "QuestionnaireResponse_sessionId_participantId_segmentIndex_idx" ON "public"."QuestionnaireResponse"("sessionId", "participantId", "segmentIndex");

-- CreateIndex
CREATE INDEX "AiMessageLog_sessionId_contextType_phase_segmentIndex_idx" ON "public"."AiMessageLog"("sessionId", "contextType", "phase", "segmentIndex");

-- CreateIndex
CREATE INDEX "SideTaskResponseLog_sessionId_participantId_segmentIndex_idx" ON "public"."SideTaskResponseLog"("sessionId", "participantId", "segmentIndex");

-- CreateIndex
CREATE UNIQUE INDEX "SideTaskItem_itemCode_key" ON "public"."SideTaskItem"("itemCode");

-- CreateIndex
CREATE INDEX "SideTaskItem_poolType_workSegment_idx" ON "public"."SideTaskItem"("poolType", "workSegment");

-- CreateIndex
CREATE INDEX "SideTaskItem_narrativeCategory_workSegment_idx" ON "public"."SideTaskItem"("narrativeCategory", "workSegment");

-- CreateIndex
CREATE INDEX "SideTaskItem_isActive_idx" ON "public"."SideTaskItem"("isActive");

-- CreateIndex
CREATE INDEX "SideTaskPlan_sessionId_segmentIndex_idx" ON "public"."SideTaskPlan"("sessionId", "segmentIndex");

-- CreateIndex
CREATE INDEX "SideTaskPlan_sessionId_segmentIndex_queueOrder_idx" ON "public"."SideTaskPlan"("sessionId", "segmentIndex", "queueOrder");

-- CreateIndex
CREATE INDEX "SideTaskExposureLog_sessionId_participantId_idx" ON "public"."SideTaskExposureLog"("sessionId", "participantId");

-- CreateIndex
CREATE INDEX "SideTaskExposureLog_sideTaskPlanId_idx" ON "public"."SideTaskExposureLog"("sideTaskPlanId");

-- CreateIndex
CREATE INDEX "SideTaskExposureLog_eventType_idx" ON "public"."SideTaskExposureLog"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "Participant_phone_key" ON "public"."Participant"("phone");

-- AddForeignKey
ALTER TABLE "public"."TaskAssignment" ADD CONSTRAINT "TaskAssignment_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskAssignment" ADD CONSTRAINT "TaskAssignment_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ExperimentConfig" ADD CONSTRAINT "ExperimentConfig_activeQuestionnaireTemplateId_fkey" FOREIGN KEY ("activeQuestionnaireTemplateId") REFERENCES "public"."QuestionnaireTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SessionSegmentState" ADD CONSTRAINT "SessionSegmentState_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskSnapshot" ADD CONSTRAINT "TaskSnapshot_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskSnapshot" ADD CONSTRAINT "TaskSnapshot_taskAssignmentId_fkey" FOREIGN KEY ("taskAssignmentId") REFERENCES "public"."TaskAssignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QuestionnaireResponse" ADD CONSTRAINT "QuestionnaireResponse_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "public"."QuestionnaireTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."AiMessageLog" ADD CONSTRAINT "AiMessageLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SideTaskResponseLog" ADD CONSTRAINT "SideTaskResponseLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SideTaskResponseLog" ADD CONSTRAINT "SideTaskResponseLog_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SideTaskPlan" ADD CONSTRAINT "SideTaskPlan_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SideTaskPlan" ADD CONSTRAINT "SideTaskPlan_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "public"."SideTaskItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SideTaskExposureLog" ADD CONSTRAINT "SideTaskExposureLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SideTaskExposureLog" ADD CONSTRAINT "SideTaskExposureLog_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SideTaskExposureLog" ADD CONSTRAINT "SideTaskExposureLog_sideTaskPlanId_fkey" FOREIGN KEY ("sideTaskPlanId") REFERENCES "public"."SideTaskPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."SideTaskSessionConfig" ADD CONSTRAINT "SideTaskSessionConfig_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
