ALTER TABLE "TaskAssignment" ADD COLUMN "draftVersions" JSONB NOT NULL DEFAULT '{}';

CREATE TABLE "ServerLiveness" (
    "id" TEXT NOT NULL,
    "instanceId" TEXT NOT NULL,
    "lastAliveAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ServerLiveness_pkey" PRIMARY KEY ("id")
);
