import { createHash, randomBytes } from 'crypto';
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
          const pairing = existingSession.pairings[0] ?? null;
          const role = pairing
            ? this.resolveAssignedRole(
                existingSession.status,
                pairing.participantAId,
                pairing.participantBId,
                participant.id,
              )
            : null;
          if (role) {
            await tx.participant.update({ where: { id: participant.id }, data: { role } });
          }
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
          await tx.participant.update({ where: { id: participant.id }, data: { role: null } });
          return { sessionCode: session.code, role: null };
        }

        const pairing = waitingSession.pairings[0];
        if (!pairing || pairing.participantAId === null || pairing.participantBId !== null) {
          throw new Prisma.PrismaClientKnownRequestError('Session already taken', {
            code: 'P2034',
            clientVersion: '',
          });
        }

        const roleAssignmentSeed = this.generateSeed();
        const existingParticipantId = pairing.participantAId;
        const existingIsA = this.seedToBoolean(roleAssignmentSeed);
        const participantAId = existingIsA ? existingParticipantId : participant.id;
        const participantBId = existingIsA ? participant.id : existingParticipantId;
        const roleAssignedAt = new Date();

        await tx.pairing.update({
          where: { id: pairing.id },
          data: { participantAId, participantBId },
        });
        await tx.participant.update({ where: { id: participantAId }, data: { role: ParticipantRole.A } });
        await tx.participant.update({ where: { id: participantBId }, data: { role: ParticipantRole.B } });
        await tx.session.update({
          where: { id: waitingSession.id },
          data: { status: SessionStatus.MATCHED, runtimePhase: RuntimePhase.INSTRUCTION },
        });

        await this.initializeSessionData(tx, waitingSession.id, {
          roleAssignmentMethod: 'seeded_coin_flip_after_pairing',
          roleAssignmentSeed,
          roleAssignedAt,
        });

        return {
          sessionCode: waitingSession.code,
          role: participantAId === participant.id ? ParticipantRole.A : ParticipantRole.B,
        };
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

  private async initializeSessionData(
    tx: Prisma.TransactionClient,
    sessionId: string,
    roleAudit: {
      roleAssignmentMethod: string;
      roleAssignmentSeed: string;
      roleAssignedAt: Date;
    },
  ) {
    const companies = await tx.company.findMany({ orderBy: { sortOrder: 'asc' } });
    const practiceCompanies = companies.filter((company) => company.usage === 'practice');
    const formalCompanies = companies.filter((company) => company.usage !== 'practice');
    const companySequenceSeed = this.generateSeed();
    const shuffled = this.shuffleWithSeed(formalCompanies, companySequenceSeed);
    const companySequenceSnapshot = shuffled.map((company, index) => ({
      sequenceIndex: index + 1,
      companyId: company.id,
      companyName: company.name,
    }));

    await tx.taskAssignment.deleteMany({ where: { sessionId } });

    const practiceCompany = practiceCompanies[0] ?? companies.find((company) => company.id === 'company-p01-baseline') ?? null;
    if (practiceCompany) {
      await tx.taskAssignment.create({
        data: {
          sessionId,
          companyId: practiceCompany.id,
          phase: ExperimentPhase.PRACTICE,
          sortOrder: 0,
          sequenceIndex: 0,
        },
      });
    }

    for (let index = 0; index < shuffled.length; index += 1) {
      await tx.taskAssignment.create({
        data: {
          sessionId,
          companyId: shuffled[index].id,
          phase: ExperimentPhase.FORMAL,
          sortOrder: index + 1,
          sequenceIndex: index + 1,
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

    const auditClient = tx as Prisma.TransactionClient & {
      randomizationAudit: typeof this.prisma.randomizationAudit;
    };

    await auditClient.randomizationAudit.upsert({
      where: { sessionId },
      update: {
        roleAssignmentMethod: roleAudit.roleAssignmentMethod,
        roleAssignmentSeed: roleAudit.roleAssignmentSeed,
        roleAssignedAt: roleAudit.roleAssignedAt,
        companySequenceMethod: 'seeded_fisher_yates_v1',
        companySequenceSeed,
        companySequenceGeneratedAt: roleAudit.roleAssignedAt,
        companySequence: companySequenceSnapshot as Prisma.InputJsonValue,
        bAssignmentMethod: 'pool_based_random_v1',
        bAssignmentLog: [],
      },
      create: {
        sessionId,
        roleAssignmentMethod: roleAudit.roleAssignmentMethod,
        roleAssignmentSeed: roleAudit.roleAssignmentSeed,
        roleAssignedAt: roleAudit.roleAssignedAt,
        companySequenceMethod: 'seeded_fisher_yates_v1',
        companySequenceSeed,
        companySequenceGeneratedAt: roleAudit.roleAssignedAt,
        companySequence: companySequenceSnapshot as Prisma.InputJsonValue,
        bAssignmentMethod: 'pool_based_random_v1',
        bAssignmentLog: [],
      },
    });

    await this.generateSideTaskPlans(tx, sessionId);
  }

  private async generateSideTaskPlans(
    tx: Prisma.TransactionClient,
    sessionId: string,
  ) {
    const sidetaskTx = tx as Prisma.TransactionClient & {
      sideTaskItem: typeof this.prisma.sideTaskItem;
      sideTaskPlan: typeof this.prisma.sideTaskPlan;
      sideTaskSessionConfig: typeof this.prisma.sideTaskSessionConfig;
    };

    // 1. Generate experiment variables
    const dispatchSeed = this.generateSeed();
    const dispatchMode = this.seedToBoolean(dispatchSeed) ? 'continuous' : 'batch';
    const narrativeSeed = this.generateSeed();
    const narrativeGroup = this.seedToBoolean(narrativeSeed) ? 'coop_narrative' : 'neutral_info';

    const allThemes = ['互补分工', '验证留痕', '共同责任'];
    let themeOrder: string[] = [];
    let segmentThemes: (string | null)[] = [null, null, null];

    if (narrativeGroup === 'coop_narrative') {
      const themeSeed = this.generateSeed();
      themeOrder = this.shuffleWithSeed(allThemes, themeSeed);
      segmentThemes = themeOrder;
    }

    // 2. Create SideTaskSessionConfig
    await sidetaskTx.sideTaskSessionConfig.create({
      data: {
        sessionId,
        dispatchMode,
        narrativeGroup,
        themeOrder: themeOrder as Prisma.InputJsonValue,
        segment1Theme: segmentThemes[0],
        segment2Theme: segmentThemes[1],
        segment3Theme: segmentThemes[2],
        segment1PlannedCount: 40,
        segment2PlannedCount: 40,
        segment3PlannedCount: 40,
        newsSequenceSeed: this.generateSeed(),
        distributionVersion: 'v1',
      },
    });

    // 3. For each formal work segment (workSegment 1/2/3 → segmentIndex 1/3/5)
    const usedItemCodes = new Set<string>();

    for (let workSegment = 1; workSegment <= 3; workSegment++) {
      const segmentIndex = workSegment * 2 - 1; // 1→1, 2→3, 3→5
      const segmentTheme = segmentThemes[workSegment - 1];

      // Fetch available items
      const neutralItems = await sidetaskTx.sideTaskItem.findMany({
        where: {
          isActive: true,
          poolType: '普通中性池',
          workSegment,
          itemCode: { notIn: Array.from(usedItemCodes) },
        },
        select: { id: true, itemCode: true },
      });

      let coopItems: { id: string; itemCode: string }[] = [];
      if (narrativeGroup === 'coop_narrative' && segmentTheme) {
        coopItems = await sidetaskTx.sideTaskItem.findMany({
          where: {
            isActive: true,
            poolType: '合作叙事池',
            workSegment,
            narrativeCategory: segmentTheme,
            itemCode: { notIn: Array.from(usedItemCodes) },
          },
          select: { id: true, itemCode: true },
        });
      }

      // Determine how many to sample from each pool
      const neutralCount = narrativeGroup === 'coop_narrative' ? 20 : 40;
      const coopCount = narrativeGroup === 'coop_narrative' ? 20 : 0;

      if (neutralItems.length < neutralCount) {
        throw new Error(
          `段${workSegment}普通中性池不足：需要${neutralCount}题，仅有${neutralItems.length}题可用`,
        );
      }
      if (coopItems.length < coopCount) {
        throw new Error(
          `段${workSegment}合作叙事池(${segmentTheme ?? 'N/A'})不足：需要${coopCount}题，仅有${coopItems.length}题可用`,
        );
      }

      // Sample using seeded random
      const sampleSeed = `${sessionId}:segment:${workSegment}`;
      const sampledNeutral: { id: string; itemCode: string }[] = this.sampleWithSeed(neutralItems, neutralCount, sampleSeed);
      const sampledCoop: { id: string; itemCode: string }[] = coopCount > 0
        ? this.sampleWithSeed(coopItems, coopCount, `${sampleSeed}:coop`)
        : [];

      // Track used items
      for (const item of [...sampledNeutral, ...sampledCoop]) {
        usedItemCodes.add(item.itemCode);
      }

      // Merge and shuffle
      const allSampled: { id: string; itemCode: string }[] = [...sampledCoop, ...sampledNeutral];
      const shuffled = this.shuffleWithSeed(allSampled, `${sampleSeed}:shuffle`);

      // Create plan records
      for (let queueOrder = 0; queueOrder < shuffled.length; queueOrder++) {
        const item = shuffled[queueOrder];
        await sidetaskTx.sideTaskPlan.create({
          data: {
            sessionId,
            segmentIndex,
            itemId: item.id,
            dispatchMode,
            narrativeGroup,
            themeLabel: segmentTheme,
            queueOrder: queueOrder + 1,
          },
        });
      }
    }
  }

  private sampleWithSeed<T>(items: T[], count: number, seed: string): T[] {
    const shuffled = this.shuffleWithSeed(items, seed);
    return shuffled.slice(0, count);
  }

  private generateCode() {
    return Math.random().toString(36).slice(2, 8).toUpperCase();
  }

  private generateSeed() {
    return randomBytes(16).toString('hex');
  }

  private seedToBoolean(seed: string) {
    const hash = createHash('sha256').update(seed).digest();
    return (hash[0] & 1) === 0;
  }

  private shuffleWithSeed<T>(items: T[], seed: string) {
    const random = this.createSeededRandom(seed);
    const copy = [...items];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
    }
    return copy;
  }

  private createSeededRandom(seed: string) {
    let counter = 0;
    return () => {
      const hash = createHash('sha256').update(`${seed}:${counter}`).digest();
      counter += 1;
      return hash.readUInt32BE(0) / 0x100000000;
    };
  }

  private resolveAssignedRole(
    sessionStatus: SessionStatus,
    participantAId: string | null,
    participantBId: string | null,
    participantId: string,
  ) {
    if (sessionStatus === SessionStatus.WAITING && participantBId === null) {
      return null;
    }
    if (participantAId === participantId) return ParticipantRole.A;
    if (participantBId === participantId) return ParticipantRole.B;
    return null;
  }
}
