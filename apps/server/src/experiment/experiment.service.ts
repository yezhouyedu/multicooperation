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
import { ExperimentAuditService } from '../recording/experiment-audit.service';

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
  questionnaireAnswers: {
    participantId: string;
    segmentIndex: number;
    phase: ExperimentPhase;
    answers: Prisma.JsonValue;
  }[];
};

type RuntimeExperimentSnapshot = {
  experimentMode?: string;
  upgradeCohort?: string | null;
  segmentAiStates?: Record<string, AiLevel | string>;
  sideDispatchMode?: string;
  narrativeGroup?: string;
  themeOrder?: string[];
  fixedVariables?: Record<string, string>;
};

type RuntimeConfig = ExperimentConfig & {
  activeQuestionnaireTemplate: QuestionnaireTemplate | null;
  practiceQuizTemplate: QuestionnaireTemplate | null;
};

type BarrierTarget = 'practice' | 'formal';

const PRACTICE_TUTORIAL_STEPS = [
  'material_tab',
  'task_acknowledge',
  'ai_message',
  'sidetask_open',
  'sidetask_answer',
] as const;

@Injectable()
export class ExperimentService {
  private readonly sessionStreams = new Map<string, Subject<SessionStreamEnvelope>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: ExperimentAuditService,
  ) {}

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

  async getPracticeQuiz(sessionCode: string) {
    const synced = await this.syncRuntime(sessionCode);
    const session = synced.session;
    const template = synced.config.practiceQuizTemplate ?? synced.config.activeQuestionnaireTemplate;
    const items = this.normalizeQuestionnaireItems(template?.items);

    return {
      ok: true,
      questionnaire: template
        ? {
            id: template.id,
            title: template.title,
            items,
          }
        : null,
      passCount: this.resolvePracticeQuizPassCount(synced.config.practiceQuizPassCount, items.length),
    };
  }

  async submitPracticeQuiz(sessionCode: string, participantId: string, answers: Prisma.InputJsonValue) {
    const synced = await this.syncRuntime(sessionCode);
    const session = synced.session;
    const participant = await this.prisma.participant.findUnique({ where: { id: participantId } });
    if (!participant) throw new NotFoundException('Participant not found');

    const template = synced.config.practiceQuizTemplate ?? synced.config.activeQuestionnaireTemplate;
    if (!template) {
      throw new BadRequestException('Practice quiz template is not configured');
    }

    const items = this.normalizeQuestionnaireItems(template.items);
    const rawAnswerMap = answers && typeof answers === 'object' ? (answers as Record<string, unknown>) : {};
    const selectedAnswers = Object.fromEntries(
      items.map((item) => [item.id, typeof rawAnswerMap[item.id] === 'string' ? String(rawAnswerMap[item.id]) : '']),
    ) as Prisma.InputJsonObject;
    const correctCount = items.reduce((count, item) => {
      if (!item.correctOption) return count;
      return selectedAnswers[item.id] === item.correctOption ? count + 1 : count;
    }, 0);
    const passCount = this.resolvePracticeQuizPassCount(synced.config.practiceQuizPassCount, items.length);
    const passed = correctCount >= passCount;
    const payload: Prisma.InputJsonObject = {
      selectedAnswers,
      correctCount,
      passCount,
      passed,
    };

    await this.prisma.$transaction(async (tx) => {
      await tx.questionnaireResponse.create({
        data: {
          sessionId: session.id,
          participantId,
          templateId: template.id,
          phase: ExperimentPhase.PRACTICE,
          segmentIndex: 0,
          answers: payload,
        },
      });

      await tx.taskProgress.createMany({
        data: [
          {
            sessionId: session.id,
            participantId,
            stage: 'practice_quiz_submitted',
            payload,
          },
          {
            sessionId: session.id,
            participantId,
            stage: passed ? 'practice_quiz_passed' : 'practice_quiz_failed',
            payload,
          },
        ],
      });

      if (!passed) return;

      const pairing = await tx.pairing.findFirst({
        where: { sessionId: session.id },
        select: { participantAId: true, participantBId: true },
      });
      if (!pairing?.participantAId || !pairing.participantBId) return;

      const passedRows = await tx.questionnaireResponse.findMany({
        where: {
          sessionId: session.id,
          phase: ExperimentPhase.PRACTICE,
          segmentIndex: 0,
        },
        select: { participantId: true, answers: true },
        orderBy: { submittedAt: 'desc' },
      });

      const latestPassedByParticipant = new Map<string, boolean>();
      for (const row of passedRows) {
        if (latestPassedByParticipant.has(row.participantId)) continue;
        latestPassedByParticipant.set(
          row.participantId,
          Boolean((row.answers as Record<string, unknown> | null)?.passed),
        );
      }

      const bothPassed =
        latestPassedByParticipant.get(pairing.participantAId) === true &&
        latestPassedByParticipant.get(pairing.participantBId) === true;

      if (!bothPassed) return;

      const currentSession = await tx.session.findUnique({
        where: { id: session.id },
        select: { runtimePhase: true },
      });
      if (currentSession?.runtimePhase !== RuntimePhase.PRACTICE_QUIZ) return;

      await this.startPracticePhase(tx, session.id, synced.config, new Date());
    });

    await this.audit.recordMany([
      {
        sessionId: session.id,
        participantId,
        role: participant.role,
        eventType: 'practice_quiz_submitted',
        phase: ExperimentPhase.PRACTICE,
        segmentIndex: 0,
        payload,
      },
      {
        sessionId: session.id,
        participantId,
        role: participant.role,
        eventType: passed ? 'practice_quiz_passed' : 'practice_quiz_failed',
        phase: ExperimentPhase.PRACTICE,
        segmentIndex: 0,
        payload,
      },
    ]);

    this.emitRuntimeInvalidated(sessionCode);
    return { ok: true, correctCount, passCount, passed };
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

    let roleTask: TaskAssignment | undefined;
    if (session.runtimePhase === RuntimePhase.PRACTICE) {
      roleTask = session.tasks.find((task) => task.phase === ExperimentPhase.PRACTICE);
    } else if (assignedRole === ParticipantRole.B) {
      roleTask = session.tasks
        .filter((t) => t.phase === ExperimentPhase.FORMAL && t.bSequenceIndex !== null && !t.bCompletedAt)
        .sort((a, b) => (b.bSequenceIndex ?? 0) - (a.bSequenceIndex ?? 0))[0];
    } else {
      roleTask = session.tasks.find((task) => task.phase === ExperimentPhase.FORMAL && !task.aSubmittedAt);
    }

    const currentCompany = roleTask
      ? await this.prisma.company.findUnique({ where: { id: roleTask.companyId } })
      : null;
    const fallbackCompany =
      currentCompany && !this.hasUsableMaterials(currentCompany)
        ? await this.prisma.company.findUnique({ where: { id: 'company-p01-baseline' } })
        : null;
    const syncState = await this.getSyncState(session, assignedRole);
    const practiceQuizItems = this.normalizeQuestionnaireItems(
      config.practiceQuizTemplate?.items ?? config.activeQuestionnaireTemplate?.items,
    );
    const practiceQuizPassed = participantId
      ? session.questionnaireAnswers.some(
          (answer) =>
            answer.participantId === participantId &&
            answer.phase === ExperimentPhase.PRACTICE &&
            answer.segmentIndex === 0 &&
            Boolean((answer.answers as Record<string, unknown> | null)?.passed),
        )
      : false;
    const practiceTutorialState = participantId
      ? await this.getPracticeTutorialState(session.id, participantId)
      : null;
    const isPracticePhase = session.runtimePhase === RuntimePhase.PRACTICE;
    const currentTaskPhase = isPracticePhase ? ExperimentPhase.PRACTICE : ExperimentPhase.FORMAL;
    const questionnaireSubmitted = participantId
      ? session.questionnaireAnswers.some(
          (answer) =>
            answer.participantId === participantId &&
            answer.phase === ExperimentPhase.FORMAL &&
            answer.segmentIndex === session.currentSegmentIndex,
        )
      : false;

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
            aAiLevelAtWindow: roleTask.aAiLevelAtWindow,
            bPreAAiLevel: roleTask.bPreAAiLevel,
            bPostAAiLevel: roleTask.bPostAAiLevel,
            crossUpgradeBoundaryFlag: roleTask.crossUpgradeBoundaryFlag,
          }
        : null,
      taskRemainingSeconds:
        assignedRole === ParticipantRole.A && roleTask ? this.getRemainingSeconds(roleTask.aDeadlineAt) : null,
      aInfoUnlocked: Boolean(roleTask?.aUnlockedForBAt),
      bHasViewedAInfo: Boolean(roleTask?.bViewedAInfoAt),
      bCanSubmit: Boolean(roleTask?.aUnlockedForBAt) && !roleTask?.bCompletedAt,
      isIdle: !roleTask,
      isFrozen: Boolean(roleTask?.frozenAt),
      isPreA: assignedRole === ParticipantRole.B && Boolean(roleTask && !roleTask.aSubmittedAt),
      questionnaireSubmitted,
      experimentMode: session.experimentMode,
      experimentSnapshot: session.experimentSnapshot,
      instructionBlocks: this.buildInstructionBlocks(config.instructionBlocks, session.experimentMode),
      aiLevel: this.getCurrentAiLevel(config, session.currentSegmentIndex, session),
      aiUpgradeNotice: this.buildAiUpgradeNotice(config, session),
      feedbackNotificationDurationSec: config.feedbackNotificationDurationSec,
      ...(await this.getSideTaskRuntime(session, config, participantId)),
      syncState,
      questionnaireTemplate:
        session.runtimePhase === RuntimePhase.FORMAL_BREAK && config.activeQuestionnaireTemplate
          ? {
              id: config.activeQuestionnaireTemplate.id,
              title: config.activeQuestionnaireTemplate.title,
              items: config.activeQuestionnaireTemplate.items,
            }
          : null,
      practiceQuizTemplate:
        (!practiceQuizPassed || this.mapRuntimePhase(session.runtimePhase) === 'practice_quiz') && config.practiceQuizTemplate
          ? {
              id: config.practiceQuizTemplate.id,
              title: config.practiceQuizTemplate.title,
              items: practiceQuizItems.map(({ id, prompt, options }) => ({ id, prompt, options })),
            }
          : null,
      practiceQuizPassCount: this.resolvePracticeQuizPassCount(config.practiceQuizPassCount, practiceQuizItems.length),
      practiceQuizPassed,
      practiceTutorialState: isPracticePhase || session.runtimePhase === RuntimePhase.FORMAL_READY ? practiceTutorialState : null,
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

    const taskId =
      input.payload && typeof input.payload === 'object' && !Array.isArray(input.payload)
        ? String((input.payload as Record<string, unknown>).taskId ?? '')
        : '';
    const task = taskId
      ? await this.prisma.taskAssignment.findFirst({
          where: { id: taskId, sessionId: session.id },
          select: { id: true, companyId: true, phase: true },
        })
      : null;
    await this.audit.record({
      sessionId: session.id,
      participantId: participant.id,
      taskAssignmentId: task?.id ?? null,
      companyId: task?.companyId ?? null,
      role: input.role,
      eventType: input.stage,
      phase: task?.phase ?? session.currentPhase ?? null,
      segmentIndex: session.currentSegmentIndex,
      payload: input.payload ?? null,
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
    await this.audit.record({
      sessionId: synced.session.id,
      participantId,
      role: participant.role,
      eventType: 'break_questionnaire_submitted',
      phase: ExperimentPhase.FORMAL,
      segmentIndex: synced.session.currentSegmentIndex,
      payload: answers,
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

    // Check if already answered by this participant (idempotent per participant).
    const existing = await this.prisma.sideTaskExposureLog.findFirst({
      where: { sideTaskPlanId: planId, participantId, eventType: 'side_task_answered' },
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
      await this.audit.record({
        sessionId: synced.session.id,
        participantId,
        sideTaskPlanId: planId,
        eventType: 'side_task_answered',
        phase: synced.session.currentPhase ?? null,
        segmentIndex: synced.session.currentSegmentIndex,
        payload: { answer } as Prisma.InputJsonValue,
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
        bPostAAiLevel: task.bPostAAiLevel ?? this.getCurrentAiLevel(synced.config, session.currentSegmentIndex, session),
        crossUpgradeBoundaryFlag: this.hasCrossUpgradeBoundary({
          ...task,
          bPostAAiLevel: task.bPostAAiLevel ?? this.getCurrentAiLevel(synced.config, session.currentSegmentIndex, session),
        }),
        aRemainingSeconds: this.computeRemainingSeconds(task.aDeadlineAt),
      },
    });

    await this.recordProgress({
      sessionCode,
      role: ParticipantRole.A,
      stage: task.phase === ExperimentPhase.PRACTICE ? 'practice_a_task_submitted' : 'a_task_submitted',
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

      // FORMAL 阶段：B 完成后从池中分配下一个公司
      if (task.phase === ExperimentPhase.FORMAL) {
        const allTasks = await tx.taskAssignment.findMany({
          where: { sessionId: session.id, phase: ExperimentPhase.FORMAL },
          orderBy: { sortOrder: 'asc' },
        });
        await this.assignNextTaskForB(
          tx,
          session.id,
          allTasks,
          this.getCurrentAiLevel(synced.config, session.currentSegmentIndex, session),
        );
      }

      const participantB = session.pairings[0]?.participantB;
      if (participantB) {
        const eventType = task.phase === ExperimentPhase.PRACTICE ? 'practice_b_task_completed' : 'b_task_completed';
        await tx.taskProgress.create({
          data: {
            sessionId: session.id,
            participantId: participantB.id,
            stage: eventType,
            payload: { taskId, sortOrder: task.sortOrder },
          },
        });
        await (tx as Prisma.TransactionClient & { experimentEvent: typeof this.prisma.experimentEvent }).experimentEvent.create({
          data: {
            sessionId: session.id,
            participantId: participantB.id,
            taskAssignmentId: taskId,
            companyId: task.companyId,
            role: ParticipantRole.B,
            eventType,
            phase: task.phase,
            segmentIndex: session.currentSegmentIndex,
            payload: { taskId, sortOrder: task.sortOrder } as Prisma.InputJsonValue,
          },
        });
      }

      const remaining = task.phase === ExperimentPhase.FORMAL
        ? await tx.taskAssignment.count({
            where: { sessionId: session.id, phase: ExperimentPhase.FORMAL, bCompletedAt: null },
          })
        : 1;
      const allDone = task.phase === ExperimentPhase.FORMAL && remaining === 0;

      if (allDone) {
        await tx.session.update({
          where: { id: session.id },
          data: { status: SessionStatus.COMPLETED, runtimePhase: RuntimePhase.END },
        });
      }

      return { ok: true, taskId, allDone };
    });

    this.emitSessionEvent(sessionCode, {
      type: task.phase === ExperimentPhase.PRACTICE ? 'practice_b_task_completed' : 'b_task_completed',
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

      if (target === 'formal') {
        const passedQuiz = await tx.questionnaireResponse.findFirst({
          where: {
            sessionId: session.id,
            participantId,
            phase: ExperimentPhase.PRACTICE,
            segmentIndex: 0,
          },
          orderBy: { submittedAt: 'desc' },
        });
        if (!passedQuiz || !Boolean((passedQuiz.answers as Record<string, unknown> | null)?.passed)) {
          throw new BadRequestException('尚未通过测试题');
        }

        const tutorialCompleted = await tx.taskProgress.findFirst({
          where: {
            sessionId: session.id,
            participantId,
            stage: 'practice_tutorial_completed',
          },
        });
        if (!tutorialCompleted) {
          throw new BadRequestException('尚未完成测试轮教学引导');
        }

        const practiceTask = await tx.taskAssignment.findFirst({
          where: { sessionId: session.id, phase: ExperimentPhase.PRACTICE },
        });
        if (!practiceTask) {
          throw new BadRequestException('测试轮任务不存在');
        }

        const now = new Date();
        const segmentTimedOut = Boolean(session.currentSegmentEnds && session.currentSegmentEnds <= now);
        const isParticipantA = participantId === pairing.participantAId;
        if (isParticipantA) {
          if (!practiceTask.aUnlockedForBAt && !segmentTimedOut) {
            throw new BadRequestException('尽调员测试轮尚未结束');
          }
        } else if (!practiceTask.bCompletedAt && !segmentTimedOut) {
          throw new BadRequestException('投资经理测试轮尚未结束');
        }
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
        await (tx as Prisma.TransactionClient & { experimentEvent: typeof this.prisma.experimentEvent }).experimentEvent.create({
          data: {
            sessionId: session.id,
            participantId,
            role: participantId === pairing.participantAId ? ParticipantRole.A : ParticipantRole.B,
            eventType: stage,
            phase: target === 'practice' ? ExperimentPhase.PRACTICE : ExperimentPhase.FORMAL,
            segmentIndex: session.currentSegmentIndex,
            payload: { target } as Prisma.InputJsonValue,
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
        if (!(target === 'formal' && session.runtimePhase === RuntimePhase.PRACTICE)) {
          await tx.session.update({
            where: { id: session.id },
            data: {
              runtimePhase: waitingPhase,
              currentSegmentStarts: null,
              currentSegmentEnds: null,
            },
          });
        }
        return { ok: true, started: false, waiting: true };
      }

      if (target === 'practice') {
        await tx.session.update({
          where: { id: session.id },
          data: {
            runtimePhase: RuntimePhase.PRACTICE_QUIZ,
            currentSegmentStarts: null,
            currentSegmentEnds: null,
          },
        });
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
          tasks: { orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }] },
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

      if (session.runtimePhase === RuntimePhase.PRACTICE && session.currentSegmentEnds && session.currentSegmentEnds <= now) {
        await this.advanceAfterPractice(tx, session, now);
        return;
      }

      if (session.runtimePhase === RuntimePhase.PRACTICE) {
        const practiceTask = session.tasks.find((task) => task.phase === ExperimentPhase.PRACTICE);
        if (practiceTask && (!practiceTask.aStartedAt || practiceTask.frozenAt)) {
          await this.activateCurrentATask(
            tx,
            practiceTask,
            session.currentSegmentEnds,
            now,
            this.getCurrentAiLevel(config, session.currentSegmentIndex, session),
          );
        }
      }

      if (session.runtimePhase === RuntimePhase.FORMAL_BREAK && session.currentSegmentEnds && session.currentSegmentEnds <= now) {
        await this.advanceAfterBreak(tx, session, config, now);
        return;
      }

      if (session.runtimePhase === RuntimePhase.FORMAL_WORK) {
        const currentATask = session.tasks.find((task) => !task.aSubmittedAt);
        if (currentATask) {
          if (!currentATask.aStartedAt || currentATask.frozenAt) {
            await this.activateCurrentATask(
              tx,
              currentATask,
              session.currentSegmentEnds,
              now,
              this.getCurrentAiLevel(config, session.currentSegmentIndex, session),
            );
          }
        }
      }

      // 池分配：确保 B 在 FORMAL_WORK 阶段有分配的公司
      if (session.runtimePhase === RuntimePhase.FORMAL_WORK) {
        const bHasCurrent = session.tasks.some(
          (t) => t.bSequenceIndex !== null && !t.bCompletedAt,
        );
        if (!bHasCurrent) {
          const formalTasks = session.tasks.filter((t) => t.phase === ExperimentPhase.FORMAL);
          await this.assignNextTaskForB(
            tx,
            session.id,
            formalTasks,
            this.getCurrentAiLevel(config, session.currentSegmentIndex, session),
          );
        }
      }
    });

    const session = await this.prisma.session.findUnique({
      where: { code: sessionCode },
      include: {
        pairings: { include: { participantA: true, participantB: true } },
        tasks: { orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }] },
        questionnaireAnswers: true,
      },
    });
    if (!session) throw new NotFoundException(`Session ${sessionCode} not found`);

    await this.autoUnlockATask(sessionCode, session, config);

    const refetched = await this.prisma.session.findUnique({
      where: { code: sessionCode },
      include: {
        pairings: { include: { participantA: true, participantB: true } },
        tasks: { orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }] },
        questionnaireAnswers: true,
      },
    });
    if (!refetched) throw new NotFoundException(`Session ${sessionCode} not found`);

    return {
      session: refetched,
      config,
    } as {
      session: RuntimeSession;
      config: RuntimeConfig;
    };
  }

  private async autoUnlockATask(sessionCode: string, session: RuntimeSession, config: ExperimentConfig) {
    const isPractice = session.runtimePhase === RuntimePhase.PRACTICE;
    const isFormal = session.runtimePhase === RuntimePhase.FORMAL_WORK;
    if (!isPractice && !isFormal) return;

    const currentATask = isPractice
      ? session.tasks.find((task) => task.phase === ExperimentPhase.PRACTICE)
      : session.tasks.find((task) => task.phase === ExperimentPhase.FORMAL && !task.aSubmittedAt);
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
          bPostAAiLevel: this.getCurrentAiLevel(config, session.currentSegmentIndex, session),
          crossUpgradeBoundaryFlag: this.hasCrossUpgradeBoundary(currentATask),
          aRemainingSeconds: 0,
        },
      });

      if (pairing?.participantAId) {
        await tx.taskProgress.create({
          data: {
            sessionId: session.id,
            participantId: pairing.participantAId,
            stage: isPractice ? 'practice_a_task_auto_submitted' : 'a_task_auto_submitted',
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
      type: isPractice ? 'practice_a_task_auto_submitted' : 'a_task_auto_submitted',
      data: { taskId: currentATask.id, sortOrder: currentATask.sortOrder },
    });
    this.emitRuntimeInvalidated(sessionCode);
  }

  private async advanceAfterPractice(
    tx: Prisma.TransactionClient,
    session: RuntimeSession,
    now: Date,
  ) {
    const practiceTask = session.tasks.find((task) => task.phase === ExperimentPhase.PRACTICE);
    if (practiceTask && !practiceTask.aSubmittedAt) {
      await tx.taskAssignment.update({
        where: { id: practiceTask.id },
        data: {
          aSubmittedAt: now,
          aUnlockedForBAt: now,
          bCanSubmitAt: now,
          aDeadlineAt: null,
          aRemainingSeconds: 0,
        },
      });
    }
    if (practiceTask && !practiceTask.bCompletedAt) {
      await tx.taskAssignment.update({
        where: { id: practiceTask.id },
        data: { bCompletedAt: now },
      });
    }

    const pairing = session.pairings[0];
    const progressRows: Prisma.TaskProgressCreateManyInput[] = [];
    if (practiceTask && pairing?.participantAId && !practiceTask.aSubmittedAt) {
      progressRows.push({
        sessionId: session.id,
        participantId: pairing.participantAId,
        stage: 'practice_a_task_auto_submitted',
        payload: { taskId: practiceTask.id, sortOrder: practiceTask.sortOrder, reason: 'practice_timeout' },
      });
    }
    if (practiceTask && pairing?.participantBId && !practiceTask.bCompletedAt) {
      progressRows.push({
        sessionId: session.id,
        participantId: pairing.participantBId,
        stage: 'practice_b_task_auto_completed',
        payload: { taskId: practiceTask.id, sortOrder: practiceTask.sortOrder, reason: 'practice_timeout' },
      });
    }
    if (progressRows.length > 0) {
      await tx.taskProgress.createMany({ data: progressRows });
    }

    await tx.sessionSegmentState.updateMany({
      where: { sessionId: session.id, phase: ExperimentPhase.PRACTICE, segmentIndex: 0 },
      data: { completedAt: now },
    });
    await tx.sideTaskPlan.updateMany({
      where: {
        sessionId: session.id,
        segmentIndex: 0,
        isArchivedAtSegmentEnd: false,
      },
      data: { isArchivedAtSegmentEnd: true },
    });
    await tx.experimentEvent.create({
      data: {
        sessionId: session.id,
        eventType: 'practice_completed',
        phase: ExperimentPhase.PRACTICE,
        segmentIndex: 0,
        serverTime: now,
        payload: { nextPhase: 'FORMAL_READY' } as Prisma.InputJsonValue,
      },
    });
    await tx.session.update({
      where: { id: session.id },
      data: {
        runtimePhase: RuntimePhase.FORMAL_READY,
        currentPhase: ExperimentPhase.FORMAL,
        currentSegmentIndex: 1,
        currentSegmentType: SegmentType.WORK,
        currentSegmentStarts: null,
        currentSegmentEnds: null,
        practiceCompletedAt: now,
      },
    });
  }

  private async advanceAfterWork(
    tx: Prisma.TransactionClient,
    session: RuntimeSession,
    config: ExperimentConfig,
    now: Date,
  ) {
    // A 和 B 可能在不同公司，分别找各自的当前公司
    const aCurrentTask = session.tasks.find(
      (t) => t.phase === ExperimentPhase.FORMAL && !t.aSubmittedAt,
    );
    const bCurrentTask = session.tasks
      .filter((t) => t.phase === ExperimentPhase.FORMAL && t.bSequenceIndex !== null && !t.bCompletedAt)
      .sort((a, b) => (b.bSequenceIndex ?? 0) - (a.bSequenceIndex ?? 0))[0];

    // 快照 A 的公司（A 的 sections）
    if (aCurrentTask) {
      await this.snapshotTaskSection(tx, session.id, aCurrentTask.id, {
        snapshotType: 'work_segment_freeze',
        scope: 'mainline',
        role: 'A',
        section: 'main',
        segmentIndex: session.currentSegmentIndex,
        takenReason: 'segment_transition_to_break',
        label: `工作段冻结快照 A 主表 ${now.toISOString()}`,
        payload: aCurrentTask.aDraft,
      });
    }

    // 快照 B 的公司（B 的 sections）
    if (bCurrentTask) {
      if (bCurrentTask.id !== aCurrentTask?.id) {
        // B 在不同公司，单独快照 B 的 sections
        await this.snapshotTaskSection(tx, session.id, bCurrentTask.id, {
          snapshotType: 'work_segment_freeze',
          scope: 'mainline',
          role: 'B',
          section: 'main',
          segmentIndex: session.currentSegmentIndex,
          takenReason: 'segment_transition_to_break',
          label: `工作段冻结快照 投资判断 ${now.toISOString()}`,
          payload: bCurrentTask.bDraft,
        });
        await this.snapshotTaskSection(tx, session.id, bCurrentTask.id, {
          snapshotType: 'work_segment_freeze',
          scope: 'mainline',
          role: 'B',
          section: 'feedback',
          segmentIndex: session.currentSegmentIndex,
          takenReason: 'segment_transition_to_break',
          label: `工作段冻结快照 反馈表 ${now.toISOString()}`,
          payload: bCurrentTask.bFeedbackDraft,
        });
      } else {
        // A 和 B 在同一家公司（PreA 模式）
        await this.snapshotTaskSection(tx, session.id, bCurrentTask.id, {
          snapshotType: 'work_segment_freeze',
          scope: 'mainline',
          role: 'B',
          section: 'main',
          segmentIndex: session.currentSegmentIndex,
          takenReason: 'segment_transition_to_break',
          label: `工作段冻结快照 投资判断 ${now.toISOString()}`,
          payload: bCurrentTask.bDraft,
        });
        await this.snapshotTaskSection(tx, session.id, bCurrentTask.id, {
          snapshotType: 'work_segment_freeze',
          scope: 'mainline',
          role: 'B',
          section: 'feedback',
          segmentIndex: session.currentSegmentIndex,
          takenReason: 'segment_transition_to_break',
          label: `工作段冻结快照 反馈表 ${now.toISOString()}`,
          payload: bCurrentTask.bFeedbackDraft,
        });
      }
    }

    await tx.sessionSegmentState.updateMany({
      where: { sessionId: session.id, segmentIndex: session.currentSegmentIndex },
      data: { completedAt: now },
    });
    await (tx as Prisma.TransactionClient & { experimentEvent: typeof this.prisma.experimentEvent }).experimentEvent.create({
      data: {
        sessionId: session.id,
        eventType: 'formal_work_segment_completed',
        phase: ExperimentPhase.FORMAL,
        segmentIndex: session.currentSegmentIndex,
        serverTime: now,
        payload: { nextPhase: session.currentSegmentIndex >= 5 ? 'END' : 'FORMAL_BREAK' } as Prisma.InputJsonValue,
      },
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
    await (tx as Prisma.TransactionClient & { experimentEvent: typeof this.prisma.experimentEvent }).experimentEvent.create({
      data: {
        sessionId: session.id,
        eventType: 'formal_break_started',
        phase: ExperimentPhase.FORMAL,
        segmentIndex: session.currentSegmentIndex + 1,
        serverTime: now,
        payload: { endsAt: breakEnds.toISOString() } as Prisma.InputJsonValue,
      },
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
    await (tx as Prisma.TransactionClient & { experimentEvent: typeof this.prisma.experimentEvent }).experimentEvent.create({
      data: {
        sessionId: session.id,
        eventType: 'formal_break_completed',
        phase: ExperimentPhase.FORMAL,
        segmentIndex: session.currentSegmentIndex,
        serverTime: now,
      },
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

    // A 和 B 可能在不同公司，分别恢复各自的草稿
    const aNextTask = session.tasks.find(
      (t) => t.phase === ExperimentPhase.FORMAL && !t.aSubmittedAt,
    );
    if (aNextTask) {
      await this.restoreTaskDraftsFromLatestFreeze(tx, session.id, aNextTask.id, nextWorkIndex);
    }

    const bNextTask = session.tasks
      .filter((t) => t.phase === ExperimentPhase.FORMAL && t.bSequenceIndex !== null && !t.bCompletedAt)
      .sort((a, b) => (b.bSequenceIndex ?? 0) - (a.bSequenceIndex ?? 0))[0];
    if (bNextTask && bNextTask.id !== aNextTask?.id) {
      await this.restoreTaskDraftsFromLatestFreeze(tx, session.id, bNextTask.id, nextWorkIndex);
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
      case RuntimePhase.PRACTICE_QUIZ:
        return 'practice_quiz';
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
    let barrier =
      session.runtimePhase === RuntimePhase.PRACTICE_READY
        ? 'practice'
        : session.runtimePhase === RuntimePhase.FORMAL_READY
          ? 'formal'
          : null;
    if (!barrier && session.runtimePhase === RuntimePhase.PRACTICE) {
      const formalReadyCount = await this.prisma.taskProgress.count({
        where: { sessionId: session.id, stage: 'formal_ready' },
      });
      if (formalReadyCount > 0) barrier = 'formal';
    }
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
    const endsAt = new Date(now.getTime() + config.practiceDurationMinutes * 60 * 1000);
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

    const practiceTask = await tx.taskAssignment.findFirst({
      where: { sessionId, phase: ExperimentPhase.PRACTICE },
    });
    await (tx as Prisma.TransactionClient & { experimentEvent: typeof this.prisma.experimentEvent }).experimentEvent.create({
      data: {
        sessionId,
        eventType: 'practice_started',
        phase: ExperimentPhase.PRACTICE,
        segmentIndex: 0,
        serverTime: now,
        payload: { endsAt: endsAt.toISOString() } as Prisma.InputJsonValue,
      },
    });
    if (practiceTask) {
      await this.activateCurrentATask(
        tx,
        practiceTask,
        endsAt,
        now,
        this.getCurrentAiLevel(config, 0),
      );
    }

    await this.ensurePracticeSideTaskPlans(tx, sessionId);
    await this.scheduleSideTaskPlans(tx, sessionId, 0, config, now);
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
    await (tx as Prisma.TransactionClient & { experimentEvent: typeof this.prisma.experimentEvent }).experimentEvent.create({
      data: {
        sessionId,
        eventType: 'formal_work_segment_started',
        phase: ExperimentPhase.FORMAL,
        segmentIndex,
        serverTime: now,
        payload: { endsAt: workEnds.toISOString() } as Prisma.InputJsonValue,
      },
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
      const sessionForAi = await tx.session.findUnique({ where: { id: sessionId } });
      await this.activateCurrentATask(
        tx,
        currentATask,
        workEnds,
        now,
        this.getCurrentAiLevel(config, segmentIndex, sessionForAi ?? undefined),
      );
    }

    // 池分配：首次进入正式段时，确保 B 有初始分配
    const formalTasks = await tx.taskAssignment.findMany({
      where: { sessionId, phase: ExperimentPhase.FORMAL },
      orderBy: { sortOrder: 'asc' },
    });
    const bHasAny = formalTasks.some((t) => t.bSequenceIndex !== null);
    if (!bHasAny) {
      const sessionForAi = await tx.session.findUnique({ where: { id: sessionId } });
      await this.assignNextTaskForB(
        tx,
        sessionId,
        formalTasks,
        this.getCurrentAiLevel(config, segmentIndex, sessionForAi ?? undefined),
      );
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

    const dispatchMode = segmentIndex === 0 ? 'continuous' : sessionConfig.dispatchMode;
    const interval = config.sideTaskContinuousIntervalSec;
    const jitter = config.sideTaskContinuousJitterSec;

    // Variable A now manipulates reminder frequency only.
    // Actual item arrival stays continuous in both modes.
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

    if (dispatchMode === 'batch') {
      const batchSizesRaw = config.sideTaskBatchSizes;
      const batchSizes = batchSizesRaw.split(',').map((s) => Number(s.trim()));

      let batchNo = 1;
      let idx = 0;

      for (const size of batchSizes) {
        for (let j = 0; j < size && idx < plans.length; j++) {
          await sidetaskTx.sideTaskPlan.update({
            where: { id: plans[idx].id },
            data: { batchNo },
          });
          idx++;
        }
        batchNo++;
      }
    }
  }

  private async ensurePracticeSideTaskPlans(tx: Prisma.TransactionClient, sessionId: string) {
    const sidetaskTx = tx as Prisma.TransactionClient & {
      sideTaskItem: typeof this.prisma.sideTaskItem;
      sideTaskPlan: typeof this.prisma.sideTaskPlan;
      sideTaskSessionConfig: typeof this.prisma.sideTaskSessionConfig;
    };

    const existingCount = await sidetaskTx.sideTaskPlan.count({
      where: { sessionId, segmentIndex: 0 },
    });
    if (existingCount > 0) {
      await sidetaskTx.sideTaskPlan.updateMany({
        where: { sessionId, segmentIndex: 0 },
        data: { dispatchMode: 'continuous', narrativeGroup: 'neutral_info', batchNo: null },
      });
      return;
    }

    const sessionConfig = await sidetaskTx.sideTaskSessionConfig.findUnique({
      where: { sessionId },
      select: { dispatchMode: true, narrativeGroup: true },
    });
    if (!sessionConfig) return;

    const practiceCandidatesRaw = await sidetaskTx.sideTaskItem.findMany({
      where: {
        isActive: true,
        workSegment: { in: [0, 1] },
      },
      select: { id: true, itemCode: true, workSegment: true },
      orderBy: [{ workSegment: 'asc' }, { createdAt: 'asc' }],
    });
    const practiceCandidates = Array.from(
      new Map<string, { id: string; itemCode: string; workSegment: number }>(
        practiceCandidatesRaw.map((item: { id: string; itemCode: string; workSegment: number }) => [
          item.itemCode,
          item,
        ]),
      ).values(),
    );
    const practiceCount = Math.min(5, practiceCandidates.length);
    if (practiceCount === 0) return;

    const sampledPractice = this.sampleWithSeed(
      practiceCandidates,
      practiceCount,
      `${sessionId}:practice:segment:0`,
    );

    for (let queueOrder = 0; queueOrder < sampledPractice.length; queueOrder++) {
      const item = sampledPractice[queueOrder];
      await sidetaskTx.sideTaskPlan.create({
        data: {
          sessionId,
          segmentIndex: 0,
          itemId: item.id,
          dispatchMode: 'continuous',
          narrativeGroup: 'neutral_info',
          themeLabel: 'practice',
          queueOrder: queueOrder + 1,
        },
      });
    }
  }

  private seededRandom(seed: string): number {
    const crypto = require('crypto');
    const hash = crypto.createHash('sha256').update(seed).digest();
    return hash.readUInt32BE(0) / 0x100000000;
  }

  private sampleWithSeed<T>(items: T[], count: number, seed: string): T[] {
    return this.shuffleWithSeed(items, seed).slice(0, count);
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
      const crypto = require('crypto');
      const hash = crypto.createHash('sha256').update(`${seed}:${counter}`).digest();
      counter += 1;
      return hash.readUInt32BE(0) / 0x100000000;
    };
  }

  private async getSideTaskRuntime(
    session: RuntimeSession,
    config: ExperimentConfig,
    participantId?: string,
  ) {
    const sessionId = session.id;
    const currentSegmentIndex = session.currentSegmentIndex;
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
          notificationPulse: null,
          pendingLabel: '待处理事宜',
          tickerMessage: '您有新事项入库，请尽快处理',
        },
      };
    }

    const now = new Date();
    const effectiveDispatchMode =
      currentSegmentIndex === 0 ? 'continuous' : sessionConfig.dispatchMode;
    const effectivePauseSec =
      effectiveDispatchMode === 'continuous'
        ? config.sideTaskContinuousPauseSec
        : config.sideTaskBatchPauseSec;
    const isSideTaskSegment =
      currentSegmentIndex === 0 ||
      (currentSegmentIndex % 2 === 1 && currentSegmentIndex >= 1 && currentSegmentIndex <= 5);

    if (!isSideTaskSegment) {
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
          notificationPulse: null,
          pendingLabel: '待处理事宜',
          tickerMessage: '您有新事项入库，请尽快处理',
        },
      };
    }

    if (currentSegmentIndex === 0) {
      await this.prisma.sideTaskPlan.updateMany({
        where: { sessionId, segmentIndex: 0 },
        data: { dispatchMode: 'continuous', narrativeGroup: 'neutral_info', batchNo: null },
      });

      const existingPracticePlans = await this.prisma.sideTaskPlan.count({
        where: { sessionId, segmentIndex: 0 },
      });

      if (existingPracticePlans === 0) {
        const practiceCandidatesRaw = await this.prisma.sideTaskItem.findMany({
          where: {
            isActive: true,
            workSegment: { in: [0, 1] },
          },
          select: { id: true, itemCode: true, workSegment: true },
          orderBy: [{ workSegment: 'asc' }, { createdAt: 'asc' }],
        });
        const practiceCandidates = Array.from(
          new Map<string, { id: string; itemCode: string; workSegment: number }>(
            practiceCandidatesRaw.map((item: { id: string; itemCode: string; workSegment: number }) => [
              item.itemCode,
              item,
            ]),
          ).values(),
        );
        const practiceCount = Math.min(5, practiceCandidates.length);

        if (practiceCount > 0) {
          const sampledPractice = this.sampleWithSeed(
            practiceCandidates,
            practiceCount,
            `${sessionId}:practice:segment:0`,
          );

          for (let queueOrder = 0; queueOrder < sampledPractice.length; queueOrder++) {
            const item = sampledPractice[queueOrder];
            await this.prisma.sideTaskPlan.create({
              data: {
                sessionId,
                segmentIndex: 0,
                itemId: item.id,
                dispatchMode: 'continuous',
                narrativeGroup: 'neutral_info',
                themeLabel: 'practice',
                queueOrder: queueOrder + 1,
                scheduledAt: now,
              },
            });
          }
        }
      }
    }

    const plans = await this.prisma.sideTaskPlan.findMany({
      where: { sessionId, segmentIndex: currentSegmentIndex },
      include: {
        item: { select: { text: true, question: true, optionA: true, optionB: true, directAiFlag: true, narrativeCategory: true } },
        exposureLogs: {
          where: participantId ? { participantId } : undefined,
          select: { id: true, eventType: true, eventAt: true, payload: true },
          orderBy: { eventAt: 'asc' },
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
    const answeredCount = plans.filter((p) =>
      p.exposureLogs.some((log) => log.eventType === 'side_task_answered'),
    ).length;
    const archivedUnansweredCount = plans.filter(
      (p) =>
        p.isArchivedAtSegmentEnd &&
        !p.exposureLogs.some((log) => log.eventType === 'side_task_answered'),
    ).length;
    const nextPlan = plans.find((p) => p.scheduledAt && p.scheduledAt > now);
    const notificationPulse = this.buildSideTaskNotificationPulse({
      plans: visiblePlans,
      dispatchMode: effectiveDispatchMode,
      segmentIndex: currentSegmentIndex,
      segmentStarts: session.currentSegmentStarts,
      batchTriggerSec: config.sideTaskBatchTriggerSec,
      now,
    });

    const queue = visiblePlans.map((p) => {
      const answeredLog = p.exposureLogs.find((log) => log.eventType === 'side_task_answered');
      return {
        planId: p.id,
        text: p.item.text,
        question: p.item.question,
        optionA: p.item.optionA,
        optionB: p.item.optionB,
        directAiFlag: p.item.directAiFlag,
        narrativeCategory: p.item.narrativeCategory,
        queueOrder: p.queueOrder,
        batchNo: p.batchNo,
        answered: Boolean(answeredLog),
        answer: answeredLog ? (answeredLog.payload as Record<string, unknown>)?.answer ?? null : null,
      };
    });

    return {
      sideTaskQueue: queue,
      sideTaskConfig: {
        dispatchMode: effectiveDispatchMode as 'continuous' | 'batch',
        scrollDurationSec: config.sideTaskScrollDurationSec,
        holdSec: config.sideTaskHoldSec,
        fadeSec: config.sideTaskFadeSec,
        pauseSec: effectivePauseSec,
        totalPlanned: plans.length,
        totalReleased: releasedCount,
        totalAnswered: answeredCount,
        totalArchived: archivedUnansweredCount,
        nextScheduledAt: nextPlan?.scheduledAt?.toISOString() ?? null,
        notificationPulse,
        pendingLabel: '待处理事宜',
        tickerMessage: '您有新事项入库，请尽快处理',
      },
    };
  }

  private buildSideTaskNotificationPulse(input: {
    plans: Array<{
      id: string;
      scheduledAt: Date | null;
      exposureLogs: Array<{ eventType: string; eventAt: Date }>;
    }>;
    dispatchMode: string;
    segmentIndex: number;
    segmentStarts: Date | null;
    batchTriggerSec: number;
    now: Date;
  }) {
    const pendingUnnotified = input.plans.filter((plan) => {
      const answered = plan.exposureLogs.some((log) => log.eventType === 'side_task_answered');
      const notified = plan.exposureLogs.some((log) => log.eventType === 'side_task_notified');
      return !answered && !notified;
    });
    if (pendingUnnotified.length === 0) return null;

    if (input.dispatchMode !== 'batch' || input.segmentIndex === 0) {
      const newest = pendingUnnotified[pendingUnnotified.length - 1];
      return {
        id: `continuous:${input.segmentIndex}:${newest.id}`,
        reason: 'continuous_arrival',
        planIds: pendingUnnotified.map((plan) => plan.id),
        newCount: pendingUnnotified.length,
        windowStart: pendingUnnotified[0]?.scheduledAt?.toISOString() ?? null,
        windowEnd: newest?.scheduledAt?.toISOString() ?? null,
      };
    }

    const segmentStarts = input.segmentStarts ?? input.now;
    const triggerSec = Math.max(1, input.batchTriggerSec || 300);
    const elapsedSec = Math.floor((input.now.getTime() - segmentStarts.getTime()) / 1000);
    const currentWindow = Math.floor(elapsedSec / triggerSec);
    if (currentWindow <= 0) return null;

    const windowEnd = new Date(segmentStarts.getTime() + currentWindow * triggerSec * 1000);
    const windowStart = new Date(windowEnd.getTime() - triggerSec * 1000);
    const windowPlans = pendingUnnotified.filter(
      (plan) => plan.scheduledAt && plan.scheduledAt <= windowEnd,
    );
    if (windowPlans.length === 0) return null;

    return {
      id: `batch:${input.segmentIndex}:${windowEnd.toISOString()}`,
      reason: 'batch_window',
      planIds: windowPlans.map((plan) => plan.id),
      newCount: windowPlans.length,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    };
  }

  private async activateCurrentATask(
    tx: Prisma.TransactionClient,
    task: TaskAssignment,
    segmentEndsAt: Date | null | undefined,
    now: Date,
    aiLevel: AiLevel,
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
            aAiLevelAtWindow: task.aAiLevelAtWindow ?? aiLevel,
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

  /**
   * 从锁定池中随机分配下一个公司给 B。
   * 池 = A 已提交 && B 未完成 && B 未分配的 FORMAL 公司。
   * 池空时 fallback 到 A 正在处理的公司（PreA 模式）。
   */
  private async assignNextTaskForB(
    tx: Prisma.TransactionClient,
    sessionId: string,
    tasks: TaskAssignment[],
    aiLevel: AiLevel,
  ): Promise<{ assigned: TaskAssignment | null; method: string }> {
    const maxBSeq = tasks.reduce((max, t) => Math.max(max, t.bSequenceIndex ?? 0), 0);
    const nextSeq = maxBSeq + 1;

    const formalTasks = tasks.filter((t) => t.phase === ExperimentPhase.FORMAL);

    // 1. 构建锁定池：A 已提交 && B 未完成 && B 未分配
    const pool = formalTasks.filter(
      (t) => t.aSubmittedAt !== null && t.bCompletedAt === null && t.bSequenceIndex === null,
    );

    if (pool.length > 0) {
      const seed = `${sessionId}:b_assign:${nextSeq}`;
      const pick = Math.floor(this.seededRandom(seed) * pool.length);
      const picked = pool[pick];
      const assignedAt = new Date();
      await tx.taskAssignment.update({
        where: { id: picked.id },
        data: {
          bSequenceIndex: nextSeq,
          bPostAAiLevel: picked.bPostAAiLevel ?? aiLevel,
          crossUpgradeBoundaryFlag: this.hasCrossUpgradeBoundary({ ...picked, bPostAAiLevel: picked.bPostAAiLevel ?? aiLevel }),
        },
      });
      await this.appendBAssignmentLog(tx, sessionId, {
        assignedAt: assignedAt.toISOString(),
        taskAssignmentId: picked.id,
        chosenTaskAssignmentId: picked.id,
        chosenCompanyId: picked.companyId,
        bSequenceIndex: nextSeq,
        assignmentPath: 'locked_pool',
        method: 'locked_pool',
        lockedPoolSize: pool.length,
        eligibleCompanyIds: pool.map((task) => task.companyId),
        eligibleTaskAssignmentIds: pool.map((task) => task.id),
        assignmentSeed: seed,
        preAActiveCompanyId: null,
      });
      return { assigned: picked, method: 'pool_random' };
    }

    // 2. 池空 → PreA fallback：A 正在处理 && B 未分配
    const preaCandidate = formalTasks.find(
      (t) => t.aSubmittedAt === null && t.aStartedAt !== null && t.bCompletedAt === null && t.bSequenceIndex === null,
    );

    if (preaCandidate) {
      const assignedAt = new Date();
      await tx.taskAssignment.update({
        where: { id: preaCandidate.id },
        data: {
          bSequenceIndex: nextSeq,
          bPreAAiLevel: preaCandidate.bPreAAiLevel ?? aiLevel,
          crossUpgradeBoundaryFlag: this.hasCrossUpgradeBoundary({ ...preaCandidate, bPreAAiLevel: preaCandidate.bPreAAiLevel ?? aiLevel }),
        },
      });
      await this.appendBAssignmentLog(tx, sessionId, {
        assignedAt: assignedAt.toISOString(),
        taskAssignmentId: preaCandidate.id,
        chosenTaskAssignmentId: preaCandidate.id,
        chosenCompanyId: preaCandidate.companyId,
        bSequenceIndex: nextSeq,
        assignmentPath: 'preA_fallback',
        method: 'preA_fallback',
        lockedPoolSize: 0,
        eligibleCompanyIds: [],
        eligibleTaskAssignmentIds: [],
        assignmentSeed: `${sessionId}:b_assign:${nextSeq}:preA`,
        preAActiveCompanyId: preaCandidate.companyId,
      });
      return { assigned: preaCandidate, method: 'prea_fallback' };
    }

    // 3. 都没有 → 空窗
    return { assigned: null, method: 'idle' };
  }

  private getCurrentAiLevel(
    config: ExperimentConfig,
    segmentIndex: number,
    session?: Pick<Session, 'experimentSnapshot'> | null,
  ) {
    if (segmentIndex === 0) return AiLevel.BASIC;
    const snapshot = this.parseExperimentSnapshot(session?.experimentSnapshot);
    const aiStates = snapshot?.segmentAiStates;
    const segmentNumber = segmentIndex <= 1 ? 1 : segmentIndex <= 3 ? 2 : 3;
    const snapshotLevel = aiStates?.[String(segmentNumber)];
    if (snapshotLevel === AiLevel.ADVANCED || snapshotLevel === 'ADVANCED') return AiLevel.ADVANCED;
    if (snapshotLevel === AiLevel.BASIC || snapshotLevel === 'BASIC') return AiLevel.BASIC;
    if (segmentIndex <= 1) return config.segmentOneAiLevel;
    if (segmentIndex <= 3) return config.segmentTwoAiLevel;
    return config.segmentThreeAiLevel;
  }

  private async appendBAssignmentLog(
    tx: Prisma.TransactionClient,
    sessionId: string,
    entry: Prisma.InputJsonObject,
  ) {
    const auditTx = tx as Prisma.TransactionClient & {
      randomizationAudit: typeof this.prisma.randomizationAudit;
      experimentEvent: typeof this.prisma.experimentEvent;
    };
    const audit = await auditTx.randomizationAudit.findUnique({
      where: { sessionId },
      select: { bAssignmentLog: true },
    });
    const current = Array.isArray(audit?.bAssignmentLog) ? audit.bAssignmentLog : [];
    await auditTx.randomizationAudit.update({
      where: { sessionId },
      data: { bAssignmentLog: [...current, entry] as Prisma.InputJsonValue },
    });
    await auditTx.experimentEvent.create({
      data: {
        sessionId,
        taskAssignmentId: String(entry.taskAssignmentId ?? ''),
        companyId: String(entry.chosenCompanyId ?? ''),
        role: ParticipantRole.B,
        eventType: 'b_company_assigned',
        phase: ExperimentPhase.FORMAL,
        payload: entry,
      },
    });
  }

  private parseExperimentSnapshot(value: unknown): RuntimeExperimentSnapshot | null {
    return value && typeof value === 'object' ? value as RuntimeExperimentSnapshot : null;
  }

  private hasCrossUpgradeBoundary(task: Pick<TaskAssignment, 'aAiLevelAtWindow' | 'bPreAAiLevel' | 'bPostAAiLevel'>) {
    const levels = [task.aAiLevelAtWindow, task.bPreAAiLevel, task.bPostAAiLevel].filter(Boolean);
    return levels.includes(AiLevel.BASIC) && levels.includes(AiLevel.ADVANCED);
  }

  private buildAiUpgradeNotice(config: ExperimentConfig, session: RuntimeSession) {
    if (session.experimentMode !== 'ai_upgrade') return null;
    const blocks = this.buildInstructionBlocks(config.instructionBlocks, session.experimentMode);
    if (session.runtimePhase === RuntimePhase.FORMAL_BREAK) {
      const nextWorkSegment = session.currentSegmentIndex + 1;
      const previousAiLevel = this.getCurrentAiLevel(config, Math.max(1, session.currentSegmentIndex - 1), session);
      const nextAiLevel = this.getCurrentAiLevel(config, nextWorkSegment, session);
      if (previousAiLevel === AiLevel.BASIC && nextAiLevel === AiLevel.ADVANCED) {
        return { type: 'break', message: blocks.aiUpgradeBreakNotice };
      }
    }
    if (session.runtimePhase === RuntimePhase.FORMAL_WORK) {
      const currentAiLevel = this.getCurrentAiLevel(config, session.currentSegmentIndex, session);
      const previousWorkSegment = session.currentSegmentIndex - 2;
      const previousAiLevel =
        previousWorkSegment >= 1 ? this.getCurrentAiLevel(config, previousWorkSegment, session) : currentAiLevel;
      if (previousAiLevel === AiLevel.BASIC && currentAiLevel === AiLevel.ADVANCED) {
        return { type: 'workspace', message: blocks.aiUpgradeWorkspaceNotice };
      }
    }
    return null;
  }

  private buildInstructionBlocks(value: unknown, experimentMode: string) {
    const defaults = {
      commonTitle: '开始前，请先阅读以下提示',
      commonBody: '本实验会先完成测试题和测试轮，再进入正式任务。请尽量保持页面开启，不要随意刷新或关闭浏览器窗口。',
      roleA: '你需要阅读材料、记录关键信息，并整理出供投资经理使用的尽调内容。',
      roleB: '你需要综合自有材料、尽调信息和自己的判断，完成投资决策并给出反馈。',
      manual: '',
      ai_upgrade: '正式任务中，AI 辅助能力可能会在不同阶段发生变化。请以页面中显示的当前 AI 状态为准。',
      side_reminder: '正式任务中，待处理事宜会按系统安排进入队列。请在主线任务与待处理事宜之间合理分配注意力。',
      coop_narrative: '正式任务中，待处理事宜可能包含与团队协作相关的信息。请正常阅读并完成对应判断。',
      aiUpgradeBreakNotice: '下一阶段起，AI 辅助功能已升级，您可以上传图片并使用更强模型辅助分析。',
      aiUpgradeWorkspaceNotice: '当前 AI 辅助功能已升级。',
    };
    const raw = value && typeof value === 'object' ? value as Record<string, unknown> : {};
    const blocks = Object.fromEntries(
      Object.entries(defaults).map(([key, fallback]) => [
        key,
        typeof raw[key] === 'string' ? String(raw[key]) : fallback,
      ]),
    ) as typeof defaults;
    return {
      ...blocks,
      activeModeText: blocks[experimentMode as keyof typeof blocks] ?? '',
    };
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
      usage: String(company.usage ?? 'formal'),
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

  private normalizeQuestionnaireItems(value: unknown) {
    if (!Array.isArray(value)) return [];
    return value
      .map((item, index) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        const options = Array.isArray(row.options) ? row.options.map((option) => String(option)).filter(Boolean) : [];
        return {
          id: String(row.id ?? `q${index + 1}`),
          prompt: String(row.prompt ?? ''),
          options,
          correctOption: row.correctOption ? String(row.correctOption) : '',
        };
      })
      .filter((item) => item.prompt && item.options.length >= 2);
  }

  private resolvePracticeQuizPassCount(configuredPassCount: number, totalItems: number) {
    if (totalItems <= 0) return 0;
    if (!configuredPassCount || configuredPassCount < 1) return totalItems;
    return Math.min(configuredPassCount, totalItems);
  }

  private async getPracticeTutorialState(sessionId: string, participantId: string) {
    const progressRows = await this.prisma.taskProgress.findMany({
      where: {
        sessionId,
        participantId,
        stage: { in: ['practice_tutorial_step_completed', 'practice_tutorial_completed'] },
      },
      orderBy: { createdAt: 'asc' },
    });
    const completedSteps = progressRows
      .filter((row) => row.stage === 'practice_tutorial_step_completed')
      .map((row) => {
        const payload = row.payload && typeof row.payload === 'object' ? (row.payload as Record<string, unknown>) : {};
        return typeof payload.stepKey === 'string' ? payload.stepKey : null;
      })
      .filter((step): step is string => Boolean(step));

    return {
      steps: [...PRACTICE_TUTORIAL_STEPS],
      completedSteps: Array.from(new Set(completedSteps)),
      completed: progressRows.some((row) => row.stage === 'practice_tutorial_completed'),
    };
  }

  private async ensureConfig(): Promise<RuntimeConfig> {
    let config = await this.prisma.experimentConfig.findUnique({
      where: { id: 'default' },
      include: { activeQuestionnaireTemplate: true, practiceQuizTemplate: true },
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
      const practiceTemplate = await this.prisma.questionnaireTemplate.upsert({
        where: { id: 'default-practice-quiz' },
        update: { isActive: true },
        create: {
          id: 'default-practice-quiz',
          title: '测试轮开始前测试题',
          items: [
            {
              id: 'pq1',
              prompt: '尽调员完成单家公司 5 分钟时，系统会如何处理？',
              options: ['自动提交并解锁给投资经理', '继续无限作答直到手动提交'],
              correctOption: '自动提交并解锁给投资经理',
            },
            {
              id: 'pq2',
              prompt: '投资经理在尽调员信息解锁前，是否可以先看自己的材料并写草稿？',
              options: ['可以', '不可以'],
              correctOption: '可以',
            },
          ] as Prisma.InputJsonValue,
          isActive: true,
        },
      });

      config = await this.prisma.experimentConfig.create({
        data: {
          id: 'default',
          activeExperimentMode: 'manual',
          experimentModeSettings: {
            ai_upgrade: { fixedSideDispatchMode: 'continuous', fixedNarrativeGroup: 'neutral_info' },
            side_reminder: { fixedAiLevel: 'BASIC', fixedNarrativeGroup: 'neutral_info' },
            coop_narrative: { fixedAiLevel: 'BASIC', fixedSideDispatchMode: 'continuous' },
          } as Prisma.InputJsonValue,
          instructionBlocks: {
            commonTitle: '开始前，请先阅读以下提示',
            commonBody: '本实验会先完成测试题和测试轮，再进入正式任务。请尽量保持页面开启，不要随意刷新或关闭浏览器窗口。',
            roleA: '你需要阅读材料、记录关键信息，并整理出供投资经理使用的尽调内容。',
            roleB: '你需要综合自有材料、尽调信息和自己的判断，完成投资决策并给出反馈。',
            manual: '',
            ai_upgrade: '正式任务中，AI 辅助能力可能会在不同阶段发生变化。请以页面中显示的当前 AI 状态为准。',
            side_reminder: '正式任务中，待处理事宜会按系统安排进入队列。请在主线任务与待处理事宜之间合理分配注意力。',
            coop_narrative: '正式任务中，待处理事宜可能包含与团队协作相关的信息。请正常阅读并完成对应判断。',
            aiUpgradeBreakNotice: '下一阶段起，AI 辅助功能已升级，您可以上传图片并使用更强模型辅助分析。',
            aiUpgradeWorkspaceNotice: '当前 AI 辅助功能已升级。',
          } as Prisma.InputJsonValue,
          practiceDurationMinutes: 10,
          workDurationMinutes: 20,
          breakDurationMinutes: 5,
          segmentOneAiLevel: AiLevel.BASIC,
          segmentTwoAiLevel: AiLevel.ADVANCED,
          segmentThreeAiLevel: AiLevel.ADVANCED,
          activeQuestionnaireTemplateId: template.id,
          practiceQuizTemplateId: practiceTemplate.id,
          practiceQuizPassCount: 0,
        },
        include: { activeQuestionnaireTemplate: true, practiceQuizTemplate: true },
      });
    } else if (!config.practiceQuizTemplateId) {
      const practiceTemplate = await this.prisma.questionnaireTemplate.upsert({
        where: { id: 'default-practice-quiz' },
        update: { isActive: true },
        create: {
          id: 'default-practice-quiz',
          title: '测试轮开始前测试题',
          items: [
            {
              id: 'pq1',
              prompt: '尽调员完成单家公司 5 分钟时，系统会如何处理？',
              options: ['自动提交并解锁给投资经理', '继续无限作答直到手动提交'],
              correctOption: '自动提交并解锁给投资经理',
            },
          ] as Prisma.InputJsonValue,
          isActive: true,
        },
      });
      config = await this.prisma.experimentConfig.update({
        where: { id: config.id },
        data: { practiceQuizTemplateId: practiceTemplate.id },
        include: { activeQuestionnaireTemplate: true, practiceQuizTemplate: true },
      });
    }

    return config;
  }
}
