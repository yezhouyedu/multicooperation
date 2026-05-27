CREATE TABLE "RandomizationAudit" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "roleAssignmentMethod" TEXT NOT NULL,
    "roleAssignmentSeed" TEXT NOT NULL,
    "roleAssignedAt" TIMESTAMP(3) NOT NULL,
    "companySequenceMethod" TEXT NOT NULL,
    "companySequenceSeed" TEXT NOT NULL,
    "companySequenceGeneratedAt" TIMESTAMP(3) NOT NULL,
    "companySequence" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RandomizationAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RandomizationAudit_sessionId_key" ON "RandomizationAudit"("sessionId");

CREATE INDEX "RandomizationAudit_sessionId_idx" ON "RandomizationAudit"("sessionId");

ALTER TABLE "RandomizationAudit"
ADD CONSTRAINT "RandomizationAudit_sessionId_fkey"
FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;
