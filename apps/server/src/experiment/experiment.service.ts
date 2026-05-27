import {
  BadRequestException,
  Injectable,
  MessageEvent,
  NotFoundException,
} from '@nestjs/common';
import {
  AiLevel,
  ExperimentConfig,
  ExperimentPhase,
  Pairing,
  Participant,
  ParticipantRole,
  Prisma,
  QuestionnaireTemplate,
  RuntimePhase,
  SegmentType,
  Session,
  SessionStatus,
  TaskAssignment,
} from '@prisma/client';
import { Observable, Subject, Subscription } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import { buildMaterialPublicUrl, normalizeMaterials } from '../admin/materials';

type EnterExperimentInput = {
  nickname?: string;
  role?: ParticipantRole;
};

type RecordProgressInput = {
  sessionCode: string;
  role: ParticipantRole;
  stage: string;
  payload?: Prisma.InputJsonValue;
};

type DraftSelector = {
  role: ParticipantRole;
  section?: 'main' | 'feedback';
};

type SnapshotRecord = {
  id: string;
  role: string | null;
  section: string | null;
  payload: Prisma.JsonValue;
  createdAt: Date;
};

type SessionStreamEnvelope = MessageEvent & {
  type: string;
  data: unknown;
};

type RuntimeSession = Session & {
  pairings: (Pairing & {
    participantA: Participant | null;
    participantB: Participant | null;
  })[];
  tasks: TaskAssignment[];
  questionnaireAnswers: { participantId: string; segmentIndex: number }[];
};

type BarrierTarget = 'practice' | 'formal';

@Injectable()
export class ExperimentService {
  private readonly sessionStreams = new Map<string, Subject<SessionStreamEnvelope>>();

  constructor(private readonly prisma: PrismaService) {}

  async createSession(_input: EnterExperimentInput = {}) {
    return {
      ok: false,
      error: 'Legacy endpoint removed. Please use /auth/login.',
    };
  }

  async joinSession(_sessionCode: string, _input: EnterExperimentInput = {}) {
    return {
      ok: false,
      error: 'Legacy endpoint removed. Please use /auth/login.',
    };
  }

  createSessionEventStream(sessionCode: string, participantId?: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let disposed = false;
      let lastRuntimeSignature = '';
      const sessionStream = this.getSessionStream(sessionCode);

      const emitRuntime = async () => {
        if (disposed) return;
        try {
          const runtime = await this.getRuntime(sessionCode, participantId);
          const signature = JSON.stringify(runtime);
          if (signature === lastRuntimeSignature) return;
          lastRuntimeSignature = signature;
          subscriber.next({ type: 'runtime', data: runtime });
        } catch (error) {
          subscriber.next({
            type: 'runtime_error',
            data: {
              message:
                error instanceof Error ? error.message : `Failed to refresh runtime for ${sessionCode}`,
            },
          });
        }
      };

      const sessionSubscription: Subscription = sessionStream.subscribe((event) => {
        if (event.type === 'runtime_invalidated') {
          void emitRuntime();
          return;
        }
        subscriber.next(event);
      });

      const intervalHandle = setInterval(() => {
        void emitRuntime();
      }, 2000);

      void emitRuntime();

      return () => {
        disposed = true;
        clearInterval(intervalHandle);
        sessionSubscription.unsubscribe();
      };
    });
  }

  async startPractice(sessionCode: string) {
    const config = await this.ensureConfig();
    const session = await this.prisma.session.findUnique({ where: { code: sessionCode } });
    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);

    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.startPracticePhase(tx, session.id, config, now);
    });

    this.emitRuntimeInvalidated(sessionCode);
    return { ok: true };
  }

  async readyPractice(sessionCode: string, participantId: string) {
    const result = await this.markBarrierReady(sessionCode, participantId, 'practice');
    this.emitRuntimeInvalidated(sessionCode);
    return result;
  }

  async completePractice(sessionCode: string) {
    const session = await this.prisma.session.findUnique({ where: { code: sessionCode } });
    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);
    await this.startFormalWorkSegment(session.id, 1);
    this.emitRuntimeInvalidated(sessionCode);
    return { ok: true };
  }

  async readyFormal(sessionCode: string, participantId: string) {
    const result = await this.markBarrierReady(sessionCode, participantId, 'formal');
    this.emitRuntimeInvalidated(sessionCode);
    return result;
  }

  async getSessionState(sessionCode: string) {
    const synced = await this.syncRuntime(sessionCode);
    const session = synced.session;
    const pairing = session.pairings[0] ?? null;

    return {
      ok: true,
      session: {
        id: session.id,
        code: session.code,
        status: session.status,
        runtimePhase: session.runtimePhase,
        currentSegmentIndex: session.currentSegmentIndex,
        currentSegmentType: session.currentSegmentType,
        createdAt: session.createdAt,
      },
      pairing: pairing
        ? {
            id: pairing.id,
            participantA: pairing.participantA
              ? {
                  id: pairing.participantA.id,
                  nickname: pairing.participantA.nickname,
                  role: pairing.participantA.role,
                  phone: pairing.participantA.phone,
                }
              : null,
            participantB: pairing.participantB
              ? {
                  id: pairing.participantB.id,
                  nickname: pairing.participantB.nickname,
                  role: pairing.participantB.role,
                  phone: pairing.participantB.phone,
                }
              : null,
          }
        : null,
    };
  }

  async getRuntime(sessionCode: string, participantId?: string) {
    const synced = await this.syncRuntime(sessionCode);
    const session = synced.session;
    const config = synced.config;
    const pairing = session.pairings[0];
    if (!pairing) throw new BadRequestException('Session pairing record is missing');

    const assignedRole = this.resolveParticipantRole(pairing, participantId);
    const roleTask =
      assignedRole === ParticipantRole.B
        ? session.tasks.find((task) => task.phase === ExperimentPhase.FORMAL && !task.bCompletedAt)
        : session.tasks.find((task) => task.phase === ExperimentPhase.FORMAL && !task.aSubmittedAt);

    const currentCompany = roleTask
      ? await this.prisma.company.findUnique({ where: { id: roleTask.companyId } })
      : null;
    const fallbackCompany =
      currentCompany && !this.hasUsableMaterials(currentCompany)
        ? await this.prisma.company.findUnique({ where: { id: 'company-p01-baseline' } })
        : null;
    const syncState = await this.getSyncState(session, assignedRole);

    return {
      ok: true,
      assignedRole,
      phase: this.mapRuntimePhase(session.runtimePhase),
      segmentIndex: session.currentSegmentIndex,
      segmentType: session.currentSegmentType,
      segmentRemainingSeconds: this.getRemainingSeconds(session.currentSegmentEnds),
      currentTask: roleTask
        ? {
            id: roleTask.id,
            sortOrder: roleTask.sortOrder,
            sequenceIndex: roleTask.sequenceIndex,
            company: currentCompany ? this.serializeCompany(currentCompany, assignedRole, fallbackCompany) : null,
            aSubmittedAt: roleTask.aSubmittedAt,
            aUnlockedForBAt: roleTask.aUnlockedForBAt,
            bViewedAInfoAt: roleTask.bViewedAInfoAt,
            bCompletedAt: roleTask.bCompletedAt,
          }
        : null,
      taskRemainingSeconds:
        assignedRole === ParticipantRole.A && roleTask ? this.getRemainingSeconds(roleTask.aDeadlineAt) : null,
      aInfoUnlocked: Boolean(roleTask?.aUnlockedForBAt),
      bHasViewedAInfo: Boolean(roleTask?.bViewedAInfoAt),
      bCanSubmit: Boolean(roleTask?.aUnlockedForBAt),
      isIdle: !roleTask,
      isFrozen: Boolean(roleTask?.frozenAt),
      questionnaireSubmitted: participantId
        ? session.questionnaireAnswers.some(
            (answer) =>
              answer.participantId === participantId &&
              answer.segmentIndex === session.currentSegmentIndex,
          )
        : false,
      aiLevel: this.getCurrentAiLevel(config, session.currentSegmentIndex),
      ...(await this.getSideTaskRuntime(session.id, session.currentSegmentIndex, config, participantId)),
      syncState,
      questionnaireTemplate:
        session.runtimePhase === RuntimePhase.FORMAL_BREAK && config.activeQuestionnaireTemplate
          ? {
              id: config.activeQuestionnaireTemplate.id,
              title: config.activeQuestionnaireTemplate.title,
              items: config.activeQuestionnaireTemplate.items,
            }
          : null,
    };
  }

  async recordProgress(input: RecordProgressInput) {
    const session = await this.prisma.session.findUnique({
      where: { code: input.sessionCode },
      include: {
        pairings: {
          include: {
            participantA: true,
            participantB: true,
          },
        },
      },
    });

    if (!session) throw new NotFoundException(`Session ${input.sessionCode} not found`);
    const pairing = session.pairings[0];
    if (!pairing) throw new BadRequestException('Session pairing record is missing');

    const participant = input.role === ParticipantRole.A ? pairing.participantA : pairing.participantB;
    if (!participant) {
      throw new BadRequestException(`Participant with role ${input.role} has not joined yet`);
    }

    const progress = await this.prisma.taskProgress.create({
      data: {
        sessionId: session.id,
        participantId: participant.id,
        stage: input.stage,
        payload: input.payload,
      },
    });

    const eventPayload = {
      id: progress.id,
      stage: progress.stage,
      payload: progress.payload,
      createdAt: progress.createdAt,
      participantId: participant.id,
      role: input.role,
    };
    this.emitSessionEvent(input.sessionCode, {
      type: input.stage,
      data: eventPayload,
    });

    return {
      ok: true,
      progress: {
        id: progress.id,
        stage: progress.stage,
        sessionId: progress.sessionId,
        participantId: progress.participantId,
        createdAt: progress.createdAt,
      },
    };
  }

  async getSessionProgress(sessionCode: string) {
    const session = await this.prisma.session.findUnique({
      where: { code: sessionCode },
      include: {
        progresses: {
          include: { participant: true },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);

    return {
      ok: true,
      session: {
        id: session.id,
        code: session.code,
        status: session.status,
      },
      progresses: session.progresses.map((progress) => ({
        id: progress.id,
        stage: progress.stage,
        payload: progress.payload,
        createdAt: progress.createdAt,
        participant: {
          id: progress.participant.id,
          role: progress.participant.role,
          nickname: progress.participant.nickname,
          phone: progress.participant.phone,
        },
      })),
    };
  }

  async getSessionTasks(sessionCode: string) {
    const synced = await this.syncRuntime(sessionCode);
    const session = synced.session;
    const companies = await this.prisma.company.findMany({
      where: { id: { in: session.tasks.map((task) => task.companyId) } },
    });
    const companyMap = new Map(companies.map((company) => [company.id, company]));
    const baselineCompany = companyMap.get('company-p01-baseline')
      ?? (await this.prisma.company.findUnique({ where: { id: 'company-p01-baseline' } }));

    return {
      ok: true,
      tasks: session.tasks.map((task) => ({
        id: task.id,
        phase: task.phase,
        sortOrder: task.sortOrder,
        sequenceIndex: task.sequenceIndex,
        aSubmittedAt: task.aSubmittedAt,
        aUnlockedForBAt: task.aUnlockedForBAt,
        bViewedAInfoAt: task.bViewedAInfoAt,
        bCanSubmitAt: task.bCanSubmitAt,
        bCompletedAt: task.bCompletedAt,
        frozenAt: task.frozenAt,
        company: companyMap.get(task.companyId)
          ? this.serializeCompany(
              companyMap.get(task.companyId)!,
              null,
              this.hasUsableMaterials(companyMap.get(task.companyId)!)
                ? null
                : baselineCompany,
            )
          : null,
        aDraft: task.aDraft,
        bDraft: task.bDraft,
        bFeedbackDraft: task.bFeedbackDraft,
      })),
    };
  }

  async getTaskDraft(sessionCode: string, taskId: string, selector: DraftSelector) {
    const session = await this.prisma.session.findUnique({ where: { code: sessionCode } });
    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);

    const task = await this.prisma.taskAssignment.findFirst({
      where: { id: taskId, sessionId: session.id },
    });
    if (!task) throw new NotFoundException('Task not found');

    return {
      ok: true,
      taskId: task.id,
      payload: this.pickDraftPayload(task, selector),
    };
  }

  async getTaskSnapshots(sessionCode: string, taskId: string) {
    const session = await this.prisma.session.findUnique({ where: { code: sessionCode } });
    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);

    const task = await this.prisma.taskAssignment.findFirst({
      where: { id: taskId, sessionId: session.id },
      include: { snapshots: { orderBy: { createdAt: 'desc' } } },
    });
    if (!task) throw new NotFoundException('Task not found');

    return {
      ok: true,
      taskId: task.id,
      snapshots: task.snapshots,
    };
  }

  async restoreLatestSnapshot(sessionCode: string, taskId: string) {
    const session = await this.prisma.session.findUnique({ where: { code: sessionCode } });
    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);
    const task = await this.prisma.taskAssignment.findFirst({ where: { id: taskId, sessionId: session.id } });
    if (!task) throw new NotFoundException('Task not found');

    const latestSnapshots = (await this.prisma.taskSnapshot.findMany({
      where: {
        sessionId: session.id,
        taskAssignmentId: task.id,
        snapshotType: 'work_segment_freeze',
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })) as SnapshotRecord[];
    if (latestSnapshots.length === 0) {
      return { ok: true, restored: false };
    }

    const data: Prisma.TaskAssignmentUpdateInput = {};
    for (const snapshot of latestSnapshots) {
      if (snapshot.section === 'main' && snapshot.role === 'A') data.aDraft = this.toDraftValue(snapshot.payload);
      if (snapshot.section === 'main' && snapshot.role === 'B') data.bDraft = this.toDraftValue(snapshot.payload);
      if (snapshot.section === 'feedback' && snapshot.role === 'B') {
        data.bFeedbackDraft = this.toDraftValue(snapshot.payload);
      }
    }

    await this.prisma.taskAssignment.update({
      where: { id: task.id },
      data,
    });

    const latestFreeze = latestSnapshots[0];
    await this.prisma.taskSnapshot.create({
      data: {
        sessionId: session.id,
        taskAssignmentId: task.id,
        snapshotType: 'restored_from_freeze',
        scope: 'mainline',
        segmentIndex: null,
        role: null,
        section: null,
        restoreSourceSnapshotId: latestFreeze.id,
        takenReason: 'manual_restore_latest',
        label: `恢复自冻结快照 ${latestFreeze.createdAt.toISOString()}`,
        payload: {
          restoredSections: latestSnapshots.map((snapshot) => ({
            id: snapshot.id,
            role: snapshot.role,
            section: snapshot.section,
          })),
        } as Prisma.InputJsonValue,
      } as Prisma.TaskSnapshotUncheckedCreateInput,
    });

    this.emitRuntimeInvalidated(sessionCode);
    return { ok: true, restored: true };
  }

  async saveTaskDraft(
    sessionCode: string,
    taskId: string,
    body: {
      role: ParticipantRole;
      section?: 'main' | 'feedback';
      payload: Prisma.InputJsonValue;
    },
  ) {
    const session = await this.prisma.session.findUnique({ where: { code: sessionCode } });
    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);

    const task = await this.prisma.taskAssignment.findFirst({ where: { id: taskId, sessionId: session.id } });
    if (!task) throw new NotFoundException('Task not found');

    const data: Prisma.TaskAssignmentUpdateInput = {};
    if (body.role === ParticipantRole.A) {
      data.aDraft = body.payload;
    } else if (body.section === 'feedback') {
      data.bFeedbackDraft = body.payload;
    } else {
      data.bDraft = body.payload;
    }

    await this.prisma.taskAssignment.update({ where: { id: task.id }, data });
    await this.recordProgress({
      sessionCode,
      role: body.role,
      stage:
        body.role === ParticipantRole.A
          ? 'a_form_saved'
          : body.section === 'feedback'
            ? 'b_feedback_saved'
            : 'b_workspace_saved',
      payload: { taskId, ...(body.payload as object) },
    });

    this.emitRuntimeInvalidated(sessionCode);
    return { ok: true };
  }

  async viewAInfo(sessionCode: string, taskId: string) {
    const session = await this.prisma.session.findUnique({ where: { code: sessionCode } });
    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);

    const task = await this.prisma.taskAssignment.findFirst({ where: { id: taskId, sessionId: session.id } });
    if (!task) throw new NotFoundException('Task not found');
    if (!task.aUnlockedForBAt) throw new BadRequestException('A 信息尚未解锁');

    const now = new Date();
    const updated = await this.prisma.taskAssignment.update({
      where: { id: task.id },
      data: {
        bViewedAInfoAt: task.bViewedAInfoAt ?? now,
        bCanSubmitAt: task.bCanSubmitAt ?? now,
      },
    });

    await this.recordProgress({
      sessionCode,
      role: ParticipantRole.B,
      stage: 'b_viewed_a_info',
      payload: { taskId },
    });
    this.emitRuntimeInvalidated(sessionCode);

    return { ok: true, task: updated };
  }

  async getQuestionnaire(sessionCode: string) {
    const synced = await this.syncRuntime(sessionCode);
    if (synced.session.runtimePhase !== RuntimePhase.FORMAL_BREAK) {
      return { ok: true, questionnaire: null };
    }

    return {
      ok: true,
      questionnaire: synced.config.activeQuestionnaireTemplate
        ? {
            id: synced.config.activeQuestionnaireTemplate.id,
            title: synced.config.activeQuestionnaireTemplate.title,
            items: synced.config.activeQuestionnaireTemplate.items,
          }
        : null,
    };
  }

  async submitQuestionnaire(sessionCode: string, participantId: string, answers: Prisma.InputJsonValue) {
    const synced = await this.syncRuntime(sessionCode);
    const participant = await this.prisma.participant.findUnique({ where: { id: participantId } });
    if (!participant) throw new NotFoundException('Participant not found');

    await this.prisma.questionnaireResponse.create({
      data: {
        sessionId: synced.session.id,
        participantId,
        templateId: synced.config.activeQuestionnaireTemplate?.id,
        phase: ExperimentPhase.FORMAL,
        segmentIndex: synced.session.currentSegmentIndex,
        answers,
      },
    });

    await this.prisma.taskProgress.create({
      data: {
        sessionId: synced.session.id,
        participantId,
        stage: 'break_questionnaire_submitted',
        payload: answers,
      },
    });

    this.emitSessionEvent(sessionCode, {
      type: 'break_questionnaire_submitted',
      data: { participantId, payload: answers },
    });
    this.emitRuntimeInvalidated(sessionCode);

    return { ok: true };
  }

  async answerSideTask(
    sessionCode: string,
    planId: string,
    participantId: string,
    answer: string,
  ) {
    const synced = await this.syncRuntime(sessionCode);
    const plan = await this.prisma.sideTaskPlan.findUnique({
      where: { id: planId },
      select: { id: true, sessionId: true },
    });
    if (!plan || plan.sessionId !== synced.session.id) {
      throw new NotFoundException('副线题目不存在');
    }

    // Check if already answered (idempotent)
    const existing = await this.prisma.sideTaskExposureLog.findFirst({
      where: { sideTaskPlanId: planId, eventType: 'side_task_answered' },
      select: { id: true },
    });

    if (!existing) {
      await this.prisma.sideTaskExposureLog.create({
        data: {
          sessionId: synced.session.id,
          participantId,
          sideTaskPlanId: planId,
          eventType: 'side_task_answered',
          payload: { answer } as Prisma.InputJsonValue,
        },
      });
    }

    this.emitRuntimeInvalidated(sessionCode);
    return { ok: true };
  }

  async recordSideTaskExposure(
    sessionCode: string,
    planId: string,
    participantId: string,
    eventType: string,
    payload?: Record<string, unknown>,
  ) {
    const synced = await this.syncRuntime(sessionCode);
    const plan = await this.prisma.sideTaskPlan.findUnique({
      where: { id: planId },
      select: { id: true, sessionId: true, releasedAt: true },
    });
    if (!plan || plan.sessionId !== synced.session.id) {
      throw new NotFoundException('副线题目不存在');
    }

    const now = new Date();

    // For side_task_released: update plan.releasedAt (idempotent)
    if (eventType === 'side_task_released' && !plan.releasedAt) {
      await this.prisma.sideTaskPlan.update({
        where: { id: planId },
        data: { releasedAt: now },
      });
    }

    await this.prisma.sideTaskExposureLog.create({
      data: {
        sessionId: synced.session.id,
        participantId,
        sideTaskPlanId: planId,
        eventType,
        eventAt: now,
        payload: (payload ?? null) as Prisma.InputJsonValue,
      },
    });

    if (eventType === 'side_task_released') {
      this.emitRuntimeInvalidated(sessionCode);
    }

    return { ok: true };
  }

  async aSubmitTask(sessionCode: string, taskId: string) {
    const synced = await this.syncRuntime(sessionCode);
    const session = synced.session;
    const task = session.tasks.find((item) => item.id === taskId);
    if (!task) throw new NotFoundException('Task not found');

    const now = new Date();
    if (task.aDeadlineAt && now < task.aDeadlineAt) {
      throw new BadRequestException('5 分钟窗口尚未结束，请继续完成尽调表');
    }
    await this.prisma.taskAssignment.update({
      where: { id: taskId },
      data: {
        aSubmittedAt: task.aSubmittedAt ?? now,
        aUnlockedForBAt: task.aUnlockedForBAt ?? now,
        aRemainingSeconds: this.computeRemainingSeconds(task.aDeadlineAt),
      },
    });

    await this.recordProgress({
      sessionCode,
      role: ParticipantRole.A,
      stage: 'a_task_submitted',
      payload: { taskId, sortOrder: task.sortOrder },
    });
    this.emitRuntimeInvalidated(sessionCode);

    return { ok: true, taskId };
  }

  async bCompleteTask(sessionCode: string, taskId: string) {
    const synced = await this.syncRuntime(sessionCode);
    const session = synced.session;
    const task = session.tasks.find((item) => item.id === taskId);
    if (!task) throw new NotFoundException('Task not found');
    if (!task.aUnlockedForBAt) throw new BadRequestException('A 信息尚未解锁');

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.taskAssignment.update({
        where: { id: taskId },
        data: { bCompletedAt: new Date() },
      });

      const participantB = session.pairings[0]?.participantB;
      if (participantB) {
        await tx.taskProgress.create({
          data: {
            sessionId: session.id,
            participantId: participantB.id,
            stage: 'b_task_completed',
            payload: { taskId, sortOrder: task.sortOrder },
          },
        });
      }

      const remaining = await tx.taskAssignment.count({
        where: { sessionId: session.id, phase: ExperimentPhase.FORMAL, bCompletedAt: null },
      });
      const allDone = remaining === 0;

      if (allDone) {
        await tx.session.update({
          where: { id: session.id },
          data: { status: SessionStatus.COMPLETED, runtimePhase: RuntimePhase.END },
        });
      }

      return { ok: true, taskId, allDone };
    });

    this.emitSessionEvent(sessionCode, {
      type: 'b_task_completed',
      data: { taskId, sortOrder: task.sortOrder },
    });
    this.emitRuntimeInvalidated(sessionCode);

    return result;
  }

  private async markBarrierReady(sessionCode: string, participantId: string, target: BarrierTarget) {
    const config = await this.ensureConfig();
    const stage = target === 'practice' ? 'practice_ready' : 'formal_ready';
    const waitingPhase = target === 'practice' ? RuntimePhase.PRACTICE_READY : RuntimePhase.FORMAL_READY;
    const activePhase = target === 'practice' ? RuntimePhase.PRACTICE : RuntimePhase.FORMAL_WORK;

    const result = await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { code: sessionCode },
        include: {
          pairings: { include: { participantA: true, participantB: true } },
        },
      });
      if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);

      const pairing = session.pairings[0];
      if (!pairing) throw new BadRequestException('Session pairing record is missing');
      if (participantId !== pairing.participantAId && participantId !== pairing.participantBId) {
        throw new BadRequestException('Participant does not belong to this session');
      }

      if (session.runtimePhase === activePhase) {
        return { ok: true, started: true, waiting: false };
      }

      const expectedPhase: RuntimePhase[] =
        target === 'practice'
          ? [RuntimePhase.INSTRUCTION, RuntimePhase.PRACTICE_READY]
          : [RuntimePhase.PRACTICE, RuntimePhase.FORMAL_READY];
      if (!expectedPhase.includes(session.runtimePhase)) {
        throw new BadRequestException('Current session phase does not support this readiness action');
      }

      const existing = await tx.taskProgress.findFirst({
        where: { sessionId: session.id, participantId, stage },
      });
      if (!existing) {
        await tx.taskProgress.create({
          data: {
            sessionId: session.id,
            participantId,
            stage,
            payload: { target } satisfies Prisma.InputJsonValue,
          },
        });
      }

      const readyIds = new Set(
        (
          await tx.taskProgress.findMany({
            where: { sessionId: session.id, stage },
            select: { participantId: true },
          })
        ).map((item) => item.participantId),
      );
      const aReady = Boolean(pairing.participantAId && readyIds.has(pairing.participantAId));
      const bReady = Boolean(pairing.participantBId && readyIds.has(pairing.participantBId));
      const bothReady = aReady && bReady;
      const now = new Date();

      if (!bothReady) {
        await tx.session.update({
          where: { id: session.id },
          data: {
            runtimePhase: waitingPhase,
            currentSegmentStarts: null,
            currentSegmentEnds: null,
          },
        });
        return { ok: true, started: false, waiting: true };
      }

      if (target === 'practice') {
        await this.startPracticePhase(tx, session.id, config, now);
      } else {
        await this.startFormalWorkSegmentTx(tx, session.id, 1, config, now);
      }

      return { ok: true, started: true, waiting: false };
    });

    return result;
  }

  private async syncRuntime(sessionCode: string) {
    const config = await this.ensureConfig();

    await this.prisma.$transaction(async (tx) => {
      const session = await tx.session.findUnique({
        where: { code: sessionCode },
        include: {
          pairings: { include: { participantA: true, participantB: true } },
          tasks: { where: { phase: ExperimentPhase.FORMAL }, orderBy: { sortOrder: 'asc' } },
          questionnaireAnswers: true,
        },
      });

      if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);
      if (session.runtimePhase === RuntimePhase.END || session.status === SessionStatus.COMPLETED) return;

      const now = new Date();

      if (session.runtimePhase === RuntimePhase.FORMAL_WORK && session.currentSegmentEnds && session.currentSegmentEnds <= now) {
        const currentATask = session.tasks.find((task) => !task.aSubmittedAt);
        if (currentATask && currentATask.aStartedAt && !currentATask.aSubmittedAt) {
          const resumedAt = currentATask.resumedAt ?? currentATask.aStartedAt;
          const elapsedSeconds = Math.max(0, Math.floor((now.getTime() - resumedAt.getTime()) / 1000));
          const remaining = Math.max(0, (currentATask.aRemainingSeconds || 300) - elapsedSeconds);
          await tx.taskAssignment.update({
            where: { id: currentATask.id },
            data: {
              frozenAt: now,
              aDeadlineAt: null,
              aRemainingSeconds: remaining,
            },
          });
        }
        await this.advanceAfterWork(tx, session, config, now);
        return;
      }

      if (session.runtimePhase === RuntimePhase.FORMAL_BREAK && session.currentSegmentEnds && session.currentSegmentEnds <= now) {
        await this.advanceAfterBreak(tx, session, config, now);
        return;
      }

      if (session.runtimePhase === RuntimePhase.FORMAL_WORK) {
        const currentATask = session.tasks.find((task) => !task.aSubmittedAt);
        if (currentATask) {
          if (!currentATask.aStartedAt || currentATask.frozenAt) {
            await this.activateCurrentATask(tx, currentATask, session.currentSegmentEnds, now);
          }
        }
      }
    });

    const session = await this.prisma.session.findUnique({
      where: { code: sessionCode },
      include: {
        pairings: { include: { participantA: true, participantB: true } },
        tasks: { orderBy: { sortOrder: 'asc' } },
        questionnaireAnswers: true,
      },
    });
    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);

    await this.autoUnlockATask(sessionCode, session);

    const refetched = await this.prisma.session.findUnique({
      where: { code: sessionCode },
      include: {
        pairings: { include: { participantA: true, participantB: true } },
        tasks: { orderBy: { sortOrder: 'asc' } },
        questionnaireAnswers: true,
      },
    });
    if (!refetched) throw new NotFoundException(`Session ${sessionCode} not found`);

    return {
      session: refetched,
      config,
    } as {
      session: RuntimeSession;
      config: ExperimentConfig & { activeQuestionnaireTemplate: QuestionnaireTemplate | null };
    };
  }

  private async autoUnlockATask(sessionCode: string, session: RuntimeSession) {
    if (session.runtimePhase !== RuntimePhase.FORMAL_WORK) return;

    const currentATask = session.tasks.find((task) => !task.aSubmittedAt);
    if (!currentATask?.aDeadlineAt || currentATask.aUnlockedForBAt) return;
    if (currentATask.aDeadlineAt > new Date()) return;

    const pairing = session.pairings[0];
    const snapshotAt = currentATask.aDeadlineAt;

    await this.prisma.$transaction(async (tx) => {
      await tx.taskAssignment.update({
        where: { id: currentATask.id },
        data: {
          aSubmittedAt: snapshotAt,
          aUnlockedForBAt: snapshotAt,
          bCanSubmitAt: snapshotAt,
          aRemainingSeconds: 0,
        },
      });

      if (pairing?.participantAId) {
        await tx.taskProgress.create({
          data: {
            sessionId: session.id,
            participantId: pairing.participantAId,
            stage: 'a_task_auto_submitted',
            payload: { taskId: currentATask.id, sortOrder: currentATask.sortOrder },
          },
        });
      }

      if (pairing?.participantBId) {
        await tx.taskSnapshot.create({
          data: {
            sessionId: session.id,
            taskAssignmentId: currentATask.id,
            participantId: pairing.participantBId,
            snapshotType: 'b_five_minute_snapshot',
            scope: 'mainline',
            role: 'B',
            section: 'main',
            segmentIndex: session.currentSegmentIndex,
            takenReason: 'a_info_unlocked',
            label: `5分钟快照 ${snapshotAt.toISOString()}`,
            payload: {
              bDraft: currentATask.bDraft,
              bFeedbackDraft: currentATask.bFeedbackDraft,
            } as Prisma.InputJsonValue,
          } as Prisma.TaskSnapshotUncheckedCreateInput,
        });
      }
    });

    this.emitSessionEvent(sessionCode, {
      type: 'a_task_auto_submitted',
      data: { taskId: currentATask.id, sortOrder: currentATask.sortOrder },
    });
    this.emitRuntimeInvalidated(sessionCode);
  }

  private async advanceAfterWork(
    tx: Prisma.TransactionClient,
    session: RuntimeSession,
    config: ExperimentConfig,
    now: Date,
  ) {
    const currentTask = session.tasks.find((task) => !task.bCompletedAt || !task.aSubmittedAt);
    if (currentTask) {
      await this.snapshotTaskSection(tx, session.id, currentTask.id, {
        snapshotType: 'work_segment_freeze',
        scope: 'mainline',
        role: 'A',
        section: 'main',
        segmentIndex: session.currentSegmentIndex,
        takenReason: 'segment_transition_to_break',
        label: `工作段冻结快照 A 主表 ${now.toISOString()}`,
        payload: currentTask.aDraft,
      });
      await this.snapshotTaskSection(tx, session.id, currentTask.id, {
        snapshotType: 'work_segment_freeze',
        scope: 'mainline',
        role: 'B',
        section: 'main',
        segmentIndex: session.currentSegmentIndex,
        takenReason: 'segment_transition_to_break',
        label: `工作段冻结快照 投资判断 ${now.toISOString()}`,
        payload: currentTask.bDraft,
      });
      await this.snapshotTaskSection(tx, session.id, currentTask.id, {
        snapshotType: 'work_segment_freeze',
        scope: 'mainline',
        role: 'B',
        section: 'feedback',
        segmentIndex: session.currentSegmentIndex,
        takenReason: 'segment_transition_to_break',
        label: `工作段冻结快照 反馈表 ${now.toISOString()}`,
        payload: currentTask.bFeedbackDraft,
      });
    }

    await tx.sessionSegmentState.updateMany({
      where: { sessionId: session.id, segmentIndex: session.currentSegmentIndex },
      data: { completedAt: now },
    });

    // Archive unanswered side task plans for this segment
    const sidetaskTx = tx as Prisma.TransactionClient & {
      sideTaskPlan: typeof this.prisma.sideTaskPlan;
    };
    await sidetaskTx.sideTaskPlan.updateMany({
      where: {
        sessionId: session.id,
        segmentIndex: session.currentSegmentIndex,
        isArchivedAtSegmentEnd: false,
      },
      data: { isArchivedAtSegmentEnd: true },
    });

    if (session.currentSegmentIndex >= 5) {
      await tx.session.update({
        where: { id: session.id },
        data: {
          runtimePhase: RuntimePhase.END,
          status: SessionStatus.COMPLETED,
          currentSegmentEnds: now,
        },
      });
      return;
    }

    const breakEnds = new Date(now.getTime() + config.breakDurationMinutes * 60 * 1000);
    await tx.session.update({
      where: { id: session.id },
      data: {
        runtimePhase: RuntimePhase.FORMAL_BREAK,
        currentPhase: ExperimentPhase.FORMAL,
        currentSegmentIndex: session.currentSegmentIndex + 1,
        currentSegmentType: SegmentType.BREAK,
        currentSegmentStarts: now,
        currentSegmentEnds: breakEnds,
      },
    });
    await tx.sessionSegmentState.updateMany({
      where: { sessionId: session.id, segmentIndex: session.currentSegmentIndex + 1 },
      data: { startedAt: now, endsAt: breakEnds },
    });
  }

  private async advanceAfterBreak(
    tx: Prisma.TransactionClient,
    session: RuntimeSession,
    config: ExperimentConfig,
    now: Date,
  ) {
    await tx.sessionSegmentState.updateMany({
      where: { sessionId: session.id, segmentIndex: session.currentSegmentIndex },
      data: { completedAt: now },
    });

    const nextWorkIndex = session.currentSegmentIndex + 1;
    if (nextWorkIndex > 5) {
      await tx.session.update({
        where: { id: session.id },
        data: {
          runtimePhase: RuntimePhase.END,
          status: SessionStatus.COMPLETED,
          currentSegmentEnds: now,
        },
      });
      return;
    }

    await this.startFormalWorkSegmentTx(tx, session.id, nextWorkIndex, config, now, false);

    const nextTask = session.tasks.find((task) => !task.bCompletedAt || !task.aSubmittedAt);
    if (nextTask) {
      await this.restoreTaskDraftsFromLatestFreeze(tx, session.id, nextTask.id, nextWorkIndex);
    }
  }

  private async startFormalWorkSegment(sessionId: string, segmentIndex: number) {
    const config = await this.ensureConfig();
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      await this.startFormalWorkSegmentTx(tx, sessionId, segmentIndex, config, now);
    });
  }

  private resolveParticipantRole(pairing: Pairing, participantId?: string) {
    if (participantId && pairing.participantAId === participantId) return ParticipantRole.A;
    if (participantId && pairing.participantBId === participantId) return ParticipantRole.B;
    return pairing.participantAId ? ParticipantRole.A : ParticipantRole.B;
  }

  private mapRuntimePhase(phase: RuntimePhase) {
    switch (phase) {
      case RuntimePhase.INSTRUCTION:
        return 'instruction';
      case RuntimePhase.PRACTICE_READY:
        return 'practice_ready';
      case RuntimePhase.PRACTICE:
        return 'practice';
      case RuntimePhase.FORMAL_READY:
        return 'formal_ready';
      case RuntimePhase.FORMAL_WORK:
        return 'formal_work';
      case RuntimePhase.FORMAL_BREAK:
        return 'formal_break';
      case RuntimePhase.END:
      default:
        return 'end';
    }
  }

  private async getSyncState(session: RuntimeSession, assignedRole: ParticipantRole) {
    const barrier =
      session.runtimePhase === RuntimePhase.PRACTICE_READY
        ? 'practice'
        : session.runtimePhase === RuntimePhase.FORMAL_READY
          ? 'formal'
          : null;
    if (!barrier) return null;

    const stage = barrier === 'practice' ? 'practice_ready' : 'formal_ready';
    const progressRows = await this.prisma.taskProgress.findMany({
      where: { sessionId: session.id, stage },
      select: { participantId: true },
    });
    const readyIds = new Set(progressRows.map((item) => item.participantId));
    const readyRoles: ParticipantRole[] = [];
    if (session.pairings[0]?.participantAId && readyIds.has(session.pairings[0].participantAId!)) {
      readyRoles.push(ParticipantRole.A);
    }
    if (session.pairings[0]?.participantBId && readyIds.has(session.pairings[0].participantBId!)) {
      readyRoles.push(ParticipantRole.B);
    }

    return {
      barrier,
      readyRoles,
      readyCount: readyRoles.length,
      selfReady: readyRoles.includes(assignedRole),
      waitingForPeer: readyRoles.length < 2,
    };
  }

  private async startPracticePhase(
    tx: Prisma.TransactionClient,
    sessionId: string,
    config: ExperimentConfig,
    now: Date,
  ) {
    const endsAt = new Date(now.getTime() + config.workDurationMinutes * 60 * 1000);
    await tx.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.IN_PROGRESS,
        runtimePhase: RuntimePhase.PRACTICE,
        currentPhase: ExperimentPhase.PRACTICE,
        currentSegmentIndex: 0,
        currentSegmentType: SegmentType.PRACTICE,
        currentSegmentStarts: now,
        currentSegmentEnds: endsAt,
      },
    });
    await tx.sessionSegmentState.updateMany({
      where: { sessionId, phase: ExperimentPhase.PRACTICE, segmentIndex: 0 },
      data: { startedAt: now, endsAt },
    });
  }

  private async startFormalWorkSegmentTx(
    tx: Prisma.TransactionClient,
    sessionId: string,
    segmentIndex: number,
    config: ExperimentConfig,
    now: Date,
    completePractice = true,
  ) {
    const workEnds = new Date(now.getTime() + config.workDurationMinutes * 60 * 1000);
    await tx.session.update({
      where: { id: sessionId },
      data: {
        status: SessionStatus.IN_PROGRESS,
        runtimePhase: RuntimePhase.FORMAL_WORK,
        currentPhase: ExperimentPhase.FORMAL,
        currentSegmentIndex: segmentIndex,
        currentSegmentType: SegmentType.WORK,
        currentSegmentStarts: now,
        currentSegmentEnds: workEnds,
        ...(completePractice ? { practiceCompletedAt: now } : {}),
      },
    });
    if (completePractice) {
      await tx.sessionSegmentState.updateMany({
        where: { sessionId, phase: ExperimentPhase.PRACTICE, segmentIndex: 0 },
        data: { completedAt: now },
      });
    }
    await tx.sessionSegmentState.updateMany({
      where: { sessionId, phase: ExperimentPhase.FORMAL, segmentIndex },
      data: { startedAt: now, endsAt: workEnds },
    });

    const currentATask = await tx.taskAssignment.findFirst({
      where: {
        sessionId,
        phase: ExperimentPhase.FORMAL,
        aSubmittedAt: null,
      },
      orderBy: { sortOrder: 'asc' },
    });
    if (currentATask) {
      await this.activateCurrentATask(tx, currentATask, workEnds, now);
    }

    // Schedule side task plans for this segment
    await this.scheduleSideTaskPlans(tx, sessionId, segmentIndex, config, now);
  }

  private async scheduleSideTaskPlans(
    tx: Prisma.TransactionClient,
    sessionId: string,
    segmentIndex: number,
    config: ExperimentConfig,
    now: Date,
  ) {
    const sidetaskTx = tx as Prisma.TransactionClient & {
      sideTaskPlan: typeof this.prisma.sideTaskPlan;
      sideTaskSessionConfig: typeof this.prisma.sideTaskSessionConfig;
    };

    const sessionConfig = await sidetaskTx.sideTaskSessionConfig.findUnique({
      where: { sessionId },
    });
    if (!sessionConfig) return;

    const plans = await sidetaskTx.sideTaskPlan.findMany({
      where: { sessionId, segmentIndex, scheduledAt: null },
      orderBy: { queueOrder: 'asc' },
    });
    if (plans.length === 0) return;

    const dispatchMode = sessionConfig.dispatchMode;

    if (dispatchMode === 'continuous') {
      const interval = config.sideTaskContinuousIntervalSec;
      const jitter = config.sideTaskContinuousJitterSec;
      let offset = 0;
      for (const plan of plans) {
        const jitterOffset = jitter > 0
          ? Math.floor(this.seededRandom(`${sessionId}:${plan.id}:jitter`) * (jitter * 2 + 1)) - jitter
          : 0;
        const scheduledAt = new Date(now.getTime() + (offset + jitterOffset) * 1000);
        await sidetaskTx.sideTaskPlan.update({
          where: { id: plan.id },
          data: { scheduledAt },
        });
        offset += interval;
      }
    } else {
      // batch mode
      const batchSizesRaw = config.sideTaskBatchSizes;
      const batchSizes = batchSizesRaw.split(',').map((s) => Number(s.trim()));
      const trigger = config.sideTaskBatchTriggerSec;

      let offset = 0;
      let batchNo = 1;
      let idx = 0;

      for (const size of batchSizes) {
        for (let j = 0; j < size && idx < plans.length; j++) {
          const scheduledAt = new Date(now.getTime() + offset * 1000);
          await sidetaskTx.sideTaskPlan.update({
            where: { id: plans[idx].id },
            data: { scheduledAt, batchNo },
          });
          idx++;
        }
        offset += trigger;
        batchNo++;
      }
    }
  }

  private seededRandom(seed: string): number {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(seed).digest();
    return hash.readUInt32BE(0) / 0x100000000;
  }

  private async getSideTaskRuntime(
    sessionId: string,
    currentSegmentIndex: number,
    config: ExperimentConfig,
    participantId?: string,
  ) {
    const sessionConfig = await this.prisma.sideTaskSessionConfig.findUnique({
      where: { sessionId },
    });

    if (!sessionConfig) {
      return {
        sideTaskQueue: [],
        sideTaskConfig: {
          dispatchMode: 'continuous' as const,
          scrollDurationSec: config.sideTaskScrollDurationSec,
          holdSec: config.sideTaskHoldSec,
          fadeSec: config.sideTaskFadeSec,
          pauseSec: config.sideTaskContinuousPauseSec,
          totalPlanned: 0,
          totalReleased: 0,
          totalAnswered: 0,
          totalArchived: 0,
          nextScheduledAt: null as string | null,
          pendingLabel: '待处理事宜',
          tickerMessage: '您有新事项入库，请尽快处理',
        },
      };
    }

    const now = new Date();
    const isWorkSegment = currentSegmentIndex % 2 === 1 && currentSegmentIndex >= 1 && currentSegmentIndex <= 5;

    if (!isWorkSegment) {
      return {
        sideTaskQueue: [],
        sideTaskConfig: {
          dispatchMode: sessionConfig.dispatchMode as 'continuous' | 'batch',
          scrollDurationSec: config.sideTaskScrollDurationSec,
          holdSec: config.sideTaskHoldSec,
          fadeSec: config.sideTaskFadeSec,
          pauseSec: sessionConfig.dispatchMode === 'continuous'
            ? config.sideTaskContinuousPauseSec
            : config.sideTaskBatchPauseSec,
          totalPlanned: 0,
          totalReleased: 0,
          totalAnswered: 0,
          totalArchived: 0,
          nextScheduledAt: null,
          pendingLabel: '待处理事宜',
          tickerMessage: '您有新事项入库，请尽快处理',
        },
      };
    }

    // participantId filter for per-participant answered tracking
    const answeredWhere = participantId
      ? { eventType: 'side_task_answered' as const, participantId }
      : { eventType: 'side_task_answered' as const };

    const plans = await this.prisma.sideTaskPlan.findMany({
      where: { sessionId, segmentIndex: currentSegmentIndex },
      include: {
        item: { select: { text: true, question: true, optionA: true, optionB: true, directAiFlag: true, narrativeCategory: true } },
        exposureLogs: {
          where: answeredWhere,
          select: { id: true, payload: true },
          take: 1,
        },
      },
      orderBy: { queueOrder: 'asc' },
    });

    // queue: visible plans (scheduledAt <= now, not archived) for frontend display
    const visiblePlans = plans.filter(
      (p) => p.scheduledAt && p.scheduledAt <= now && !p.isArchivedAtSegmentEnd,
    );
    // totalReleased: frontend真实首次看到 = releasedAt !== null (服务端认定)
    const releasedCount = plans.filter((p) => p.releasedAt !== null).length;
    // totalAnswered: per-participant (当前 participant 答了多少)
    const answeredCount = plans.filter((p) => p.exposureLogs.length > 0).length;
    const archivedUnansweredCount = plans.filter(
      (p) => p.isArchivedAtSegmentEnd && p.exposureLogs.length === 0,
    ).length;
    const nextPlan = plans.find((p) => p.scheduledAt && p.scheduledAt > now);

    const queue = visiblePlans.map((p) => ({
      planId: p.id,
      text: p.item.text,
      question: p.item.question,
      optionA: p.item.optionA,
      optionB: p.item.optionB,
      directAiFlag: p.item.directAiFlag,
      narrativeCategory: p.item.narrativeCategory,
      queueOrder: p.queueOrder,
      batchNo: p.batchNo,
      answered: p.exposureLogs.length > 0,
      answer: p.exposureLogs.length > 0 ? (p.exposureLogs[0].payload as Record<string, unknown>)?.answer ?? null : null,
    }));

    return {
      sideTaskQueue: queue,
      sideTaskConfig: {
        dispatchMode: sessionConfig.dispatchMode as 'continuous' | 'batch',
        scrollDurationSec: config.sideTaskScrollDurationSec,
        holdSec: config.sideTaskHoldSec,
        fadeSec: config.sideTaskFadeSec,
        pauseSec: sessionConfig.dispatchMode === 'continuous'
          ? config.sideTaskContinuousPauseSec
          : config.sideTaskBatchPauseSec,
        totalPlanned: plans.length,
        totalReleased: releasedCount,
        totalAnswered: answeredCount,
        totalArchived: archivedUnansweredCount,
        nextScheduledAt: nextPlan?.scheduledAt?.toISOString() ?? null,
        pendingLabel: '待处理事宜',
        tickerMessage: '您有新事项入库，请尽快处理',
      },
    };
  }

  private async activateCurrentATask(
    tx: Prisma.TransactionClient,
    task: TaskAssignment,
    segmentEndsAt: Date | null | undefined,
    now: Date,
  ) {
    const remaining = task.aRemainingSeconds || 300;
    const deadline = new Date(
      Math.min(now.getTime() + remaining * 1000, segmentEndsAt?.getTime() ?? now.getTime() + remaining * 1000),
    );

    await tx.taskAssignment.update({
      where: { id: task.id },
      data: !task.aStartedAt
        ? {
            aStartedAt: now,
            resumedAt: task.resumedAt ?? now,
            frozenAt: null,
            aDeadlineAt: deadline,
          }
        : {
            resumedAt: now,
            frozenAt: null,
            aDeadlineAt: deadline,
          },
    });
  }

  private getCurrentAiLevel(
    config: ExperimentConfig,
    segmentIndex: number,
  ) {
    if (segmentIndex <= 1) return config.segmentOneAiLevel;
    if (segmentIndex <= 3) return config.segmentTwoAiLevel;
    return config.segmentThreeAiLevel;
  }

  private getRemainingSeconds(endsAt?: Date | null) {
    if (!endsAt) return null;
    return Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 1000));
  }

  private computeRemainingSeconds(endsAt?: Date | null) {
    if (!endsAt) return 0;
    return Math.max(0, Math.ceil((endsAt.getTime() - Date.now()) / 1000));
  }

  private async snapshotTaskSection(
    tx: Prisma.TransactionClient,
    sessionId: string,
    taskId: string,
    snapshot: {
      snapshotType: string;
      scope: string;
      role: string;
      section: string;
      segmentIndex: number;
      takenReason: string;
      label: string;
      payload: Prisma.InputJsonValue | null;
    },
  ) {
    await tx.taskSnapshot.create({
      data: {
        sessionId,
        taskAssignmentId: taskId,
        snapshotType: snapshot.snapshotType,
        scope: snapshot.scope,
        role: snapshot.role,
        section: snapshot.section,
        segmentIndex: snapshot.segmentIndex,
        takenReason: snapshot.takenReason,
        label: snapshot.label,
        payload: snapshot.payload ?? Prisma.JsonNull,
      } as Prisma.TaskSnapshotUncheckedCreateInput,
    });
  }

  private async restoreTaskDraftsFromLatestFreeze(
    tx: Prisma.TransactionClient,
    sessionId: string,
    taskId: string,
    segmentIndex: number,
  ) {
    const latestSnapshots = (await tx.taskSnapshot.findMany({
      where: {
        sessionId,
        taskAssignmentId: taskId,
        snapshotType: 'work_segment_freeze',
      },
      orderBy: { createdAt: 'desc' },
      take: 3,
    })) as SnapshotRecord[];
    if (latestSnapshots.length === 0) return;

    const data: Prisma.TaskAssignmentUpdateInput = {};
    for (const snapshot of latestSnapshots) {
      if (snapshot.role === 'A' && snapshot.section === 'main') data.aDraft = this.toDraftValue(snapshot.payload);
      if (snapshot.role === 'B' && snapshot.section === 'main') data.bDraft = this.toDraftValue(snapshot.payload);
      if (snapshot.role === 'B' && snapshot.section === 'feedback') {
        data.bFeedbackDraft = this.toDraftValue(snapshot.payload);
      }
    }
    await tx.taskAssignment.update({
      where: { id: taskId },
      data,
    });

    await tx.taskSnapshot.create({
      data: {
        sessionId,
        taskAssignmentId: taskId,
        snapshotType: 'restored_from_freeze',
        scope: 'mainline',
        segmentIndex,
        restoreSourceSnapshotId: latestSnapshots[0].id,
        takenReason: 'segment_resume_after_break',
        label: `恢复自冻结快照 ${latestSnapshots[0].createdAt.toISOString()}`,
        payload: {
          restoredSections: latestSnapshots.map((snapshot) => ({
            id: snapshot.id,
            role: snapshot.role,
            section: snapshot.section,
          })),
        } as Prisma.InputJsonValue,
      } as Prisma.TaskSnapshotUncheckedCreateInput,
    });
  }

  private toDraftValue(payload: Prisma.JsonValue) {
    return payload === null ? Prisma.JsonNull : (payload as Prisma.InputJsonValue);
  }

  private pickDraftPayload(task: TaskAssignment, selector: DraftSelector) {
    if (selector.role === ParticipantRole.A) return task.aDraft;
    if (selector.section === 'feedback') return task.bFeedbackDraft;
    return task.bDraft;
  }

  private serializeCompany(
    company: Record<string, unknown>,
    assignedRole?: ParticipantRole | null,
    fallbackCompany?: Record<string, unknown> | null,
  ) {
    const usingFallback = !this.hasUsableMaterials(company) && fallbackCompany && this.hasUsableMaterials(fallbackCompany);
    const sourceCompany = usingFallback ? fallbackCompany : company;
    const sourceCompanyId = String(sourceCompany.id);
    const materials = normalizeMaterials(sourceCompany.materials)
      .filter((item) => !this.isResearchOnlyMaterial(item))
      .filter((item) => this.isVisibleToRole(item, assignedRole))
      .map((item) => ({
        ...item,
        url: buildMaterialPublicUrl(sourceCompanyId, item.storageKey),
      }));
    return {
      id: String(company.id),
      name: String(company.name ?? ''),
      roundLabel: String(company.roundLabel ?? ''),
      sector: String(company.sector ?? ''),
      tags: Array.isArray(company.tags) ? company.tags : [],
      summary: String(company.summary ?? ''),
      materials,
      researchProfile: usingFallback ? sourceCompany.researchProfile ?? null : company.researchProfile ?? null,
      autoFillSourceMaterialId: usingFallback
        ? sourceCompany.autoFillSourceMaterialId ?? null
        : company.autoFillSourceMaterialId ?? null,
    };
  }

  private hasUsableMaterials(company: Record<string, unknown>) {
    const materials = normalizeMaterials(company.materials);
    return materials.length > 0 && materials.every((item) => Boolean(item.storageKey));
  }

  private isResearchOnlyMaterial(item: {
    displayName?: string;
    sourceFilename?: string;
    metadata?: Record<string, unknown>;
  }) {
    if (item.metadata?.audience === 'research') return true;
    const joined = `${item.displayName ?? ''} ${item.sourceFilename ?? ''}`;
    return joined.includes('研究者用') || joined.includes('信息点记录');
  }

  private isVisibleToRole(
    item: {
      metadata?: Record<string, unknown>;
    },
    assignedRole?: ParticipantRole | null,
  ) {
    const participantRole = item.metadata?.participantRole;
    if (!assignedRole) return true;
    if (participantRole === undefined || participantRole === null || participantRole === 'shared') return true;
    return participantRole === assignedRole;
  }

  private getSessionStream(sessionCode: string) {
    let stream = this.sessionStreams.get(sessionCode);
    if (!stream) {
      stream = new Subject<SessionStreamEnvelope>();
      this.sessionStreams.set(sessionCode, stream);
    }
    return stream;
  }

  private emitSessionEvent(sessionCode: string, event: SessionStreamEnvelope) {
    this.getSessionStream(sessionCode).next({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...event,
    });
  }

  private emitRuntimeInvalidated(sessionCode: string) {
    this.emitSessionEvent(sessionCode, {
      type: 'runtime_invalidated',
      data: { at: new Date().toISOString() },
    });
  }

  private async ensureConfig() {
    let config = await this.prisma.experimentConfig.findUnique({
      where: { id: 'default' },
      include: { activeQuestionnaireTemplate: true },
    });

    if (!config) {
      const template = await this.prisma.questionnaireTemplate.upsert({
        where: { id: 'default-break-questionnaire' },
        update: { isActive: true },
        create: {
          id: 'default-break-questionnaire',
          title: '默认休息问卷',
          items: [
            {
              id: 'q1',
              prompt: '你当前的认知负荷感受如何？',
              options: ['很低', '较低', '中等', '较高', '很高'],
            },
          ] as Prisma.InputJsonValue,
          isActive: true,
        },
      });

      config = await this.prisma.experimentConfig.create({
        data: {
          id: 'default',
          workDurationMinutes: 20,
          breakDurationMinutes: 5,
          segmentOneAiLevel: AiLevel.BASIC,
          segmentTwoAiLevel: AiLevel.ADVANCED,
          segmentThreeAiLevel: AiLevel.ADVANCED,
          activeQuestionnaireTemplateId: template.id,
        },
        include: { activeQuestionnaireTemplate: true },
      });
    }

    return config;
  }
}
