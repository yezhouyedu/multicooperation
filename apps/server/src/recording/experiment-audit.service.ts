import { Injectable } from '@nestjs/common';
import { ExperimentPhase, ParticipantRole, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export type ExperimentEventInput = {
  sessionId: string;
  participantId?: string | null;
  taskAssignmentId?: string | null;
  companyId?: string | null;
  sideTaskPlanId?: string | null;
  role?: ParticipantRole | null;
  eventType: string;
  phase?: ExperimentPhase | null;
  segmentIndex?: number | null;
  serverTime?: Date;
  clientTime?: Date | null;
  payload?: Prisma.InputJsonValue | null;
};

@Injectable()
export class ExperimentAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: ExperimentEventInput) {
    try {
      return await this.prisma.experimentEvent.create({
        data: {
          sessionId: input.sessionId,
          participantId: input.participantId ?? null,
          taskAssignmentId: input.taskAssignmentId ?? null,
          companyId: input.companyId ?? null,
          sideTaskPlanId: input.sideTaskPlanId ?? null,
          role: input.role ?? null,
          eventType: input.eventType,
          phase: input.phase ?? null,
          segmentIndex: input.segmentIndex ?? null,
          serverTime: input.serverTime ?? new Date(),
          clientTime: input.clientTime ?? null,
          payload: input.payload ?? Prisma.JsonNull,
        },
      });
    } catch (error) {
      // Audit writes must never break the participant workflow.
      console.warn('[experiment-audit] failed to record event', input.eventType, error);
      return null;
    }
  }

  async recordMany(inputs: ExperimentEventInput[]) {
    for (const input of inputs) {
      await this.record(input);
    }
  }
}
