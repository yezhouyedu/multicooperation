import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ExperimentCondition,
  experimentBlockSeed,
  generateExperimentBlock,
  generateExperimentSeed,
} from './experiment-conditions';

const DEFAULT_INITIAL_BLOCKS = 60;
const REFILL_BLOCKS = 10;

@Injectable()
export class ExperimentConditionAssignmentService {
  constructor(private readonly prisma: PrismaService) {}

  async createRun(name?: string) {
    const masterSeed = generateExperimentSeed();
    const code = `RUN-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${masterSeed.slice(0, 6).toUpperCase()}`;
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.experimentRun.create({
        data: {
          code,
          name: name?.trim() || code,
          masterSeed,
          initialBlockCount: DEFAULT_INITIAL_BLOCKS,
        },
      });
      await this.appendBlocks(tx, run.id, 1, DEFAULT_INITIAL_BLOCKS, masterSeed);
      return tx.experimentRun.findUniqueOrThrow({ where: { id: run.id } });
    });
  }

  async activateRun(runId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.experimentRun.findUnique({ where: { id: runId } });
      if (!run) throw new NotFoundException('实验局不存在');
      await tx.experimentRun.updateMany({
        where: { status: 'ACTIVE', id: { not: runId } },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      const activatedAt = run.activatedAt ?? new Date();
      const active = await tx.experimentRun.update({
        where: { id: runId },
        data: { status: 'ACTIVE', activatedAt, closedAt: null },
      });
      await tx.experimentConfig.update({
        where: { id: 'default' },
        data: { activeExperimentMode: 'formal', activeExperimentRunId: runId },
      });
      return active;
    });
  }

  async deleteRun(runId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.experimentRun.findUnique({ where: { id: runId } });
      if (!run) throw new NotFoundException('实验局不存在');
      if (run.status === 'ACTIVE') {
        throw new BadRequestException('当前实验局正在使用，请先暂停或切换到其他实验局后再删除');
      }

      const sessionCount = await tx.session.count({ where: { experimentRunId: runId } });
      if (sessionCount > 0) {
        throw new BadRequestException(
          `该实验局仍关联 ${sessionCount} 个 Session，请先在 Session 概览中清理对应被试数据后再删除实验局`,
        );
      }

      await tx.experimentRun.delete({ where: { id: runId } });
      return { id: runId };
    });
  }

  async useManualMode() {
    return this.prisma.$transaction(async (tx) => {
      await tx.experimentRun.updateMany({
        where: { status: 'ACTIVE' },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      await tx.experimentConfig.update({
        where: { id: 'default' },
        data: { activeExperimentMode: 'manual', activeExperimentRunId: null },
      });
      return { ok: true };
    });
  }

  async closeRun(runId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.experimentRun.findUnique({ where: { id: runId } });
      if (!run) throw new NotFoundException('实验局不存在');
      const closed = await tx.experimentRun.update({
        where: { id: runId },
        data: { status: 'CLOSED', closedAt: new Date() },
      });
      await tx.experimentConfig.updateMany({
        where: { activeExperimentRunId: runId },
        data: { activeExperimentMode: 'manual', activeExperimentRunId: null },
      });
      return closed;
    });
  }

  async listRuns() {
    const runs = await this.prisma.experimentRun.findMany({ orderBy: { createdAt: 'desc' } });
    const summaries = await Promise.all(runs.map(async (run) => {
      const [assigned, available, completed, sessionCount, byCondition] = await Promise.all([
        this.prisma.experimentConditionSlot.count({ where: { experimentRunId: run.id, status: 'ASSIGNED' } }),
        this.prisma.experimentConditionSlot.count({ where: { experimentRunId: run.id, status: 'AVAILABLE' } }),
        this.prisma.session.count({ where: { experimentRunId: run.id, status: 'COMPLETED' } }),
        this.prisma.session.count({ where: { experimentRunId: run.id } }),
        this.prisma.experimentConditionSlot.groupBy({
          by: ['experimentCondition'],
          where: { experimentRunId: run.id, status: 'ASSIGNED' },
          _count: { _all: true },
        }),
      ]);
      const currentBlockIndex = assigned === 0 ? 1 : Math.floor((assigned - 1) / 7) + 1;
      return {
        ...run,
        progress: {
          assigned,
          completed,
          sessionCount,
          available,
          currentBlockIndex,
          claimedInCurrentBlock: assigned % 7 || (assigned > 0 ? 7 : 0),
          byCondition: Object.fromEntries(byCondition.map((row) => [row.experimentCondition, row._count._all])),
        },
      };
    }));
    return summaries;
  }

  async claimNextSlot(tx: Prisma.TransactionClient, runId: string, sessionId: string, sessionCode: string) {
    const existing = await tx.experimentConditionSlot.findUnique({ where: { assignedSessionId: sessionId } });
    if (existing) return this.toAssignment(existing);

    let slot = await tx.experimentConditionSlot.findFirst({
      where: { experimentRunId: runId, status: 'AVAILABLE' },
      orderBy: { globalPosition: 'asc' },
    });
    if (!slot) {
      const run = await tx.experimentRun.findUnique({ where: { id: runId } });
      if (!run || run.status !== 'ACTIVE') throw new BadRequestException('正式实验局不可用');
      await this.appendBlocks(tx, run.id, run.generatedBlockCount + 1, REFILL_BLOCKS, run.masterSeed);
      slot = await tx.experimentConditionSlot.findFirstOrThrow({
        where: { experimentRunId: runId, status: 'AVAILABLE' },
        orderBy: { globalPosition: 'asc' },
      });
    }

    const assignedAt = new Date();
    const claimed = await tx.experimentConditionSlot.updateMany({
      where: { id: slot.id, status: 'AVAILABLE', assignedSessionId: null },
      data: { status: 'ASSIGNED', assignedSessionId: sessionId, assignedSessionCode: sessionCode, assignedAt },
    });
    if (claimed.count !== 1) {
      throw new Prisma.PrismaClientKnownRequestError('Experiment condition slot already claimed', {
        code: 'P2034',
        clientVersion: '',
      });
    }
    return this.toAssignment({ ...slot, assignedAt });
  }

  private async appendBlocks(
    tx: Prisma.TransactionClient,
    runId: string,
    firstBlockIndex: number,
    count: number,
    masterSeed: string,
  ) {
    const data = [];
    for (let offset = 0; offset < count; offset += 1) {
      const blockIndex = firstBlockIndex + offset;
      const blockSeed = experimentBlockSeed(masterSeed, blockIndex);
      const conditions = generateExperimentBlock(masterSeed, blockIndex);
      for (let position = 0; position < conditions.length; position += 1) {
        data.push({
          experimentRunId: runId,
          blockIndex,
          positionInBlock: position + 1,
          globalPosition: (blockIndex - 1) * conditions.length + position + 1,
          experimentCondition: conditions[position],
          blockSeed,
        });
      }
    }
    await tx.experimentConditionSlot.createMany({ data });
    await tx.experimentRun.update({
      where: { id: runId },
      data: { generatedBlockCount: firstBlockIndex + count - 1 },
    });
  }

  private toAssignment(slot: {
    experimentRunId: string;
    blockIndex: number;
    positionInBlock: number;
    globalPosition: number;
    experimentCondition: string;
    blockSeed: string;
    assignedAt: Date | null;
  }) {
    return {
      experimentRunId: slot.experimentRunId,
      experimentCondition: slot.experimentCondition as ExperimentCondition,
      blockIndex: slot.blockIndex,
      positionInBlock: slot.positionInBlock,
      globalPosition: slot.globalPosition,
      blockSeed: slot.blockSeed,
      assignedAt: slot.assignedAt ?? new Date(),
      method: 'sequential_permuted_block_v1',
    };
  }
}
