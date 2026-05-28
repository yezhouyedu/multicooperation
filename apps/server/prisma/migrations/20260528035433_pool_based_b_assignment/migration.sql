-- AlterEnum
ALTER TYPE "public"."RuntimePhase" ADD VALUE 'PRACTICE_QUIZ';

-- AlterTable
ALTER TABLE "public"."Company" ADD COLUMN     "usage" TEXT NOT NULL DEFAULT 'formal';

-- AlterTable
ALTER TABLE "public"."ExperimentConfig" ADD COLUMN     "practiceDurationMinutes" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "practiceQuizPassCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "practiceQuizTemplateId" TEXT;

-- AddForeignKey
ALTER TABLE "public"."ExperimentConfig" ADD CONSTRAINT "ExperimentConfig_practiceQuizTemplateId_fkey" FOREIGN KEY ("practiceQuizTemplateId") REFERENCES "public"."QuestionnaireTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
