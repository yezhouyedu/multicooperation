import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AiLevel,
  ExperimentPhase,
  ParticipantRole,
  Prisma,
  RuntimePhase,
  SegmentType,
} from '@prisma/client';
import { existsSync } from 'fs';
import { mkdir, stat } from 'fs/promises';
import { basename, join, resolve } from 'path';
import { normalizeMaterials } from '../admin/materials';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';

type ExportScope = {
  sessionCodes?: string[];
  includeIncompleteSessions?: boolean;
};

type SessionExportRecord = Awaited<
  ReturnType<ExportService['loadSessions']>
>[number];
type ParticipantExportRecord = {
  id: string;
  phone: string | null;
  role: ParticipantRole | null;
  createdAt: Date;
  updatedAt: Date;
};

type SelfCheckRow = {
  variable: string;
  source: string;
  trigger: string;
  exportLocation: string;
  status: '已通过' | '有风险' | '缺失' | '可后处理' | '后续模块';
  notes: string;
};

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createExportJob(scope: ExportScope = {}) {
    await this.storage.ensureRoots();
    const job = await this.prisma.exportJob.create({
      data: {
        scope: {
          sessionCodes: scope.sessionCodes ?? [],
          includeIncompleteSessions: scope.includeIncompleteSessions ?? true,
        } as Prisma.InputJsonValue,
      },
    });

    await this.runExportJob(job.id);
    return this.getExportJob(job.id);
  }

  async getExportJob(jobId: string) {
    const job = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Export job not found');
    return { ok: true, job };
  }

  async getDownloadPath(jobId: string) {
    const job = await this.prisma.exportJob.findUnique({
      where: { id: jobId },
    });
    if (!job) throw new NotFoundException('Export job not found');
    if (job.status !== 'completed' || !job.archivePath) {
      throw new BadRequestException('Export job is not completed');
    }
    if (!existsSync(job.archivePath))
      throw new NotFoundException('Export archive not found');
    return { path: job.archivePath, filename: basename(job.archivePath) };
  }

  private async runExportJob(jobId: string) {
    const startedAt = new Date();
    await this.prisma.exportJob.update({
      where: { id: jobId },
      data: { status: 'running', startedAt },
    });

    try {
      const job = await this.prisma.exportJob.findUnique({
        where: { id: jobId },
      });
      if (!job) throw new NotFoundException('Export job not found');
      const scope = this.parseScope(job.scope);
      const stamp = this.formatStamp(startedAt);
      const exportId = `export_${stamp}_${jobId.slice(-6)}`;
      const outputDir = resolve(this.storage.exportsRoot, exportId);
      const sessions = await this.loadSessions(scope);
      const companies = await this.prisma.company.findMany({
        orderBy: { sortOrder: 'asc' },
      });

      await mkdir(outputDir, { recursive: true });
      await this.storage.writeJson(join(outputDir, 'manifest.json'), {
        schemaVersion: 1,
        exportId,
        exportedAt: startedAt.toISOString(),
        appVersion: 'local-dev',
        scope,
        counts: {
          sessions: sessions.length,
          participants: sessions.reduce(
            (sum, session) => sum + this.getParticipants(session).length,
            0,
          ),
          companies: companies.length,
          sideTaskPlans: sessions.reduce(
            (sum, session) => sum + session.sideTaskPlans.length,
            0,
          ),
          aiMessages: sessions.reduce(
            (sum, session) => sum + session.aiMessages.length,
            0,
          ),
          imageAttachments: this.countImageAttachments(sessions),
        },
      });

      for (const session of sessions) {
        await this.writeSession(outputDir, session);
      }

      await this.writeSelfCheck(outputDir, sessions);
      const archivePath = `${outputDir}.zip`;
      await this.storage.createZipFromDirectory(outputDir, archivePath);
      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: 'completed',
          outputDir,
          archivePath,
          finishedAt: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.exportJob.update({
        where: { id: jobId },
        data: {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : String(error),
          finishedAt: new Date(),
        },
      });
    }
  }

  private async loadSessions(scope: ExportScope) {
    const where: Prisma.SessionWhereInput = {};
    if (scope.sessionCodes?.length)
      where.code = { in: scope.sessionCodes.map((code) => code.toUpperCase()) };
    if (!scope.includeIncompleteSessions) where.status = 'COMPLETED';

    return this.prisma.session.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      include: {
        pairings: {
          include: {
            participantA: {
              select: {
                id: true,
                phone: true,
                role: true,
                createdAt: true,
                updatedAt: true,
              },
            },
            participantB: {
              select: {
                id: true,
                phone: true,
                role: true,
                createdAt: true,
                updatedAt: true,
              },
            },
          },
        },
        segmentStates: { orderBy: { segmentIndex: 'asc' } },
        tasks: {
          orderBy: [{ phase: 'asc' }, { sortOrder: 'asc' }],
          include: {
            company: true,
            snapshots: { orderBy: { createdAt: 'asc' } },
          },
        },
        progresses: {
          orderBy: { createdAt: 'asc' },
          include: {
            participant: { select: { id: true, phone: true, role: true } },
          },
        },
        snapshots: { orderBy: { createdAt: 'asc' } },
        questionnaireAnswers: {
          orderBy: { submittedAt: 'asc' },
          include: { template: true },
        },
        aiMessages: { orderBy: { createdAt: 'asc' } },
        sideTaskPlans: {
          orderBy: [{ segmentIndex: 'asc' }, { queueOrder: 'asc' }],
          include: {
            item: true,
            exposureLogs: { orderBy: { eventAt: 'asc' } },
          },
        },
        sideTaskConfig: true,
        sideTaskExposureLogs: {
          orderBy: { eventAt: 'asc' },
          include: { plan: { include: { item: true } } },
        },
        experimentEvents: { orderBy: { serverTime: 'asc' } },
        integrityStates: {
          include: { intervals: { orderBy: { startedAt: 'asc' } } },
          orderBy: { role: 'asc' },
        },
        randomizationAudit: true,
      },
    });
  }

  private async writeSession(outputDir: string, session: SessionExportRecord) {
    const sessionDir = join(outputDir, 'sessions', session.code);
    const participants = this.getParticipants(session);
    await this.storage.writeJson(
      join(sessionDir, 'session_metadata.json'),
      this.buildSessionMetadata(session),
    );
    await this.storage.writeJson(
      join(sessionDir, 'randomization.json'),
      this.buildRandomization(session),
    );

    for (const participant of participants) {
      await this.writeParticipant(
        sessionDir,
        session,
        participant,
        participants,
      );
    }
  }

  private async writeParticipant(
    sessionDir: string,
    session: SessionExportRecord,
    participant: ParticipantExportRecord,
    participants: ParticipantExportRecord[],
  ) {
    const participantDir = join(sessionDir, 'participants', participant.id);
    const role = this.resolveParticipantRole(session, participant.id);
    const partner =
      participants.find((item) => item.id !== participant.id) ?? null;
    const participantEvents = session.experimentEvents.filter(
      (event) => event.participantId === participant.id,
    );
    const legacyEvents = session.progresses
      .filter((progress) => progress.participantId === participant.id)
      .map((progress) => ({
        eventType: `legacy_${progress.stage}`,
        serverTime: progress.createdAt.toISOString(),
        participantId: progress.participantId,
        role: progress.participant.role,
        payload: progress.payload,
      }));

    await this.storage.writeJson(
      join(participantDir, 'participant_metadata.json'),
      {
        participantId: participant.id,
        phone: participant.phone,
        internalRole: role,
        displayRole: this.displayRole(role),
        partnerParticipantId: partner?.id ?? null,
        loginAt:
          this.firstEventTime(participantEvents, 'participant_login') ??
          participant.createdAt.toISOString(),
        instructionViewedAt: this.firstEventTime(
          participantEvents,
          'instruction_viewed',
        ),
        practiceReadyAt: this.firstEventTime(
          participantEvents,
          'practice_ready',
        ),
        formalReadyAt: this.firstEventTime(participantEvents, 'formal_ready'),
        completedAt:
          session.status === 'COMPLETED'
            ? session.updatedAt.toISOString()
            : null,
        qualityFlags: this.buildQualityFlags(session, participant.id),
      },
    );

    const timestamps = this.buildTimestamps(session, participant, role);
    await this.storage.writeJson(
      join(participantDir, 'variables.json'),
      this.buildVariables(session, participant, role, timestamps),
    );
    await this.storage.writeJson(
      join(participantDir, 'timestamps.json'),
      timestamps,
    );
    await this.storage.writeJson(
      join(participantDir, 'online_integrity.json'),
      this.buildOnlineIntegrity(session, participant.id),
    );
    await this.writeQuestionnaires(participantDir, session, participant.id);
    await this.writePracticeRound(
      participantDir,
      session,
      participant.id,
      role,
    );
    await this.writeFormalSegments(
      participantDir,
      session,
      participant.id,
      role,
    );
    await this.writeSideTasks(participantDir, session, participant.id);
    await this.storage.writeJsonl(
      join(participantDir, 'events', 'events.jsonl'),
      [
        ...participantEvents.map((event) => ({
          eventType: event.eventType,
          serverTime: event.serverTime.toISOString(),
          participantId: event.participantId,
          taskAssignmentId: event.taskAssignmentId,
          companyId: event.companyId,
          sideTaskPlanId: event.sideTaskPlanId,
          role: event.role,
          phase: event.phase,
          segmentIndex: event.segmentIndex,
          payload: event.payload,
        })),
        ...legacyEvents,
      ],
    );
    await this.copyParticipantAttachments(
      participantDir,
      session,
      participant.id,
    );
  }

  private async writeQuestionnaires(
    participantDir: string,
    session: SessionExportRecord,
    participantId: string,
  ) {
    const practiceRows = session.questionnaireAnswers.filter(
      (row) =>
        row.participantId === participantId &&
        row.phase === ExperimentPhase.PRACTICE,
    );
    await this.storage.writeJson(
      join(participantDir, 'questionnaires', 'practice_quiz.json'),
      {
        templateId: practiceRows.at(-1)?.templateId ?? null,
        submittedAt: practiceRows.at(-1)?.submittedAt?.toISOString() ?? null,
        attempts: practiceRows.map((row, index) => ({
          attemptNo: index + 1,
          submittedAt: row.submittedAt.toISOString(),
          templateId: row.templateId,
          answers: row.answers,
          templateItems: row.template?.items ?? null,
        })),
      },
    );

    for (const [filename, segmentIndex, workSegmentBeforeBreak] of [
      ['segment_1.json', 2, 1],
      ['segment_2.json', 4, 2],
      ['segment_3.json', 6, 3],
    ] as const) {
      const row = session.questionnaireAnswers.find(
        (item) =>
          item.participantId === participantId &&
          item.phase === ExperimentPhase.FORMAL &&
          item.segmentIndex === segmentIndex,
      );
      await this.storage.writeJson(
        join(participantDir, 'questionnaires', filename),
        {
          templateId: row?.templateId ?? null,
          segmentIndex,
          workSegment: workSegmentBeforeBreak,
          kind: 'segment_survey',
          shownAt:
            session.segmentStates
              .find((state) => state.segmentIndex === segmentIndex)
              ?.startedAt?.toISOString() ?? null,
          submittedAt: row?.submittedAt?.toISOString() ?? null,
          answers: row?.answers ?? null,
          templateItems: row?.template?.items ?? null,
          missing: !row,
        },
      );
    }

    const postSurvey = session.questionnaireAnswers.find(
      (item) =>
        item.participantId === participantId &&
        item.phase === ExperimentPhase.FORMAL &&
        item.segmentIndex === 99,
    );
    await this.storage.writeJson(
      join(participantDir, 'questionnaires', 'post_survey.json'),
      {
        templateId: postSurvey?.templateId ?? null,
        segmentIndex: 99,
        kind: 'post_survey',
        submittedAt: postSurvey?.submittedAt?.toISOString() ?? null,
        answers: postSurvey?.answers ?? null,
        templateItems: postSurvey?.template?.items ?? null,
        missing: !postSurvey,
      },
    );
  }

  private async writePracticeRound(
    participantDir: string,
    session: SessionExportRecord,
    participantId: string,
    role: ParticipantRole | null,
  ) {
    const state = session.segmentStates.find((item) => item.segmentIndex === 0);
    const dir = join(participantDir, 'practice_round');
    await this.storage.writeJson(join(dir, 'round_metadata.json'), {
      phase: 'PRACTICE',
      segmentIndex: 0,
      startedAt: state?.startedAt?.toISOString() ?? null,
      endedAt: state?.completedAt?.toISOString() ?? null,
    });

    for (const task of session.tasks.filter(
      (item) => item.phase === ExperimentPhase.PRACTICE,
    )) {
      const companyDir = join(
        dir,
        'companies',
        this.companyDirName(task.company),
      );
      await this.writeCompanyFiles(
        companyDir,
        session,
        task,
        participantId,
        role,
      );
    }

    await this.storage.writeJsonl(
      join(dir, 'side_tasks.jsonl'),
      this.buildSideResponses(session, participantId, 0),
    );
    await this.storage.writeJsonl(
      join(dir, 'side_ai_chat.jsonl'),
      this.buildAiRows(session, participantId, {
        contextType: 'side',
        segmentIndex: 0,
      }),
    );
  }

  private async writeFormalSegments(
    participantDir: string,
    session: SessionExportRecord,
    participantId: string,
    role: ParticipantRole | null,
  ) {
    for (const [workSegment, segmentIndex] of [
      [1, 1],
      [2, 3],
      [3, 5],
    ] as const) {
      const dir = join(
        participantDir,
        'formal_segments',
        `segment_${workSegment}`,
      );
      const state = session.segmentStates.find(
        (item) => item.segmentIndex === segmentIndex,
      );
      await this.storage.writeJson(join(dir, 'segment_metadata.json'), {
        workSegment,
        segmentIndex,
        preSegmentInstruction: this.instructionForSegment(session, workSegment),
        startedAt: state?.startedAt?.toISOString() ?? null,
        plannedEndsAt: state?.endsAt?.toISOString() ?? null,
        endedAt: state?.completedAt?.toISOString() ?? null,
        aiLevel: this.segmentAiLevel(session, workSegment),
        sideDispatchMode:
          session.sideTaskConfig?.dispatchMode ??
          this.snapshotValue(session, 'sideDispatchMode'),
        narrativeGroup:
          session.sideTaskConfig?.narrativeGroup ??
          this.snapshotValue(session, 'narrativeGroup'),
        themeLabel: this.themeForSegment(session, workSegment),
        companyIdsTouchedByParticipant: this.touchedCompanyIds(
          session,
          role,
          segmentIndex,
        ),
      });

      const tasks = session.tasks.filter(
        (task) =>
          task.phase === ExperimentPhase.FORMAL &&
          this.taskTouchesParticipant(task, role),
      );
      for (const task of tasks) {
        const firstSeen = this.taskFirstSeenSegment(task, role);
        if (
          firstSeen !== segmentIndex &&
          !task.snapshots.some(
            (snapshot) => snapshot.segmentIndex === segmentIndex,
          )
        )
          continue;
        const companyDir = join(
          dir,
          'companies',
          this.companyDirName(task.company),
        );
        await this.writeCompanyFiles(
          companyDir,
          session,
          task,
          participantId,
          role,
        );
      }
    }
  }

  private async writeCompanyFiles(
    companyDir: string,
    session: SessionExportRecord,
    task: SessionExportRecord['tasks'][number],
    participantId: string,
    role: ParticipantRole | null,
  ) {
    await this.storage.writeJson(
      join(companyDir, 'company_metadata.json'),
      this.buildCompanyMetadata(session, task, role),
    );
    await this.storage.writeJson(
      join(companyDir, 'answer_content.json'),
      this.buildAnswerContent(task, role),
    );
    await this.storage.writeJsonl(
      join(companyDir, 'snapshots.jsonl'),
      task.snapshots
        .filter(
          (snapshot) =>
            !snapshot.participantId ||
            snapshot.participantId === participantId ||
            snapshot.role === role,
        )
        .map((snapshot) => ({
          snapshotType: snapshot.snapshotType,
          takenReason: snapshot.takenReason,
          segmentIndex: snapshot.segmentIndex,
          createdAt: snapshot.createdAt.toISOString(),
          role: snapshot.role,
          section: snapshot.section,
          payload: snapshot.payload,
        })),
    );
    await this.storage.writeJsonl(
      join(companyDir, 'ai_chat.jsonl'),
      this.buildAiRows(session, participantId, {
        contextType: 'main',
        companyId: task.companyId,
        taskAssignmentId: task.id,
      }),
    );
  }

  private async writeSideTasks(
    participantDir: string,
    session: SessionExportRecord,
    participantId: string,
  ) {
    const sideDir = join(participantDir, 'side_tasks');
    await this.storage.writeJson(join(sideDir, 'side_plan.json'), {
      sessionPlanId: `session_side_plan_${session.code}`,
      participantId,
      dispatchMode: session.sideTaskConfig?.dispatchMode ?? null,
      narrativeGroup: session.sideTaskConfig?.narrativeGroup ?? null,
      themeOrder: session.sideTaskConfig?.themeOrder ?? [],
      plans: session.sideTaskPlans.map((plan) => ({
        planId: plan.id,
        itemId: plan.itemId,
        itemCode: plan.item.itemCode,
        workSegment: plan.item.workSegment,
        segmentIndex: plan.segmentIndex,
        poolType: plan.item.poolType,
        narrativeCategory: plan.item.narrativeCategory,
        themeLabel: plan.themeLabel,
        queueOrder: plan.queueOrder,
        batchNo: plan.batchNo,
        scheduledAt: plan.scheduledAt?.toISOString() ?? null,
        releasedAt: plan.releasedAt?.toISOString() ?? null,
        archivedAtSegmentEnd: plan.isArchivedAtSegmentEnd,
      })),
    });
    await this.storage.writeJsonl(
      join(sideDir, 'side_responses.jsonl'),
      this.buildSideResponses(session, participantId),
    );
    await this.storage.writeJsonl(
      join(sideDir, 'side_events.jsonl'),
      session.sideTaskExposureLogs
        .filter((log) => log.participantId === participantId)
        .map((log) => ({
          participantId: log.participantId,
          planId: log.sideTaskPlanId,
          itemId: log.plan.itemId,
          itemCode: log.plan.item.itemCode,
          eventType: log.eventType,
          eventAt: log.eventAt.toISOString(),
          payload: log.payload,
        })),
    );
    await this.storage.writeJsonl(
      join(sideDir, 'side_ai_chat.jsonl'),
      this.buildAiRows(session, participantId, { contextType: 'side' }),
    );
  }

  private buildSideResponses(
    session: SessionExportRecord,
    participantId: string,
    segmentIndex?: number,
  ) {
    return session.sideTaskPlans
      .filter(
        (plan) =>
          segmentIndex === undefined || plan.segmentIndex === segmentIndex,
      )
      .map((plan) => {
        const logs = plan.exposureLogs.filter(
          (log) => log.participantId === participantId,
        );
        const answered = logs.find(
          (log) => log.eventType === 'side_task_answered',
        );
        const opened = this.sideTaskOpenedForAnswer(
          logs,
          answered?.eventAt ?? null,
        );
        const shown = logs.find(
          (log) => log.eventType === 'side_task_released',
        );
        const notified = logs.find(
          (log) => log.eventType === 'side_task_notified',
        );
        const selectedAnswer = this.payloadValue(answered?.payload, 'answer');
        const selectedOptionKey = this.sideTaskOptionKey(plan, selectedAnswer);
        const correctAnswerText = this.sideTaskGoldAnswerText(plan);
        const isCorrect = selectedAnswer
          ? selectedOptionKey === plan.item.goldAnswer ||
            selectedAnswer === correctAnswerText
          : null;
        return {
          participantId,
          planId: plan.id,
          itemId: plan.itemId,
          itemCode: plan.item.itemCode,
          workSegment: plan.item.workSegment,
          poolType: plan.item.poolType,
          eventArchetype: plan.item.eventArchetype,
          eventChain: plan.item.eventChain,
          surfaceScenario: plan.item.surfaceScenario,
          languageVariant: plan.item.languageVariant,
          narrativeCategory: plan.item.narrativeCategory,
          narrativeSubtype: plan.item.narrativeSubtype,
          directAiFlag: plan.item.directAiFlag,
          prompt: plan.item.text,
          question: plan.item.question,
          questionVariantId: plan.item.questionVariantId,
          options: [plan.item.optionA, plan.item.optionB],
          goldAnswer: plan.item.goldAnswer,
          correctAnswerText,
          evidenceSpan: plan.item.evidenceSpan,
          distractorType: plan.item.distractorType,
          narrativeComponents: plan.item.narrativeComponents,
          spilloverRiskFlag: plan.item.spilloverRiskFlag,
          spilloverRiskNote: plan.item.spilloverRiskNote,
          difficulty: plan.item.difficulty,
          version: plan.item.version,
          shownAt:
            shown?.eventAt?.toISOString() ??
            plan.releasedAt?.toISOString() ??
            null,
          openedAt: opened?.eventAt?.toISOString() ?? null,
          notifiedAt: notified?.eventAt?.toISOString() ?? null,
          answeredAt: answered?.eventAt?.toISOString() ?? null,
          selectedAnswer,
          selectedOptionKey,
          isCorrect,
          reactionTimeMs:
            answered && opened
              ? answered.eventAt.getTime() - opened.eventAt.getTime()
              : null,
          archivedAtSegmentEnd: plan.isArchivedAtSegmentEnd,
        };
      });
  }

  private buildAiRows(
    session: SessionExportRecord,
    participantId: string,
    filter: {
      contextType: string;
      companyId?: string;
      taskAssignmentId?: string;
      segmentIndex?: number;
    },
  ) {
    return session.aiMessages
      .filter((message) => message.participantId === participantId)
      .filter((message) => message.contextType === filter.contextType)
      .filter((message) =>
        filter.companyId ? message.companyId === filter.companyId : true,
      )
      .filter((message) =>
        filter.taskAssignmentId
          ? message.taskAssignmentId === filter.taskAssignmentId
          : true,
      )
      .filter((message) =>
        filter.segmentIndex !== undefined
          ? message.segmentIndex === filter.segmentIndex
          : true,
      )
      .map((message) => ({
        requestId: message.requestId,
        messageRole: message.messageRole,
        createdAt: message.createdAt.toISOString(),
        completedAt: message.completedAt?.toISOString() ?? null,
        latencyMs: message.latencyMs,
        contextType: message.contextType,
        companyId: message.companyId,
        taskAssignmentId: message.taskAssignmentId,
        sideTaskPlanId: message.sideTaskPlanId,
        workSegment: this.workSegmentFromSegmentIndex(message.segmentIndex),
        phase: message.phase,
        segmentIndex: message.segmentIndex,
        aiLevel: message.aiLevel,
        modelVersion: message.modelVersion,
        providerStatus: message.providerStatus,
        errorMessage: message.errorMessage,
        content: message.content,
        attachments: this.normalizeExportAttachments(message.attachments),
      }));
  }

  private async copyParticipantAttachments(
    participantDir: string,
    session: SessionExportRecord,
    participantId: string,
  ) {
    const rows = session.aiMessages.filter(
      (message) => message.participantId === participantId,
    );
    for (const row of rows) {
      const attachments = Array.isArray(row.attachments) ? row.attachments : [];
      for (const attachment of attachments) {
        if (!attachment || typeof attachment !== 'object') continue;
        const sourcePath = String(
          (attachment as Record<string, unknown>).absolutePath ?? '',
        );
        const relativePath = this.exportAttachmentRelativePath(
          attachment as Record<string, unknown>,
        );
        if (!sourcePath || !relativePath || !existsSync(sourcePath)) continue;
        await this.storage.copyIfExists(
          sourcePath,
          join(participantDir, relativePath),
        );
      }
    }
  }

  private buildSessionMetadata(session: SessionExportRecord) {
    const snapshot = this.parseObject(session.experimentSnapshot);
    return {
      sessionId: session.id,
      sessionCode: session.code,
      createdAt: session.createdAt.toISOString(),
      completedAt:
        session.status === 'COMPLETED' ? session.updatedAt.toISOString() : null,
      status: session.status,
      runtimePhase: session.runtimePhase,
      durations: {
        practiceMinutes: this.durationMinutes(
          session.segmentStates.find((state) => state.segmentIndex === 0),
        ),
        workMinutes: this.durationMinutes(
          session.segmentStates.find((state) => state.segmentIndex === 1),
        ),
        breakMinutes: this.durationMinutes(
          session.segmentStates.find((state) => state.segmentIndex === 2),
        ),
        aCompanyWindowSeconds: 300,
      },
      experimentConfigSnapshot: {
        activeExperimentMode: session.experimentMode,
        snapshot,
      },
      experimentRun: {
        experimentRunId: session.experimentRunId,
        experimentCondition: session.experimentCondition,
        conditionAssignedAt: session.conditionAssignedAt?.toISOString() ?? null,
      },
      qualityFlags: this.buildSessionIntegrityFlags(session),
    };
  }

  private buildRandomization(session: SessionExportRecord) {
    const pairing = session.pairings[0] ?? null;
    const audit = session.randomizationAudit;
    const experiment = this.parseObject(
      audit?.experimentRandomization ?? session.experimentSnapshot,
    );
    return {
      experimentConditionAssignment: {
        experimentRunId: session.experimentRunId,
        experimentCondition: session.experimentCondition,
        method: audit?.conditionAssignmentMethod ?? null,
        seed: audit?.conditionAssignmentSeed ?? null,
        blockIndex: audit?.conditionBlockIndex ?? null,
        positionInBlock: audit?.conditionBlockPosition ?? null,
        globalPosition: audit?.conditionGlobalPosition ?? null,
        assignedAt:
          audit?.conditionAssignedAt?.toISOString() ??
          session.conditionAssignedAt?.toISOString() ??
          null,
      },
      roleAssignment: {
        method: audit?.roleAssignmentMethod ?? 'unknown',
        seed: audit?.roleAssignmentSeed ?? null,
        assignedAt: audit?.roleAssignedAt?.toISOString() ?? null,
        participantAId: pairing?.participantAId ?? null,
        participantBId: pairing?.participantBId ?? null,
      },
      companySequence: {
        method: audit?.companySequenceMethod ?? 'unknown',
        seed: audit?.companySequenceSeed ?? null,
        generatedAt: audit?.companySequenceGeneratedAt?.toISOString() ?? null,
        sequence:
          audit?.companySequence ??
          session.tasks.map((task) => ({
            sequenceIndex: task.sequenceIndex,
            companyId: task.companyId,
            companyCode: this.companyCode(task.company),
          })),
      },
      bAssignment: {
        method: audit?.bAssignmentMethod ?? 'pool_based_random_v1',
        log: audit?.bAssignmentLog ?? [],
      },
      instructionPlan: experiment.instructionPlan ?? null,
      experiment,
    };
  }

  private buildCompanyMetadata(
    session: SessionExportRecord,
    task: SessionExportRecord['tasks'][number],
    role: ParticipantRole | null,
  ) {
    const materials = normalizeMaterials(task.company.materials);
    return {
      company: {
        companyId: task.companyId,
        companyCode: this.companyCode(task.company),
        companyName: task.company.name,
        sequenceIndex: task.sequenceIndex,
        materialVersion: this.materialVersion(materials),
      },
      task: {
        taskAssignmentId: task.id,
        phase: task.phase,
        workSegmentFirstSeen: this.workSegmentFromSegmentIndex(
          this.taskFirstSeenSegment(task, role),
        ),
        internalRole: role,
        displayRole: this.displayRole(role),
        bSequenceIndex: task.bSequenceIndex,
        bAssignmentPath: this.bAssignmentPath(session, task.id),
        bAssignmentDetail: this.bAssignmentDetail(session, task.id),
      },
      materials: {
        companyId: task.companyId,
        materialVersion: this.materialVersion(materials),
        visibleMaterialIds: this.visibleMaterials(materials, role).map(
          (item) => item.id,
        ),
        visibleMaterialNames: this.visibleMaterials(materials, role).map(
          (item) => item.displayName,
        ),
        visibleScopes: this.visibleMaterials(materials, role).map((item) =>
          this.materialScope(item),
        ),
        diligenceMaterialIds: materials
          .filter((item) => this.materialScope(item) === 'diligence')
          .map((item) => item.id),
        managerMaterialIds: materials
          .filter((item) => this.materialScope(item) === 'manager')
          .map((item) => item.id),
        researchOnlyMaterialIds: materials
          .filter((item) => this.materialScope(item) === 'research')
          .map((item) => item.id),
        storageKeys: this.visibleMaterials(materials, role).map(
          (item) => item.storageKey,
        ),
      },
      timing: {
        aStartedAt: task.aStartedAt?.toISOString() ?? null,
        aDeadlineAt: task.aDeadlineAt?.toISOString() ?? null,
        aSubmittedAt: task.aSubmittedAt?.toISOString() ?? null,
        aUnlockedForBAt: task.aUnlockedForBAt?.toISOString() ?? null,
        bAssignedAt: this.bAssignedAt(session, task.id),
        bViewedAInfoAt: task.bViewedAInfoAt?.toISOString() ?? null,
        bViewedAMaterialsAt: task.bViewedAMaterialsAt?.toISOString() ?? null,
        bCompletedAt: task.bCompletedAt?.toISOString() ?? null,
      },
      aiState: {
        aAiLevelAtWindow: task.aAiLevelAtWindow,
        bPreAAiLevel: task.bPreAAiLevel,
        bPostAAiLevel: task.bPostAAiLevel,
        crossUpgradeBoundaryFlag: task.crossUpgradeBoundaryFlag,
      },
    };
  }

  private buildAnswerContent(
    task: SessionExportRecord['tasks'][number],
    role: ParticipantRole | null,
  ) {
    const isA = role === ParticipantRole.A;
    const payload = isA ? task.aDraft : task.bDraft;
    return {
      internalRole: role,
      displayRole: this.displayRole(role),
      taskAssignmentId: task.id,
      companyId: task.companyId,
      savedAt: task.updatedAt.toISOString(),
      submittedAt: isA
        ? (task.aSubmittedAt?.toISOString() ?? null)
        : (task.bCompletedAt?.toISOString() ?? null),
      submitType: isA && task.aSubmittedAt ? 'auto_or_system' : null,
      fields: payload ?? {},
      rawDraft: payload ?? {},
      rawFeedbackDraft:
        role === ParticipantRole.B ? (task.bFeedbackDraft ?? {}) : {},
    };
  }

  private buildVariables(
    session: SessionExportRecord,
    participant: ParticipantExportRecord,
    role: ParticipantRole | null,
    timestamps?: ReturnType<ExportService['buildTimestamps']>,
  ) {
    const participantId = participant.id;
    const sideRows = this.buildSideResponses(session, participantId);
    const aiRows = session.aiMessages.filter(
      (message) => message.participantId === participantId,
    );
    const formalQuestionnaires = session.questionnaireAnswers.filter(
      (item) =>
        item.participantId === participantId &&
        item.phase === ExperimentPhase.FORMAL,
    );
    const questionnairePayload = (segmentIndex: number) => {
      const value = formalQuestionnaires.find(
        (row) => row.segmentIndex === segmentIndex,
      )?.answers;
      return value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : null;
    };
    const participantTasks = session.tasks.filter((task) =>
      this.taskTouchesParticipant(task, role),
    );
    return {
      schemaVersion: 2,
      participantId,
      sessionCode: session.code,
      role,
      displayRole: this.displayRole(role),
      treatments: {
        experimentMode: session.experimentMode,
        experimentRunId: session.experimentRunId,
        experimentCondition: session.experimentCondition,
        aiEnabled: this.snapshotValue(session, 'aiEnabled'),
        aiCondition: this.snapshotValue(session, 'aiCondition'),
        upgradeCohort:
          session.upgradeCohort ?? this.snapshotValue(session, 'upgradeCohort'),
        sideDispatchMode:
          session.sideTaskConfig?.dispatchMode ??
          this.snapshotValue(session, 'sideDispatchMode'),
        narrativeGroup:
          session.sideTaskConfig?.narrativeGroup ??
          this.snapshotValue(session, 'narrativeGroup'),
        themeOrder:
          session.sideTaskConfig?.themeOrder ??
          this.snapshotValue(session, 'themeOrder') ??
          [],
        segmentAiStates: this.snapshotValue(session, 'segmentAiStates'),
      },
      mainline: {
        companyCountTouched: participantTasks.length,
        companyCountCompleted: participantTasks.filter((task) =>
          role === ParticipantRole.A ? task.aSubmittedAt : task.bCompletedAt,
        ).length,
        autoSubmittedCount:
          role === ParticipantRole.A
            ? participantTasks.filter((task) => task.aSubmittedAt).length
            : 0,
        viewedAInfoCount:
          role === ParticipantRole.B
            ? participantTasks.filter((task) => task.bViewedAInfoAt).length
            : 0,
        viewedAMaterialsCount:
          role === ParticipantRole.B
            ? participantTasks.filter((task) => task.bViewedAMaterialsAt).length
            : 0,
        meanTimeToViewASeconds:
          role === ParticipantRole.B
            ? this.meanTimeToViewA(participantTasks)
            : null,
        meanBSubmitDelaySeconds:
          role === ParticipantRole.B
            ? this.meanBSubmitDelay(participantTasks)
            : null,
      },
      instructions: this.buildInstructionVariables(session, participantId),
      timing:
        timestamps?.derived ??
        this.buildTimestamps(session, participant, role).derived,
      ai: {
        mainAiRequestCount: aiRows.filter(
          (message) =>
            message.contextType === 'main' && message.messageRole === 'user',
        ).length,
        sideAiRequestCount: aiRows.filter(
          (message) =>
            message.contextType === 'side' && message.messageRole === 'user',
        ).length,
        basicRequestCount: aiRows.filter(
          (message) =>
            message.aiLevel === AiLevel.BASIC && message.messageRole === 'user',
        ).length,
        advancedRequestCount: aiRows.filter(
          (message) =>
            message.aiLevel === AiLevel.ADVANCED &&
            message.messageRole === 'user',
        ).length,
        imageUploadCount: aiRows.filter(
          (message) =>
            Array.isArray(message.attachments) &&
            message.attachments.length > 0,
        ).length,
      },
      sideTask: {
        plannedCount: sideRows.length,
        releasedCount: sideRows.filter((row) => row.shownAt).length,
        shownCount: sideRows.filter((row) => row.shownAt).length,
        answeredCount: sideRows.filter((row) => row.answeredAt).length,
        correctCount: sideRows.filter((row) => row.isCorrect === true).length,
        accuracy: this.accuracy(sideRows),
      },
      questionnaire: {
        practiceQuizPassed: Boolean(
          session.questionnaireAnswers.find(
            (row) =>
              row.participantId === participantId &&
              row.phase === ExperimentPhase.PRACTICE,
          )?.answers,
        ),
        segmentSurveySubmittedCount: [2, 4, 6].filter((segmentIndex) =>
          formalQuestionnaires.some((row) => row.segmentIndex === segmentIndex),
        ).length,
        segment1Submitted: formalQuestionnaires.some(
          (row) => row.segmentIndex === 2,
        ),
        segment2Submitted: formalQuestionnaires.some(
          (row) => row.segmentIndex === 4,
        ),
        segment3Submitted: formalQuestionnaires.some(
          (row) => row.segmentIndex === 6,
        ),
        postSurveySubmitted: formalQuestionnaires.some(
          (row) => row.segmentIndex === 99,
        ),
        templateVersion:
          questionnairePayload(99)?.templateVersion ??
          questionnairePayload(6)?.templateVersion ??
          null,
        displayedItemCodesByStage: {
          segment1: questionnairePayload(2)?.displayedItemCodes ?? [],
          segment2: questionnairePayload(4)?.displayedItemCodes ?? [],
          segment3: questionnairePayload(6)?.displayedItemCodes ?? [],
          postSurvey: questionnairePayload(99)?.displayedItemCodes ?? [],
        },
        displayContextByStage: {
          segment1: questionnairePayload(2)?.displayContext ?? null,
          segment2: questionnairePayload(4)?.displayContext ?? null,
          segment3: questionnairePayload(6)?.displayContext ?? null,
          postSurvey: questionnairePayload(99)?.displayContext ?? null,
        },
        paymentPhoneConfirmed: session.progresses.some(
          (row) =>
            row.participantId === participantId &&
            row.stage === 'payment_phone_confirmed',
        ),
      },
      qualityFlags: this.buildQualityFlags(session, participantId),
    };
  }

  private async writeSelfCheck(
    outputDir: string,
    sessions: SessionExportRecord[],
  ) {
    await this.writeDynamicSelfCheck(outputDir, sessions);
  }

  private async writeDynamicSelfCheck(
    outputDir: string,
    sessions: SessionExportRecord[],
  ) {
    const participantRecords = sessions.flatMap((session) =>
      this.getParticipants(session).map((participant) => ({
        session,
        participant,
        role: this.resolveParticipantRole(session, participant.id),
        dir: join(
          outputDir,
          'sessions',
          session.code,
          'participants',
          participant.id,
        ),
      })),
    );
    const allAiMessages = sessions.flatMap((session) => session.aiMessages);
    const mainAiUserMessages = allAiMessages.filter(
      (message) =>
        message.contextType === 'main' && message.messageRole === 'user',
    );
    const sideAiUserMessages = allAiMessages.filter(
      (message) =>
        message.contextType === 'side' && message.messageRole === 'user',
    );
    const allSideRows = participantRecords.flatMap(({ session, participant }) =>
      this.buildSideResponses(session, participant.id),
    );
    const answeredSideRows = allSideRows.filter((row) => row.answeredAt);
    const missingParticipantFiles = participantRecords.flatMap(({ dir }) =>
      [
        'participant_metadata.json',
        'variables.json',
        'timestamps.json',
        join('questionnaires', 'practice_quiz.json'),
        join('questionnaires', 'segment_1.json'),
        join('questionnaires', 'segment_2.json'),
        join('questionnaires', 'segment_3.json'),
        join('questionnaires', 'post_survey.json'),
        join('practice_round', 'round_metadata.json'),
        join('side_tasks', 'side_plan.json'),
        join('side_tasks', 'side_responses.jsonl'),
        join('side_tasks', 'side_events.jsonl'),
        join('events', 'events.jsonl'),
      ].filter((relativePath) => !existsSync(join(dir, relativePath))),
    );
    const companyFileIssues = participantRecords.flatMap(
      ({ session, participant, role, dir }) =>
        session.tasks
          .filter((task) => this.taskTouchesParticipant(task, role))
          .flatMap((task) => {
            const workSegment =
              task.phase === ExperimentPhase.PRACTICE
                ? null
                : (this.workSegmentFromSegmentIndex(
                    this.taskFirstSeenSegment(task, role),
                  ) ?? 1);
            const base =
              task.phase === ExperimentPhase.PRACTICE
                ? join(
                    dir,
                    'practice_round',
                    'companies',
                    this.companyDirName(task.company),
                  )
                : join(
                    dir,
                    'formal_segments',
                    `segment_${workSegment}`,
                    'companies',
                    this.companyDirName(task.company),
                  );
            return [
              'company_metadata.json',
              'answer_content.json',
              'ai_chat.jsonl',
              'snapshots.jsonl',
            ]
              .map((filename) => join(base, filename))
              .filter((filePath) => !existsSync(filePath))
              .map((filePath) => `${participant.id}:${filePath}`);
          }),
    );
    const attachmentIssues = this.findAttachmentExportIssues(
      outputDir,
      sessions,
    );
    const sideRowsWithBadCorrectness = answeredSideRows.filter(
      (row) => row.isCorrect === null,
    );
    const negativeReactionRows = allSideRows.filter(
      (row) => row.reactionTimeMs !== null && row.reactionTimeMs < 0,
    );
    const mainAiWithoutAttribution = mainAiUserMessages.filter(
      (message) =>
        message.segmentIndex === null ||
        message.segmentIndex === undefined ||
        !message.taskAssignmentId ||
        !message.companyId,
    );
    const sideAiWithoutPlan = sideAiUserMessages.filter(
      (message) => !message.sideTaskPlanId,
    );
    const participantsWithoutLogin = participantRecords.filter(
      ({ session, participant }) =>
        !session.experimentEvents.some(
          (event) =>
            event.participantId === participant.id &&
            event.eventType === 'participant_login',
        ),
    );

    const rows: SelfCheckRow[] = [
      this.selfCheckRow(
        'session metadata / randomization',
        'Session, RandomizationAudit',
        'export generation',
        'sessions/*/session_metadata.json, randomization.json',
        sessions.every(
          (session) =>
            existsSync(
              join(
                outputDir,
                'sessions',
                session.code,
                'session_metadata.json',
              ),
            ) &&
            existsSync(
              join(outputDir, 'sessions', session.code, 'randomization.json'),
            ),
        ),
        `${sessions.length} sessions checked`,
      ),
      this.selfCheckRow(
        'participant tree and core files',
        'Participant, Pairing, QuestionnaireResponse',
        'export generation',
        'sessions/*/participants/*',
        missingParticipantFiles.length === 0,
        missingParticipantFiles.length
          ? `missing ${missingParticipantFiles.length} participant files`
          : `${participantRecords.length} participant folders checked`,
      ),
      this.selfCheckRow(
        'company metadata / answers / snapshots / main AI files',
        'TaskAssignment, Company, TaskSnapshot, AiMessageLog',
        'task save, segment freeze, AI request, export generation',
        'practice_round/companies/*, formal_segments/*/companies/*',
        companyFileIssues.length === 0,
        companyFileIssues.length
          ? `missing ${companyFileIssues.length} company files`
          : 'company files exist for touched tasks',
      ),
      this.selfCheckRow(
        'image attachments',
        'AiMessageLog.attachments, storage/attachments',
        'AI image upload / export generation',
        'participants/*/attachments/images + ai_chat.jsonl',
        attachmentIssues.length === 0,
        attachmentIssues.length
          ? `attachment issues: ${attachmentIssues.slice(0, 3).join('; ')}`
          : 'attachment JSON paths resolve inside participant attachments folder',
      ),
      this.selfCheckRow(
        'side task correctness',
        'SideTaskPlan, SideTaskItem.goldAnswer, SideTaskExposureLog',
        'side task answer / export generation',
        'side_tasks/side_responses.jsonl, variables.json',
        sideRowsWithBadCorrectness.length === 0,
        sideRowsWithBadCorrectness.length
          ? `${sideRowsWithBadCorrectness.length} answered rows cannot map selected answer to gold answer`
          : `${answeredSideRows.length} answered side rows checked`,
      ),
      this.selfCheckRow(
        'side task reaction time',
        'SideTaskExposureLog',
        'side task opened / answered',
        'side_tasks/side_responses.jsonl',
        negativeReactionRows.length === 0,
        negativeReactionRows.length
          ? `${negativeReactionRows.length} rows have negative reactionTimeMs`
          : 'reactionTimeMs is null or non-negative',
      ),
      this.selfCheckRow(
        'main AI task attribution',
        'AiMessageLog',
        'main AI request',
        'companies/*/ai_chat.jsonl',
        mainAiWithoutAttribution.length === 0,
        mainAiWithoutAttribution.length
          ? `${mainAiWithoutAttribution.length} main AI user messages have incomplete company/task/segment attribution`
          : mainAiUserMessages.length
            ? 'main AI user messages include companyId, taskAssignmentId, and segmentIndex'
            : 'no main AI requests in export scope',
        mainAiWithoutAttribution.length ? '有风险' : undefined,
      ),
      this.selfCheckRow(
        'side AI task attribution',
        'AiMessageLog',
        'side AI request',
        'side_tasks/side_ai_chat.jsonl',
        sideAiUserMessages.every(
          (message) => message.phase !== null && message.segmentIndex !== null,
        ),
        sideAiWithoutPlan.length
          ? `${sideAiWithoutPlan.length} side AI user messages have no sideTaskPlanId`
          : 'side AI messages include phase, segmentIndex, and selected sideTaskPlanId when available',
        sideAiWithoutPlan.length ? '有风险' : undefined,
      ),
      this.selfCheckRow(
        'login / ready events',
        'ExperimentEvent',
        'auth login / ready click',
        'participant_metadata.json, events/events.jsonl',
        participantsWithoutLogin.length === 0,
        participantsWithoutLogin.length
          ? `${participantsWithoutLogin.length} participants have no participant_login event; old sessions may fall back to Participant.createdAt`
          : 'participant_login events exist for exported participants',
        participantsWithoutLogin.length ? '有风险' : undefined,
      ),
      this.selfCheckRow(
        'variables.json summaries',
        'export post-processing',
        'export generation',
        'participants/*/variables.json',
        participantRecords.every(({ dir }) =>
          existsSync(join(dir, 'variables.json')),
        ),
        'core treatment, mainline, AI, side-task, and questionnaire summaries are present',
      ),
      this.selfCheckRow(
        'timestamp variables',
        'ExperimentEvent, AiMessageLog, SideTaskExposureLog, SessionSegmentState, TaskAssignment',
        'timestamp events, AI request, side task exposure, export generation',
        'participants/*/timestamps.json, variables.json.timing',
        participantRecords.every(({ dir }) =>
          existsSync(join(dir, 'timestamps.json')),
        ),
        'participant-level timestamp timelines and derived timing summaries are present',
      ),
      {
        variable: 'paper scoring / gold facts / complex attention variables',
        source: 'future scoring and behavior modules',
        trigger: 'post-experiment analysis',
        exportLocation: 'not in phase-one export tree',
        status: '后续模块',
        notes: 'kept out of the first recording layer by design',
      },
      {
        variable: 'AI adoption rate',
        source: 'AI logs + final text + future coding/similarity logic',
        trigger: 'post-processing',
        exportLocation: 'derived from ai_chat.jsonl and answer_content.json',
        status: '可后处理',
        notes:
          'raw logs and final drafts are saved; direct adoption score is not stored',
      },
    ];

    const header =
      '| 文档变量 / 记录项 | 保存来源表或文件 | 写入触发点 | 导出位置 | 状态 | 备注与风险 |';
    const sep = '|---|---|---|---|---|---|';
    const body = rows
      .map(
        (row) =>
          `| ${row.variable} | ${row.source} | ${row.trigger} | ${row.exportLocation} | ${row.status} | ${row.notes} |`,
      )
      .join('\n');
    await this.storage.writeJson(
      join(outputDir, 'variable_implementation_summary.json'),
      {
        checkedAt: new Date().toISOString(),
        rawSaved: rows
          .filter((row) => row.status === '已通过')
          .map((row) => row.variable),
        risks: rows
          .filter((row) => row.status === '有风险')
          .map((row) => ({ variable: row.variable, notes: row.notes })),
        missingSource: rows
          .filter((row) => row.status === '缺失')
          .map((row) => ({ variable: row.variable, notes: row.notes })),
        postProcessable: rows
          .filter((row) => row.status === '可后处理')
          .map((row) => row.variable),
        outOfPhaseOne: rows
          .filter((row) => row.status === '后续模块')
          .map((row) => row.variable),
      },
    );
    await this.storage.writeJsonl(
      join(outputDir, 'variable_implementation_checklist.jsonl'),
      rows,
    );
    await this.storage.writeJson(
      join(outputDir, 'variable_implementation_checklist_meta.json'),
      {
        markdownFilename: 'variable_implementation_checklist.md',
        mode: 'dynamic_export_self_check',
      },
    );
    const fs = await import('fs/promises');
    await fs.writeFile(
      join(outputDir, 'variable_implementation_checklist.md'),
      `${header}\n${sep}\n${body}\n`,
      'utf8',
    );
  }

  private selfCheckRow(
    variable: string,
    source: string,
    trigger: string,
    exportLocation: string,
    passed: boolean,
    notes: string,
    overrideStatus?: SelfCheckRow['status'],
  ): SelfCheckRow {
    return {
      variable,
      source,
      trigger,
      exportLocation,
      status: overrideStatus ?? (passed ? '已通过' : '缺失'),
      notes,
    };
  }

  private findAttachmentExportIssues(
    outputDir: string,
    sessions: SessionExportRecord[],
  ) {
    const issues: string[] = [];
    for (const session of sessions) {
      for (const participant of this.getParticipants(session)) {
        const participantDir = join(
          outputDir,
          'sessions',
          session.code,
          'participants',
          participant.id,
        );
        const rows = session.aiMessages.filter(
          (message) => message.participantId === participant.id,
        );
        for (const row of rows) {
          const attachments = Array.isArray(row.attachments)
            ? row.attachments
            : [];
          for (const attachment of attachments) {
            if (!attachment || typeof attachment !== 'object') continue;
            const relativePath = this.exportAttachmentRelativePath(
              attachment as Record<string, unknown>,
            );
            if (!relativePath.startsWith('attachments/')) {
              issues.push(
                `${participant.id}:${relativePath}:not participant-relative`,
              );
              continue;
            }
            if (!existsSync(join(participantDir, relativePath))) {
              issues.push(`${participant.id}:${relativePath}:missing file`);
            }
          }
        }
      }
    }
    return issues;
  }

  private parseScope(value: Prisma.JsonValue): ExportScope {
    const raw = this.parseObject(value);
    const sessionCodes = Array.isArray(raw.sessionCodes)
      ? raw.sessionCodes.map((item) => String(item)).filter(Boolean)
      : [];
    return {
      sessionCodes,
      includeIncompleteSessions: raw.includeIncompleteSessions !== false,
    };
  }

  private getParticipants(
    session: SessionExportRecord,
  ): ParticipantExportRecord[] {
    const pairing = session.pairings[0];
    return [pairing?.participantA, pairing?.participantB].filter(
      Boolean,
    ) as ParticipantExportRecord[];
  }

  private resolveParticipantRole(
    session: SessionExportRecord,
    participantId: string,
  ): ParticipantRole | null {
    const pairing = session.pairings[0];
    if (pairing?.participantAId === participantId) return ParticipantRole.A;
    if (pairing?.participantBId === participantId) return ParticipantRole.B;
    return null;
  }

  private displayRole(role: ParticipantRole | null) {
    if (role === ParticipantRole.A) return '尽调员';
    if (role === ParticipantRole.B) return '投资经理';
    return null;
  }

  private companyCode(company: { roundLabel: string; id: string }) {
    return company.roundLabel || company.id;
  }

  private companyDirName(company: { roundLabel: string; id: string }) {
    const code = this.companyCode(company);
    const raw = code === company.id ? code : `${code}__${company.id}`;
    return raw.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
  }

  private parseObject(value: unknown): Record<string, any> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : {};
  }

  private snapshotValue(session: SessionExportRecord, key: string) {
    return (
      this.parseObject(session.experimentSnapshot)[key] ??
      this.parseObject(session.randomizationAudit?.experimentRandomization)[
        key
      ] ??
      null
    );
  }

  private instructionPlan(session: SessionExportRecord) {
    return this.snapshotValue(session, 'instructionPlan') as Record<
      string,
      any
    > | null;
  }

  private instructionForSegment(
    session: SessionExportRecord,
    workSegment: number,
  ) {
    const plan = this.instructionPlan(session);
    if (!plan) return null;
    const key = String(workSegment);
    const instructionType =
      this.parseObject(plan.instructionTypes)[key] ?? null;
    const instructionTextId =
      this.parseObject(plan.instructionTextIds)[key] ?? null;
    const instructionFamily =
      this.parseObject(plan.instructionFamilies)[key] ?? null;
    return {
      instructionType,
      instructionTextId,
      instructionFamily,
      instructionVersion: plan.version ?? null,
      durationSeconds: plan.durationSeconds ?? null,
      orderType: plan.orderType ?? null,
      orderValue: plan.orderValue ?? null,
    };
  }

  private buildInstructionVariables(
    session: SessionExportRecord,
    participantId: string,
  ) {
    const completedRows = session.progresses.filter(
      (row) =>
        row.participantId === participantId &&
        row.stage === 'pre_segment_instruction_completed',
    );
    const openedRows = session.progresses.filter(
      (row) =>
        row.participantId === participantId &&
        row.stage === 'pre_segment_instruction_opened',
    );
    const bySegment = [1, 2, 3].map((workSegment) => {
      const completed = completedRows.find(
        (row) => this.progressWorkSegment(row.payload) === workSegment,
      );
      const opened = openedRows.find(
        (row) => this.progressWorkSegment(row.payload) === workSegment,
      );
      const completedPayload = this.parseObject(completed?.payload);
      const openedPayload = this.parseObject(opened?.payload);
      const plan = this.instructionForSegment(session, workSegment);
      return {
        workSegment,
        instructionType:
          completedPayload.instructionType ??
          openedPayload.instructionType ??
          plan?.instructionType ??
          null,
        instructionTextId:
          completedPayload.instructionTextId ??
          openedPayload.instructionTextId ??
          plan?.instructionTextId ??
          null,
        instructionFamily:
          completedPayload.instructionFamily ??
          openedPayload.instructionFamily ??
          plan?.instructionFamily ??
          null,
        openedAt: openedPayload.pageOpenTime ?? null,
        completedAt: completedPayload.continueClickTime ?? null,
        viewDurationSeconds: completedPayload.viewDurationSeconds ?? null,
        completed: Boolean(completed),
      };
    });
    const durations = bySegment
      .map((item) =>
        typeof item.viewDurationSeconds === 'number'
          ? item.viewDurationSeconds
          : null,
      )
      .filter((value): value is number => value !== null);
    return {
      plan: this.instructionPlan(session),
      completedCount: bySegment.filter((item) => item.completed).length,
      totalViewDurationSeconds: durations.reduce(
        (sum, value) => sum + value,
        0,
      ),
      bySegment,
    };
  }

  private progressWorkSegment(payload: unknown) {
    const data = this.parseObject(payload);
    const value = Number(data.workSegment);
    return Number.isFinite(value) ? value : null;
  }

  private segmentAiLevel(session: SessionExportRecord, workSegment: number) {
    const states = this.snapshotValue(session, 'segmentAiStates');
    if (states && typeof states === 'object')
      return states[String(workSegment)] ?? states[workSegment];
    return null;
  }

  private themeForSegment(session: SessionExportRecord, workSegment: number) {
    if (!session.sideTaskConfig) return null;
    if (workSegment === 1) return session.sideTaskConfig.segment1Theme;
    if (workSegment === 2) return session.sideTaskConfig.segment2Theme;
    return session.sideTaskConfig.segment3Theme;
  }

  private touchedCompanyIds(
    session: SessionExportRecord,
    role: ParticipantRole | null,
    segmentIndex: number,
  ) {
    return session.tasks
      .filter((task) => this.taskTouchesParticipant(task, role))
      .filter(
        (task) =>
          this.taskFirstSeenSegment(task, role) === segmentIndex ||
          task.snapshots.some(
            (snapshot) => snapshot.segmentIndex === segmentIndex,
          ),
      )
      .map((task) => task.companyId);
  }

  private taskTouchesParticipant(
    task: SessionExportRecord['tasks'][number],
    role: ParticipantRole | null,
  ) {
    if (role === ParticipantRole.A)
      return Boolean(
        task.aStartedAt ||
        task.aDraft ||
        task.phase === ExperimentPhase.PRACTICE,
      );
    if (role === ParticipantRole.B)
      return Boolean(
        task.bSequenceIndex !== null ||
        task.bDraft ||
        task.bCompletedAt ||
        task.phase === ExperimentPhase.PRACTICE,
      );
    return false;
  }

  private taskFirstSeenSegment(
    task: SessionExportRecord['tasks'][number],
    role: ParticipantRole | null,
  ) {
    if (task.phase === ExperimentPhase.PRACTICE) return 0;
    if (role === ParticipantRole.B && task.bSequenceIndex !== null) {
      const assignment = this.bAssignedAtFromTask(task);
      if (assignment) return this.segmentIndexFromTime(assignment, task);
    }
    return task.aStartedAt
      ? this.segmentIndexFromTime(task.aStartedAt, task)
      : 1;
  }

  private segmentIndexFromTime(
    _time: Date,
    task: SessionExportRecord['tasks'][number],
  ) {
    const snapshotSegment = task.snapshots.find(
      (snapshot) => snapshot.segmentIndex,
    )?.segmentIndex;
    return snapshotSegment ?? 1;
  }

  private bAssignedAtFromTask(task: SessionExportRecord['tasks'][number]) {
    return task.bPreAAiLevel ? task.aStartedAt : task.aSubmittedAt;
  }

  private bAssignmentPath(session: SessionExportRecord, taskId: string) {
    const detail = this.bAssignmentDetail(session, taskId) as Record<
      string,
      unknown
    > | null;
    return detail?.assignmentPath ?? detail?.method ?? null;
  }

  private bAssignmentDetail(session: SessionExportRecord, taskId: string) {
    const log = Array.isArray(session.randomizationAudit?.bAssignmentLog)
      ? session.randomizationAudit?.bAssignmentLog
      : [];
    return (
      log.find(
        (item: any) =>
          item?.taskAssignmentId === taskId ||
          item?.chosenTaskAssignmentId === taskId,
      ) ?? null
    );
  }

  private bAssignedAt(session: SessionExportRecord, taskId: string) {
    const detail = this.bAssignmentDetail(session, taskId) as Record<
      string,
      unknown
    > | null;
    return detail?.assignedAt ?? null;
  }

  private bAssignedAtDate(session: SessionExportRecord, taskId: string) {
    const assignedAt = this.bAssignedAt(session, taskId);
    if (typeof assignedAt !== 'string') return null;
    const parsed = new Date(assignedAt);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private visibleMaterials(
    materials: ReturnType<typeof normalizeMaterials>,
    role: ParticipantRole | null,
  ) {
    return materials.filter((item) => {
      const scope = this.materialScope(item);
      if (scope === 'research') return false;
      if (scope === 'shared') return true;
      if (scope === 'diligence') return role === ParticipantRole.A;
      if (scope === 'manager') return role === ParticipantRole.B;
      return true;
    });
  }

  private materialScope(item: ReturnType<typeof normalizeMaterials>[number]) {
    const metadata = item.metadata ?? {};
    if (metadata.audience === 'research') return 'research';
    if (metadata.participantRole === 'A') return 'diligence';
    if (metadata.participantRole === 'B') return 'manager';
    if (metadata.participantRole === 'shared') return 'shared';
    return 'shared';
  }

  private materialVersion(materials: ReturnType<typeof normalizeMaterials>) {
    return (
      materials.map((item) => item.metadata?.version).filter(Boolean)[0] ?? 'v1'
    );
  }

  private payloadValue(
    value: Prisma.JsonValue | null | undefined,
    key: string,
  ) {
    const object = this.parseObject(value);
    return object[key] ?? null;
  }

  private payloadString(
    value: Prisma.JsonValue | null | undefined,
    key: string,
  ) {
    const raw = this.payloadValue(value, key);
    return typeof raw === 'string' ? raw : null;
  }

  private sideTaskGoldAnswerText(
    plan: SessionExportRecord['sideTaskPlans'][number],
  ) {
    if (plan.item.goldAnswer === 'A') return plan.item.optionA;
    if (plan.item.goldAnswer === 'B') return plan.item.optionB;
    return plan.item.goldAnswer ?? null;
  }

  private sideTaskOptionKey(
    plan: SessionExportRecord['sideTaskPlans'][number],
    selectedAnswer: unknown,
  ) {
    if (selectedAnswer === plan.item.optionA) return 'A';
    if (selectedAnswer === plan.item.optionB) return 'B';
    return selectedAnswer === 'A' || selectedAnswer === 'B'
      ? selectedAnswer
      : null;
  }

  private sideTaskOpenedForAnswer(
    logs: Array<{ eventType: string; eventAt: Date }>,
    answeredAt: Date | null,
  ) {
    const openedLogs = logs.filter(
      (log) => log.eventType === 'side_task_opened',
    );
    if (!answeredAt) return openedLogs[0] ?? null;
    return openedLogs.filter((log) => log.eventAt <= answeredAt).at(-1) ?? null;
  }

  private normalizeExportAttachments(value: Prisma.JsonValue | null) {
    if (!Array.isArray(value)) return value;
    return value.map((item) => {
      if (!item || typeof item !== 'object') return item;
      const attachment = item as Record<string, unknown>;
      const { absolutePath: _absolutePath, ...rest } = attachment;
      return {
        ...rest,
        relativePath: this.exportAttachmentRelativePath(attachment),
      };
    });
  }

  private exportAttachmentRelativePath(attachment: Record<string, unknown>) {
    const original = String(attachment.relativePath ?? '').replace(/\\/g, '/');
    const marker = '/attachments/';
    const markerIndex = original.indexOf(marker);
    if (markerIndex >= 0) return original.slice(markerIndex + 1);
    if (original.startsWith('attachments/')) return original;
    const imageRef = String(attachment.imageRef ?? '').trim();
    if (imageRef) {
      const mimeType = String(attachment.mimeType ?? '');
      const ext =
        mimeType === 'image/jpeg'
          ? 'jpg'
          : mimeType === 'image/webp'
            ? 'webp'
            : mimeType === 'image/gif'
              ? 'gif'
              : 'png';
      return `attachments/images/${imageRef}.${ext}`;
    }
    return original;
  }

  private firstEventTime(
    events: SessionExportRecord['experimentEvents'],
    eventType: string,
  ) {
    return (
      events
        .find((event) => event.eventType === eventType)
        ?.serverTime.toISOString() ?? null
    );
  }

  private overlapMany(
    start: number,
    end: number,
    intervals: Array<{ start: number; end: number }>,
  ) {
    if (end <= start) return 0;
    return this.mergeTimeIntervals(intervals).reduce(
      (sum, interval) =>
        sum +
        Math.max(
          Math.min(end, interval.end) - Math.max(start, interval.start),
          0,
        ),
      0,
    );
  }

  private mergeTimeIntervals(intervals: Array<{ start: number; end: number }>) {
    const sorted = intervals
      .filter(
        (interval) =>
          Number.isFinite(interval.start) &&
          Number.isFinite(interval.end) &&
          interval.end > interval.start,
      )
      .sort((a, b) => a.start - b.start);
    const merged: Array<{ start: number; end: number }> = [];
    for (const interval of sorted) {
      const current = merged[merged.length - 1];
      if (!current || interval.start > current.end) {
        merged.push({ ...interval });
      } else {
        current.end = Math.max(current.end, interval.end);
      }
    }
    return merged;
  }

  private overlapWithinWork(
    start: number,
    end: number,
    workIntervals: Array<{ start: number; end: number }>,
    excludedIntervals: Array<{ start: number; end: number }>,
  ) {
    return workIntervals.reduce((sum, work) => {
      const overlapStart = Math.max(start, work.start);
      const overlapEnd = Math.min(end, work.end);
      return (
        sum + this.overlapMany(overlapStart, overlapEnd, excludedIntervals)
      );
    }, 0);
  }

  private buildIntegrityExclusions(
    session: SessionExportRecord,
    participantId: string,
    cutoff: number,
  ) {
    const state =
      session.integrityStates.find(
        (item) => item.participantId === participantId,
      ) ?? null;
    const toInterval = (interval: {
      startedAt: Date;
      endedAt: Date | null;
    }) => ({
      start: interval.startedAt.getTime(),
      end: interval.endedAt?.getTime() ?? cutoff,
    });
    const invalidInactivity = this.mergeTimeIntervals(
      (state?.intervals ?? [])
        .filter((interval) => interval.intervalType === 'INACTIVITY')
        .map(toInterval),
    );
    const offscreenViolation = this.mergeTimeIntervals(
      (state?.intervals ?? [])
        .filter(
          (interval) =>
            interval.intervalType === 'OFFSCREEN' && interval.isViolation,
        )
        .map(toInterval),
    );
    const disconnect = this.mergeTimeIntervals(
      (state?.intervals ?? [])
        .filter((interval) => interval.intervalType === 'DISCONNECT')
        .map(toInterval),
    );
    const postDropout =
      state?.hasFormalDropout && state.formalDropoutAt
        ? this.mergeTimeIntervals([
            { start: state.formalDropoutAt.getTime(), end: cutoff },
          ])
        : [];
    const invalidBehavior = this.mergeTimeIntervals([
      ...invalidInactivity,
      ...offscreenViolation,
    ]);
    const total = this.mergeTimeIntervals([
      ...invalidBehavior,
      ...disconnect,
      ...postDropout,
    ]);
    return {
      invalidInactivity,
      offscreenViolation,
      invalidBehavior,
      disconnect,
      postDropout,
      total,
    };
  }

  private findIntervalForTime<T extends { start: number; end: number }>(
    intervals: T[],
    time: number,
  ) {
    return (
      intervals.find(
        (interval) => time >= interval.start && time <= interval.end,
      ) ?? null
    );
  }

  private timeWithin(time: number, start: number, end: number) {
    return time >= start && time <= end;
  }

  private roundRatio(value: number) {
    return Math.round(value * 10000) / 10000;
  }

  private meanNumber(values: number[]) {
    return values.length
      ? Math.round(
          values.reduce((sum, value) => sum + value, 0) / values.length,
        )
      : null;
  }

  private medianNumber(values: number[]) {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const middle = Math.floor(sorted.length / 2);
    return sorted.length % 2
      ? sorted[middle]
      : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
  }

  private buildTimestamps(
    session: SessionExportRecord,
    participant: ParticipantExportRecord,
    role: ParticipantRole | null,
  ) {
    const participantId = participant.id;
    const exportCutoff = Date.now();
    const events = session.experimentEvents
      .filter((event) => event.participantId === participantId)
      .sort((a, b) => a.serverTime.getTime() - b.serverTime.getTime());
    const rawFormalWorkSegments = [1, 3, 5].map((segmentIndex) => {
      const state = session.segmentStates.find(
        (item) =>
          item.phase === ExperimentPhase.FORMAL &&
          item.segmentIndex === segmentIndex,
      );
      const startedAt = state?.startedAt ?? null;
      const endedAt = state?.completedAt ?? state?.endsAt ?? null;
      return {
        workSegment: this.workSegmentFromSegmentIndex(segmentIndex),
        segmentIndex,
        startedAt: startedAt?.toISOString() ?? null,
        endedAt: endedAt?.toISOString() ?? null,
        durationMs:
          startedAt && endedAt
            ? Math.max(endedAt.getTime() - startedAt.getTime(), 0)
            : null,
      };
    });
    const workIntervals = rawFormalWorkSegments
      .filter((segment) => segment.startedAt && segment.endedAt)
      .map((segment) => ({
        start: new Date(segment.startedAt!).getTime(),
        end: new Date(segment.endedAt!).getTime(),
        segmentIndex: segment.segmentIndex,
        workSegment: segment.workSegment,
      }));
    const exclusions = this.buildIntegrityExclusions(
      session,
      participantId,
      exportCutoff,
    );
    const excludedForWork = (
      excludedIntervals: Array<{ start: number; end: number }>,
    ) =>
      workIntervals.reduce(
        (sum, interval) =>
          sum +
          this.overlapMany(interval.start, interval.end, excludedIntervals),
        0,
      );
    const formalWorkSegments = rawFormalWorkSegments.map((segment) => {
      if (
        !segment.startedAt ||
        !segment.endedAt ||
        segment.durationMs === null
      ) {
        return {
          ...segment,
          invalidInactivityExcludedMs: null,
          offscreenViolationExcludedMs: null,
          invalidBehaviorExcludedMs: null,
          disconnectExcludedMs: null,
          postDropoutExcludedMs: null,
          totalExcludedMs: null,
          validDurationMs: null,
        };
      }
      const start = new Date(segment.startedAt).getTime();
      const end = new Date(segment.endedAt).getTime();
      const invalidInactivityExcludedMs = this.overlapMany(
        start,
        end,
        exclusions.invalidInactivity,
      );
      const offscreenViolationExcludedMs = this.overlapMany(
        start,
        end,
        exclusions.offscreenViolation,
      );
      const invalidBehaviorExcludedMs = this.overlapMany(
        start,
        end,
        exclusions.invalidBehavior,
      );
      const disconnectExcludedMs = this.overlapMany(
        start,
        end,
        exclusions.disconnect,
      );
      const postDropoutExcludedMs = this.overlapMany(
        start,
        end,
        exclusions.postDropout,
      );
      const totalExcludedMs = this.overlapMany(start, end, exclusions.total);
      return {
        ...segment,
        invalidInactivityExcludedMs,
        offscreenViolationExcludedMs,
        invalidBehaviorExcludedMs,
        disconnectExcludedMs,
        postDropoutExcludedMs,
        totalExcludedMs,
        validDurationMs: Math.max(segment.durationMs - totalExcludedMs, 0),
      };
    });
    const eligibleWorkMs = workIntervals.reduce(
      (sum, interval) => sum + Math.max(interval.end - interval.start, 0),
      0,
    );
    const sideEvents = events.filter(
      (event) =>
        event.eventType === 'side_area_entered' ||
        event.eventType === 'main_area_returned',
    );
    const sideSwitches: Array<Record<string, unknown>> = [];
    const qualityFlags = new Set<string>();
    const mainlineActivities = events
      .filter(
        (event) =>
          event.eventType === 'mainline_activity' ||
          event.eventType === 'main_context_activity',
      )
      .map((event) => ({
        eventId: event.id,
        at: event.serverTime.toISOString(),
        companyId: event.companyId,
        taskAssignmentId: event.taskAssignmentId,
        workSegment: this.workSegmentFromSegmentIndex(event.segmentIndex),
        segmentIndex: event.segmentIndex,
        activityKind:
          this.payloadString(event.payload, 'activityKind') ?? 'unknown',
        anchorType: this.payloadString(event.payload, 'anchorType'),
        anchorEventId: this.payloadString(event.payload, 'anchorEventId'),
      }));

    for (const event of sideEvents) {
      if (event.eventType !== 'side_area_entered') continue;
      const returned = sideEvents.find(
        (candidate) =>
          candidate.eventType === 'main_area_returned' &&
          candidate.serverTime > event.serverTime &&
          (!event.taskAssignmentId ||
            candidate.taskAssignmentId === event.taskAssignmentId),
      );
      if (!returned) qualityFlags.add('unclosed_side_interval');
      const segmentInterval = this.findIntervalForTime(
        workIntervals,
        event.serverTime.getTime(),
      );
      const endTime =
        returned?.serverTime.getTime() ??
        segmentInterval?.end ??
        event.serverTime.getTime();
      const durationMs = this.overlapMany(
        event.serverTime.getTime(),
        endTime,
        workIntervals,
      );
      const invalidBehaviorExcludedMs = this.overlapWithinWork(
        event.serverTime.getTime(),
        endTime,
        workIntervals,
        exclusions.invalidBehavior,
      );
      const disconnectExcludedMs = this.overlapWithinWork(
        event.serverTime.getTime(),
        endTime,
        workIntervals,
        exclusions.disconnect,
      );
      const postDropoutExcludedMs = this.overlapWithinWork(
        event.serverTime.getTime(),
        endTime,
        workIntervals,
        exclusions.postDropout,
      );
      const totalExcludedMs = this.overlapWithinWork(
        event.serverTime.getTime(),
        endTime,
        workIntervals,
        exclusions.total,
      );
      const restartActivity = returned
        ? (mainlineActivities.find(
            (activity) =>
              activity.anchorType === 'side_return' &&
              (!activity.anchorEventId ||
                activity.anchorEventId === returned.id) &&
              new Date(activity.at).getTime() >= returned.serverTime.getTime(),
          ) ??
          mainlineActivities.find(
            (activity) =>
              new Date(activity.at).getTime() >= returned.serverTime.getTime(),
          ))
        : null;
      sideSwitches.push({
        switchId: event.id,
        companyId: event.companyId,
        taskAssignmentId: event.taskAssignmentId,
        sideTaskPlanId: event.sideTaskPlanId,
        workSegment: this.workSegmentFromSegmentIndex(event.segmentIndex),
        segmentIndex: event.segmentIndex,
        enteredAt: event.serverTime.toISOString(),
        returnedAt: returned?.serverTime.toISOString() ?? null,
        durationMs,
        invalidBehaviorExcludedMs,
        disconnectExcludedMs,
        postDropoutExcludedMs,
        totalExcludedMs,
        validDurationMs: Math.max(durationMs - totalExcludedMs, 0),
        closedBy: returned
          ? (this.payloadString(returned.payload, 'source') ?? 'return_event')
          : 'segment_or_export_cutoff',
        restart:
          restartActivity && returned
            ? {
                firstMainActivityAt: restartActivity.at,
                activityKind: restartActivity.activityKind,
                delayMs: Math.max(
                  new Date(restartActivity.at).getTime() -
                    returned.serverTime.getTime(),
                  0,
                ),
              }
            : null,
      });
      if (returned && !restartActivity)
        qualityFlags.add('main_activity_missing_after_side_return');
    }

    const totalSideTimeMs = sideSwitches.reduce(
      (sum, item) => sum + Number(item.durationMs ?? 0),
      0,
    );
    const totalMainTimeMs = Math.max(eligibleWorkMs - totalSideTimeMs, 0);
    const invalidInactivityExcludedMs = excludedForWork(
      exclusions.invalidInactivity,
    );
    const offscreenViolationExcludedMs = excludedForWork(
      exclusions.offscreenViolation,
    );
    const invalidBehaviorExcludedMs = excludedForWork(
      exclusions.invalidBehavior,
    );
    const disconnectExcludedMs = excludedForWork(exclusions.disconnect);
    const postDropoutExcludedMs = excludedForWork(exclusions.postDropout);
    const totalExcludedMs = excludedForWork(exclusions.total);
    const validEligibleWorkMs = Math.max(eligibleWorkMs - totalExcludedMs, 0);
    const validSideTimeMs = sideSwitches.reduce(
      (sum, item) => sum + Number(item.validDurationMs ?? 0),
      0,
    );
    const validMainTimeMs = Math.max(validEligibleWorkMs - validSideTimeMs, 0);
    const aiWaitWindows = this.buildAiWaitWindows(
      session,
      participantId,
      events,
      mainlineActivities,
      workIntervals,
      qualityFlags,
    );
    const restartDelays = sideSwitches
      .map((item) => (item.restart as { delayMs?: number } | null)?.delayMs)
      .filter((value): value is number => typeof value === 'number');
    const aiReturnDelays = aiWaitWindows
      .map((item) => item.returnDelayAfterAIResponseMs)
      .filter((value): value is number => typeof value === 'number');
    const companyTimelines = session.tasks
      .filter((task) => this.taskTouchesParticipant(task, role))
      .map((task) => {
        const bAssignedAt =
          this.bAssignedAtDate(session, task.id) ??
          this.bAssignedAtFromTask(task);
        const enteredAt =
          role === ParticipantRole.A ? task.aStartedAt : bAssignedAt;
        const exitedAt =
          role === ParticipantRole.A
            ? (task.aSubmittedAt ?? task.frozenAt)
            : (task.bCompletedAt ?? task.frozenAt);
        const companySideMs =
          enteredAt && exitedAt
            ? sideSwitches
                .filter(
                  (item) =>
                    item.taskAssignmentId === task.id ||
                    item.companyId === task.companyId,
                )
                .reduce((sum, item) => sum + Number(item.durationMs ?? 0), 0)
            : 0;
        const companyValidSideMs =
          enteredAt && exitedAt
            ? sideSwitches
                .filter(
                  (item) =>
                    item.taskAssignmentId === task.id ||
                    item.companyId === task.companyId,
                )
                .reduce(
                  (sum, item) => sum + Number(item.validDurationMs ?? 0),
                  0,
                )
            : 0;
        const companyTotalMs =
          enteredAt && exitedAt
            ? Math.max(exitedAt.getTime() - enteredAt.getTime(), 0)
            : null;
        const companyTotalExcludedMs =
          enteredAt && exitedAt
            ? this.overlapWithinWork(
                enteredAt.getTime(),
                exitedAt.getTime(),
                workIntervals,
                exclusions.total,
              )
            : null;
        const companyValidTotalMs =
          companyTotalMs === null || companyTotalExcludedMs === null
            ? null
            : Math.max(companyTotalMs - companyTotalExcludedMs, 0);
        const boundedCompanyValidSideMs =
          companyValidTotalMs === null
            ? null
            : Math.min(companyValidSideMs, companyValidTotalMs);
        return {
          companyId: task.companyId,
          companyCode: this.companyCode(task.company),
          taskAssignmentId: task.id,
          workSegment: this.workSegmentFromSegmentIndex(
            this.taskFirstSeenSegment(task, role),
          ),
          enteredAt: enteredAt?.toISOString() ?? null,
          exitedAt: exitedAt?.toISOString() ?? null,
          sideMs: companySideMs,
          mainMs:
            companyTotalMs === null
              ? null
              : Math.max(companyTotalMs - companySideMs, 0),
          totalExcludedMs: companyTotalExcludedMs,
          validTotalMs: companyValidTotalMs,
          validSideMs: boundedCompanyValidSideMs,
          validMainMs:
            companyValidTotalMs === null || boundedCompanyValidSideMs === null
              ? null
              : Math.max(companyValidTotalMs - boundedCompanyValidSideMs, 0),
          switchVisitCount: sideSwitches.filter(
            (item) =>
              item.taskAssignmentId === task.id ||
              item.companyId === task.companyId,
          ).length,
          aiWaitCount: aiWaitWindows.filter(
            (item) =>
              item.taskAssignmentId === task.id ||
              item.companyId === task.companyId,
          ).length,
        };
      });

    if (workIntervals.length < 3)
      qualityFlags.add('missing_work_segment_boundary');
    return {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      sessionCode: session.code,
      participantId,
      role,
      displayRole: this.displayRole(role),
      timezone: 'Asia/Shanghai',
      sourceFiles: [
        'events/events.jsonl',
        'side_tasks/side_events.jsonl',
        'formal_segments/*/companies/*/ai_chat.jsonl',
        'formal_segments/*/companies/*/company_metadata.json',
      ],
      formalWorkSegments,
      companyTimelines,
      sideSwitches,
      aiWaitWindows,
      mainlineActivities,
      derived: {
        eligibleWorkMs,
        totalMainTimeMs,
        totalSideTimeMs,
        mainTimeShare: eligibleWorkMs
          ? this.roundRatio(totalMainTimeMs / eligibleWorkMs)
          : null,
        sideTimeShare: eligibleWorkMs
          ? this.roundRatio(totalSideTimeMs / eligibleWorkMs)
          : null,
        invalidInactivityExcludedMs,
        offscreenViolationExcludedMs,
        invalidBehaviorExcludedMs,
        disconnectExcludedMs,
        postDropoutExcludedMs,
        totalExcludedMs,
        validEligibleWorkMs,
        validMainTimeMs,
        validSideTimeMs,
        validMainTimeShare: validEligibleWorkMs
          ? this.roundRatio(validMainTimeMs / validEligibleWorkMs)
          : null,
        validSideTimeShare: validEligibleWorkMs
          ? this.roundRatio(validSideTimeMs / validEligibleWorkMs)
          : null,
        switchCount: sideSwitches.length,
        switchVisitCount: sideSwitches.length,
        switchTransitionCount: sideSwitches.reduce(
          (sum, item) => sum + (item.returnedAt ? 2 : 1),
          0,
        ),
        meanRestartDelayMs: this.meanNumber(restartDelays),
        medianRestartDelayMs: this.medianNumber(restartDelays),
        aiWaitCount: aiWaitWindows.length,
        sideDuringAIWaitCount: aiWaitWindows.filter(
          (item) => item.sideDuringAIWait,
        ).length,
        mainDuringAIWaitCount: aiWaitWindows.filter(
          (item) => item.mainDuringAIWait,
        ).length,
        idleDuringAIWaitCount: aiWaitWindows.filter(
          (item) => item.idleDuringAIWait,
        ).length,
        meanReturnDelayAfterAIResponseMs: this.meanNumber(aiReturnDelays),
        medianReturnDelayAfterAIResponseMs: this.medianNumber(aiReturnDelays),
      },
      qualityFlags: Array.from(qualityFlags).sort(),
    };
  }

  private buildAiWaitWindows(
    session: SessionExportRecord,
    participantId: string,
    events: SessionExportRecord['experimentEvents'],
    mainlineActivities: Array<{
      at: string;
      anchorType: string | null;
      activityKind: string;
      companyId: string | null;
      taskAssignmentId: string | null;
    }>,
    workIntervals: Array<{ start: number; end: number }>,
    qualityFlags: Set<string>,
  ) {
    const aiRows = session.aiMessages.filter(
      (message) => message.participantId === participantId,
    );
    const requestIds = Array.from(
      new Set(aiRows.map((message) => message.requestId)),
    );
    const sideActivities = events.filter(
      (event) =>
        event.eventType === 'side_activity' ||
        event.eventType === 'side_area_entered',
    );
    const mainActivities = events.filter(
      (event) =>
        event.eventType === 'main_context_activity' ||
        event.eventType === 'mainline_activity',
    );
    return requestIds.map((requestId) => {
      const rows = aiRows.filter((message) => message.requestId === requestId);
      const user =
        rows.find((message) => message.messageRole === 'user') ?? rows[0];
      const assistant = rows.find(
        (message) => message.messageRole === 'assistant',
      );
      const startedEvent = events.find(
        (event) =>
          event.eventType === 'ai_wait_started' &&
          this.payloadString(event.payload, 'requestId') === requestId,
      );
      const endedEvent = events.find(
        (event) =>
          event.eventType === 'ai_wait_ended' &&
          this.payloadString(event.payload, 'requestId') === requestId,
      );
      const startedAt = startedEvent?.serverTime ?? user?.createdAt ?? null;
      const endedAt =
        endedEvent?.serverTime ??
        assistant?.completedAt ??
        assistant?.createdAt ??
        null;
      if (!endedAt) qualityFlags.add('missing_ai_wait_end');
      if (startedAt && endedAt && endedAt.getTime() < startedAt.getTime())
        qualityFlags.add('negative_or_zero_interval');
      const startMs = startedAt?.getTime() ?? 0;
      const endMs = endedAt?.getTime() ?? startMs;
      const sideDuringAIWait = sideActivities.some((event) =>
        this.timeWithin(event.serverTime.getTime(), startMs, endMs),
      );
      const mainDuringAIWait = mainActivities.some((event) =>
        this.timeWithin(event.serverTime.getTime(), startMs, endMs),
      );
      const firstMainAfter = endedAt
        ? (mainlineActivities.find(
            (activity) =>
              activity.anchorType === 'ai_response_end' &&
              new Date(activity.at).getTime() >= endedAt.getTime(),
          ) ??
          mainlineActivities.find(
            (activity) => new Date(activity.at).getTime() >= endedAt.getTime(),
          ))
        : null;
      if (endedAt && !firstMainAfter)
        qualityFlags.add('main_activity_missing_after_ai_response');
      return {
        requestId,
        contextType: user?.contextType ?? assistant?.contextType ?? null,
        companyId: user?.companyId ?? assistant?.companyId ?? null,
        taskAssignmentId:
          user?.taskAssignmentId ?? assistant?.taskAssignmentId ?? null,
        sideTaskPlanId:
          user?.sideTaskPlanId ?? assistant?.sideTaskPlanId ?? null,
        workSegment: this.workSegmentFromSegmentIndex(
          user?.segmentIndex ?? assistant?.segmentIndex ?? null,
        ),
        segmentIndex: user?.segmentIndex ?? assistant?.segmentIndex ?? null,
        startedAt: startedAt?.toISOString() ?? null,
        endedAt: endedAt?.toISOString() ?? null,
        durationMs:
          startedAt && endedAt
            ? Math.max(endedAt.getTime() - startedAt.getTime(), 0)
            : null,
        eligibleDurationMs:
          startedAt && endedAt
            ? this.overlapMany(
                startedAt.getTime(),
                endedAt.getTime(),
                workIntervals,
              )
            : null,
        endedBy:
          assistant?.providerStatus ??
          this.payloadString(endedEvent?.payload, 'providerStatus') ??
          null,
        sideDuringAIWait,
        mainDuringAIWait,
        idleDuringAIWait: !sideDuringAIWait && !mainDuringAIWait,
        returnDelayAfterAIResponseMs:
          endedAt && firstMainAfter
            ? Math.max(
                new Date(firstMainAfter.at).getTime() - endedAt.getTime(),
                0,
              )
            : null,
        firstMainActivityAfterResponseAt: firstMainAfter?.at ?? null,
      };
    });
  }

  private buildQualityFlags(
    session: SessionExportRecord,
    participantId: string,
  ) {
    const flags: string[] = [];
    if (session.status !== 'COMPLETED') flags.push('session_not_completed');
    const practice = session.questionnaireAnswers.some(
      (row) =>
        row.participantId === participantId &&
        row.phase === ExperimentPhase.PRACTICE,
    );
    if (!practice) flags.push('missing_practice_quiz');
    const integrity = session.integrityStates.find(
      (state) => state.participantId === participantId,
    );
    if (integrity?.hasInvalidInactivity) flags.push('invalid_inactivity');
    if (integrity?.hasOffscreenViolation) flags.push('offscreen_violation');
    if (integrity?.hasConnectionLoss) flags.push('connection_loss');
    if (integrity?.hasFormalDropout) flags.push('formal_dropout');
    return flags;
  }

  private buildSessionIntegrityFlags(session: SessionExportRecord) {
    const states = session.integrityStates;
    const invalid = states.some((state) => state.hasInvalidInactivity);
    const offscreen = states.some((state) => state.hasOffscreenViolation);
    const connectionLoss = states.some((state) => state.hasConnectionLoss);
    const dropout = states.some((state) => state.hasFormalDropout);
    return {
      hasAnyParticipantInvalidInactivity: invalid,
      hasAnyParticipantOffscreenViolation: offscreen,
      hasAnyParticipantConnectionLoss: connectionLoss,
      hasAnyParticipantFormalDropout: dropout,
      sessionDataUsable: !(invalid || offscreen || dropout),
    };
  }

  private buildOnlineIntegrity(
    session: SessionExportRecord,
    participantId: string,
  ) {
    const state =
      session.integrityStates.find(
        (item) => item.participantId === participantId,
      ) ?? null;
    const snapshot = this.parseObject(session.experimentSnapshot);
    const events = session.experimentEvents.filter(
      (event) =>
        event.participantId === participantId &&
        (event.eventType.startsWith('idle_prompt_') ||
          event.eventType.startsWith('clipboard_') ||
          event.eventType.includes('dropout') ||
          event.eventType === 'integrity_commitment_completed'),
    );
    return {
      schemaVersion: 1,
      participantId,
      sessionCode: session.code,
      configSnapshot: this.parseObject(snapshot.onlineIntegrity),
      qualitySummary: state
        ? {
            currentState: state.currentState,
            lastHeartbeatAt: state.lastHeartbeatAt?.toISOString() ?? null,
            lastValidActivityAt:
              state.lastValidActivityAt?.toISOString() ?? null,
            hasInvalidInactivity: state.hasInvalidInactivity,
            hasOffscreenViolation: state.hasOffscreenViolation,
            hasConnectionLoss: state.hasConnectionLoss,
            hasFormalDropout: state.hasFormalDropout,
            inactivityIntervalCount: state.inactivityIntervalCount,
            offscreenIntervalCount: state.offscreenIntervalCount,
            offscreenViolationCount: state.offscreenViolationCount,
            disconnectIntervalCount: state.disconnectIntervalCount,
            inactivityTotalMs: state.inactivityTotalMs,
            offscreenTotalMs: state.offscreenTotalMs,
            disconnectTotalMs: state.disconnectTotalMs,
            formalDropoutAt: state.formalDropoutAt?.toISOString() ?? null,
            formalDropoutReason: state.formalDropoutReason,
            integrityCommitmentAt:
              state.integrityCommitmentAt?.toISOString() ?? null,
            comprehensionPassedAt:
              state.comprehensionPassedAt?.toISOString() ?? null,
            comprehensionAnswers: state.comprehensionAnswers,
            finalSelfReport: state.finalSelfReport,
          }
        : null,
      intervals: (state?.intervals ?? []).map((interval) => ({
        intervalId: interval.id,
        intervalType: interval.intervalType,
        role: interval.role,
        segmentIndex: interval.segmentIndex,
        taskAssignmentId: interval.taskAssignmentId,
        companyId: interval.companyId,
        startedAt: interval.startedAt.toISOString(),
        endedAt: interval.endedAt?.toISOString() ?? null,
        durationMs: interval.durationMs,
        isViolation: interval.isViolation,
        idleCountdownStartedAt:
          interval.idleCountdownStartedAt?.toISOString() ?? null,
        promptShownAt: interval.promptShownAt?.toISOString() ?? null,
        confirmationDeadlineAt:
          interval.confirmationDeadlineAt?.toISOString() ?? null,
        confirmedAt: interval.confirmedAt?.toISOString() ?? null,
        invalidStartedAt: interval.invalidStartedAt?.toISOString() ?? null,
        invalidEndedAt: interval.invalidEndedAt?.toISOString() ?? null,
        triggerReason: interval.triggerReason,
        endReason: interval.endReason,
        metadata: interval.metadata,
      })),
      events: events.map((event) => ({
        eventType: event.eventType,
        serverTime: event.serverTime.toISOString(),
        clientTime: event.clientTime?.toISOString() ?? null,
        payload: event.payload,
      })),
    };
  }

  private durationMinutes(
    state?: { startedAt: Date | null; endsAt: Date | null } | null,
  ) {
    if (!state?.startedAt || !state.endsAt) return null;
    return Math.round(
      (state.endsAt.getTime() - state.startedAt.getTime()) / 60000,
    );
  }

  private meanTimeToViewA(tasks: SessionExportRecord['tasks']) {
    const values = tasks
      .filter((task) => task.aUnlockedForBAt && task.bViewedAInfoAt)
      .map(
        (task) =>
          (task.bViewedAInfoAt!.getTime() - task.aUnlockedForBAt!.getTime()) /
          1000,
      );
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }

  private meanBSubmitDelay(tasks: SessionExportRecord['tasks']) {
    const values = tasks
      .filter((task) => task.aUnlockedForBAt && task.bCompletedAt)
      .map(
        (task) =>
          (task.bCompletedAt!.getTime() - task.aUnlockedForBAt!.getTime()) /
          1000,
      );
    return values.length
      ? values.reduce((a, b) => a + b, 0) / values.length
      : null;
  }

  private accuracy(
    rows: Array<{ answeredAt: string | null; isCorrect: boolean | null }>,
  ) {
    const answered = rows.filter((row) => row.answeredAt);
    if (!answered.length) return null;
    return answered.filter((row) => row.isCorrect).length / answered.length;
  }

  private workSegmentFromSegmentIndex(segmentIndex: number | null) {
    if (segmentIndex === 0) return 0;
    if (segmentIndex === 1) return 1;
    if (segmentIndex === 3) return 2;
    if (segmentIndex === 5) return 3;
    return null;
  }

  private formatStamp(date: Date) {
    return date
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\..+$/, '')
      .replace('T', '_');
  }

  private countImageAttachments(sessions: SessionExportRecord[]) {
    return sessions.reduce(
      (sum, session) =>
        sum +
        session.aiMessages.filter(
          (message) =>
            Array.isArray(message.attachments) &&
            message.attachments.length > 0,
        ).length,
      0,
    );
  }
}
