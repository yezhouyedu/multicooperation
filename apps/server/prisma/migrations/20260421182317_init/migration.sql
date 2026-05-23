-- CreateEnum
CREATE TYPE "public"."ParticipantRole" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "public"."SessionStatus" AS ENUM ('WAITING', 'MATCHED', 'IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "public"."Participant" (
    "id" TEXT NOT NULL,
    "nickname" TEXT,
    "role" "public"."ParticipantRole",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Participant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Session" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" "public"."SessionStatus" NOT NULL DEFAULT 'WAITING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Pairing" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantAId" TEXT,
    "participantBId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Pairing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TaskProgress" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Session_code_key" ON "public"."Session"("code");

-- CreateIndex
CREATE INDEX "Pairing_sessionId_idx" ON "public"."Pairing"("sessionId");

-- CreateIndex
CREATE INDEX "TaskProgress_sessionId_idx" ON "public"."TaskProgress"("sessionId");

-- CreateIndex
CREATE INDEX "TaskProgress_participantId_idx" ON "public"."TaskProgress"("participantId");

-- AddForeignKey
ALTER TABLE "public"."Pairing" ADD CONSTRAINT "Pairing_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pairing" ADD CONSTRAINT "Pairing_participantAId_fkey" FOREIGN KEY ("participantAId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Pairing" ADD CONSTRAINT "Pairing_participantBId_fkey" FOREIGN KEY ("participantBId") REFERENCES "public"."Participant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskProgress" ADD CONSTRAINT "TaskProgress_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "public"."Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TaskProgress" ADD CONSTRAINT "TaskProgress_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "public"."Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
