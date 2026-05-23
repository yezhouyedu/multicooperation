import { ForbiddenException, Injectable } from '@nestjs/common';
import {
  ExperimentPhase,
  ParticipantRole,
  Prisma,
  RuntimePhase,
  SegmentType,
  SessionStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(phone: string) {
    const participant = await this.prisma.participant.findUnique({ where: { phone } });
    if (!participant) {
      throw new ForbiddenException('手机号未在被试名单中，请核对后重试');
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const existingSession = await tx.session.findFirst({
          where: {
            status: {
              in: [
                SessionStatus.WAITING,
                SessionStatus.MATCHED,
                SessionStatus.IN_PROGRESS,
              ],
            },
            pairings: {
              some: {
                OR: [{ participantAId: participant.id }, { participantBId: participant.id }],
              },
            },
          },
          include: { pairings: true },
          orderBy: { createdAt: 'desc' },
        });

        if (existingSession) {
          const pairing = existingSession.pairings[0];
          const role = pairing?.participantAId === participant.id ? ParticipantRole.A : ParticipantRole.B;
          await tx.participant.update({ where: { id: participant.id }, data: { role } });
          return { sessionCode: existingSession.code, role };
        }

        const waitingSession = await tx.session.findFirst({
          where: {
            status: SessionStatus.WAITING,
            pairings: { some: { participantAId: { not: null }, participantBId: null } },
          },
          include: { pairings: true },
          orderBy: { createdAt: 'asc' },
        });

        if (!waitingSession) {
          const session = await tx.session.create({
            data: {
              code: this.generateCode(),
              status: SessionStatus.WAITING,
              runtimePhase: RuntimePhase.INSTRUCTION,
            },
          });
          await tx.pairing.create({ data: { sessionId: session.id, participantAId: participant.id } });
          await tx.participant.update({ where: { id: participant.id }, data: { role: ParticipantRole.A } });
          return { sessionCode: session.code, role: ParticipantRole.A };
        }

        const pairing = waitingSession.pairings[0];
        if (!pairing || pairing.participantBId !== null) {
          throw new Prisma.PrismaClientKnownRequestError('Session already taken', {
            code: 'P2034',
            clientVersion: '',
          });
        }

        await tx.pairing.update({
          where: { id: pairing.id },
          data: { participantBId: participant.id },
        });
        await tx.participant.update({ where: { id: participant.id }, data: { role: ParticipantRole.B } });
        await tx.session.update({
          where: { id: waitingSession.id },
          data: { status: SessionStatus.MATCHED, runtimePhase: RuntimePhase.INSTRUCTION },
        });

        await this.initializeSessionData(tx, waitingSession.id);
        return { sessionCode: waitingSession.code, role: ParticipantRole.B };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return {
      ok: true,
      participantId: participant.id,
      role: result.role,
      sessionCode: result.sessionCode,
    };
  }

  private async initializeSessionData(tx: Prisma.TransactionClient, sessionId: string) {
    const companies = await tx.company.findMany({ orderBy: { sortOrder: 'asc' } });
    const shuffled = [...companies].sort(() => Math.random() - 0.5);

    await tx.taskAssignment.deleteMany({ where: { sessionId } });

    for (let i = 0; i < shuffled.length; i++) {
      await tx.taskAssignment.create({
        data: {
          sessionId,
          companyId: shuffled[i].id,
          phase: ExperimentPhase.FORMAL,
          sortOrder: i + 1,
          sequenceIndex: i + 1,
        },
      });
    }

    await tx.sessionSegmentState.deleteMany({ where: { sessionId } });
    await tx.sessionSegmentState.createMany({
      data: [
        { sessionId, phase: ExperimentPhase.PRACTICE, segmentIndex: 0, type: SegmentType.PRACTICE },
        { sessionId, phase: ExperimentPhase.FORMAL, segmentIndex: 1, type: SegmentType.WORK },
        { sessionId, phase: ExperimentPhase.FORMAL, segmentIndex: 2, type: SegmentType.BREAK },
        { sessionId, phase: ExperimentPhase.FORMAL, segmentIndex: 3, type: SegmentType.WORK },
        { sessionId, phase: ExperimentPhase.FORMAL, segmentIndex: 4, type: SegmentType.BREAK },
        { sessionId, phase: ExperimentPhase.FORMAL, segmentIndex: 5, type: SegmentType.WORK },
      ],
    });
  }

  private generateCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }
}
