ALTER TABLE "Session"
ADD COLUMN "experimentRunId" TEXT,
ADD COLUMN "experimentCondition" TEXT,
ADD COLUMN "conditionAssignedAt" TIMESTAMP(3);

ALTER TABLE "ExperimentConfig"
ADD COLUMN "activeExperimentRunId" TEXT;

ALTER TABLE "RandomizationAudit"
ADD COLUMN "conditionAssignmentMethod" TEXT,
ADD COLUMN "conditionAssignmentSeed" TEXT,
ADD COLUMN "conditionBlockIndex" INTEGER,
ADD COLUMN "conditionBlockPosition" INTEGER,
ADD COLUMN "conditionGlobalPosition" INTEGER,
ADD COLUMN "conditionAssignedAt" TIMESTAMP(3);

CREATE TABLE "ExperimentRun" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "designVersion" TEXT NOT NULL DEFAULT 'seven_condition_block_v1',
  "masterSeed" TEXT NOT NULL,
  "initialBlockCount" INTEGER NOT NULL DEFAULT 60,
  "generatedBlockCount" INTEGER NOT NULL DEFAULT 0,
  "activatedAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExperimentRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ExperimentConditionSlot" (
  "id" TEXT NOT NULL,
  "experimentRunId" TEXT NOT NULL,
  "blockIndex" INTEGER NOT NULL,
  "positionInBlock" INTEGER NOT NULL,
  "globalPosition" INTEGER NOT NULL,
  "experimentCondition" TEXT NOT NULL,
  "blockSeed" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
  "assignedSessionId" TEXT,
  "assignedSessionCode" TEXT,
  "assignedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ExperimentConditionSlot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ExperimentRun_code_key" ON "ExperimentRun"("code");
CREATE INDEX "ExperimentRun_status_idx" ON "ExperimentRun"("status");
CREATE UNIQUE INDEX "ExperimentConditionSlot_assignedSessionId_key" ON "ExperimentConditionSlot"("assignedSessionId");
CREATE UNIQUE INDEX "ExperimentConditionSlot_experimentRunId_globalPosition_key" ON "ExperimentConditionSlot"("experimentRunId", "globalPosition");
CREATE UNIQUE INDEX "ExperimentConditionSlot_experimentRunId_blockIndex_positionInBlock_key" ON "ExperimentConditionSlot"("experimentRunId", "blockIndex", "positionInBlock");
CREATE INDEX "ExperimentConditionSlot_experimentRunId_status_globalPosition_idx" ON "ExperimentConditionSlot"("experimentRunId", "status", "globalPosition");
CREATE INDEX "ExperimentConditionSlot_experimentCondition_idx" ON "ExperimentConditionSlot"("experimentCondition");
CREATE UNIQUE INDEX "ExperimentConfig_activeExperimentRunId_key" ON "ExperimentConfig"("activeExperimentRunId");
CREATE INDEX "Session_experimentRunId_idx" ON "Session"("experimentRunId");
CREATE INDEX "Session_experimentCondition_idx" ON "Session"("experimentCondition");

ALTER TABLE "Session" ADD CONSTRAINT "Session_experimentRunId_fkey" FOREIGN KEY ("experimentRunId") REFERENCES "ExperimentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExperimentConfig" ADD CONSTRAINT "ExperimentConfig_activeExperimentRunId_fkey" FOREIGN KEY ("activeExperimentRunId") REFERENCES "ExperimentRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExperimentConditionSlot" ADD CONSTRAINT "ExperimentConditionSlot_experimentRunId_fkey" FOREIGN KEY ("experimentRunId") REFERENCES "ExperimentRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExperimentConditionSlot" ADD CONSTRAINT "ExperimentConditionSlot_assignedSessionId_fkey" FOREIGN KEY ("assignedSessionId") REFERENCES "Session"("id") ON DELETE SET NULL ON UPDATE CASCADE;
