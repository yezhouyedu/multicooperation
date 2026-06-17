import { Body, Controller, Get, Headers, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { ParticipantRole, Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { ExperimentService } from './experiment.service';
import { IdempotencyService } from '../idempotency/idempotency.service';

type EnterExperimentBody = {
  nickname?: string;
  role?: ParticipantRole;
};

type RecordProgressBody = {
  role: ParticipantRole;
  stage: string;
  payload?: Prisma.InputJsonValue;
};

type RecordTimestampEventBody = {
  participantId: string;
  eventType: string;
  clientTime?: string;
  role?: ParticipantRole;
  taskAssignmentId?: string;
  companyId?: string;
  sideTaskPlanId?: string;
  phase?: 'PRACTICE' | 'FORMAL' | 'practice' | 'formal';
  segmentIndex?: number;
  payload?: Prisma.InputJsonValue;
};

@Controller('experiment')
export class ExperimentController {
  constructor(
    private readonly experimentService: ExperimentService,
    private readonly idempotency: IdempotencyService,
  ) {}

  private idem<T>(key: string | undefined, route: string, scope: string | undefined, handler: () => Promise<T> | T) {
    return this.idempotency.run(key, { route, scope }, handler);
  }

  @Post('session')
  createSession(@Body() body: EnterExperimentBody) {
    return this.experimentService.createSession(body);
  }

  @Post('session/:code/join')
  joinSession(@Param('code') code: string, @Body() body: EnterExperimentBody) {
    return this.experimentService.joinSession(code.toUpperCase(), body);
  }

  @Post('session/:code/start-practice')
  startPractice(@Param('code') code: string) {
    return this.experimentService.startPractice(code.toUpperCase());
  }

  @Get('session/:code/practice-quiz')
  getPracticeQuiz(@Param('code') code: string) {
    return this.experimentService.getPracticeQuiz(code.toUpperCase());
  }

  @Post('session/:code/practice-quiz')
  submitPracticeQuiz(
    @Param('code') code: string,
    @Body() body: { participantId: string; answers: Prisma.InputJsonValue },
    @Headers('idempotency-key') key?: string,
  ) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'practice-quiz', `${sessionCode}:${body.participantId}`, () =>
      this.experimentService.submitPracticeQuiz(sessionCode, body.participantId, body.answers),
    );
  }

  @Post('session/:code/ready-practice')
  readyPractice(
    @Param('code') code: string,
    @Body() body: { participantId: string },
    @Headers('idempotency-key') key?: string,
  ) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'ready-practice', `${sessionCode}:${body.participantId}`, () =>
      this.experimentService.readyPractice(sessionCode, body.participantId),
    );
  }

  @Post('session/:code/complete-practice')
  completePractice(@Param('code') code: string) {
    return this.experimentService.completePractice(code.toUpperCase());
  }

  @Post('session/:code/ready-formal')
  readyFormal(
    @Param('code') code: string,
    @Body() body: { participantId: string },
    @Headers('idempotency-key') key?: string,
  ) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'ready-formal', `${sessionCode}:${body.participantId}`, () =>
      this.experimentService.readyFormal(sessionCode, body.participantId),
    );
  }

  @Post('session/:code/pre-segment-instruction/open')
  openPreSegmentInstruction(
    @Param('code') code: string,
    @Body() body: { participantId: string },
    @Headers('idempotency-key') key?: string,
  ) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'pre-segment-open', `${sessionCode}:${body.participantId}`, () =>
      this.experimentService.openPreSegmentInstruction(sessionCode, body.participantId),
    );
  }

  @Post('session/:code/pre-segment-instruction/complete')
  completePreSegmentInstruction(
    @Param('code') code: string,
    @Body() body: { participantId: string },
    @Headers('idempotency-key') key?: string,
  ) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'pre-segment-complete', `${sessionCode}:${body.participantId}`, () =>
      this.experimentService.completePreSegmentInstruction(sessionCode, body.participantId),
    );
  }

  @Get('session/:code')
  getSessionState(@Param('code') code: string) {
    return this.experimentService.getSessionState(code.toUpperCase());
  }

  @Get('session/:code/runtime')
  getRuntime(@Param('code') code: string, @Query('participantId') participantId?: string) {
    return this.experimentService.getRuntime(code.toUpperCase(), participantId);
  }

  @Sse('session/:code/events')
  streamSessionEvents(
    @Param('code') code: string,
    @Query('participantId') participantId?: string,
    @Query('lastEventId') lastEventIdQuery?: string,
    @Headers('last-event-id') lastEventId?: string,
  ): Observable<MessageEvent> {
    return this.experimentService.createSessionEventStream(code.toUpperCase(), participantId, lastEventId ?? lastEventIdQuery);
  }

  @Post('session/:code/progress')
  recordProgress(
    @Param('code') code: string,
    @Body() body: RecordProgressBody,
    @Headers('idempotency-key') key?: string,
  ) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'record-progress', `${sessionCode}:${body.role}:${body.stage}`, () => this.experimentService.recordProgress({
      sessionCode,
      role: body.role,
      stage: body.stage,
      payload: body.payload,
    }));
  }

  @Post('session/:code/timestamps/event')
  recordTimestampEvent(@Param('code') code: string, @Body() body: RecordTimestampEventBody) {
    return this.experimentService.recordTimestampEvent(code.toUpperCase(), body);
  }

  @Get('session/:code/progress')
  getSessionProgress(@Param('code') code: string) {
    return this.experimentService.getSessionProgress(code.toUpperCase());
  }

  @Get('session/:code/tasks')
  getSessionTasks(@Param('code') code: string) {
    return this.experimentService.getSessionTasks(code.toUpperCase());
  }

  @Get('session/:code/tasks/:taskId/draft')
  getTaskDraft(
    @Param('code') code: string,
    @Param('taskId') taskId: string,
    @Query('role') role: ParticipantRole,
    @Query('section') section?: 'main' | 'feedback',
  ) {
    return this.experimentService.getTaskDraft(code.toUpperCase(), taskId, { role, section });
  }

  @Post('session/:code/tasks/:taskId/draft')
  saveTaskDraft(
    @Param('code') code: string,
    @Param('taskId') taskId: string,
    @Body() body: { role: ParticipantRole; section?: 'main' | 'feedback'; payload: Prisma.InputJsonValue },
    @Headers('idempotency-key') key?: string,
  ) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'save-draft', `${sessionCode}:${taskId}:${body.role}:${body.section ?? 'main'}`, () =>
      this.experimentService.saveTaskDraft(sessionCode, taskId, body),
    );
  }

  @Get('session/:code/tasks/:taskId/snapshots')
  getTaskSnapshots(@Param('code') code: string, @Param('taskId') taskId: string) {
    return this.experimentService.getTaskSnapshots(code.toUpperCase(), taskId);
  }

  @Post('session/:code/tasks/:taskId/restore-latest')
  restoreLatestSnapshot(@Param('code') code: string, @Param('taskId') taskId: string) {
    return this.experimentService.restoreLatestSnapshot(code.toUpperCase(), taskId);
  }

  @Post('session/:code/tasks/:taskId/view-a-info')
  viewAInfo(@Param('code') code: string, @Param('taskId') taskId: string, @Headers('idempotency-key') key?: string) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'view-a-info', `${sessionCode}:${taskId}`, () =>
      this.experimentService.viewAInfo(sessionCode, taskId),
    );
  }

  @Post('session/:code/tasks/:taskId/view-a-materials')
  viewAMaterials(@Param('code') code: string, @Param('taskId') taskId: string, @Headers('idempotency-key') key?: string) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'view-a-materials', `${sessionCode}:${taskId}`, () =>
      this.experimentService.viewAMaterials(sessionCode, taskId),
    );
  }

  @Post('session/:code/tasks/:taskId/a-submit')
  aSubmitTask(@Param('code') code: string, @Param('taskId') taskId: string, @Headers('idempotency-key') key?: string) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'a-submit', `${sessionCode}:${taskId}`, () =>
      this.experimentService.aSubmitTask(sessionCode, taskId),
    );
  }

  @Post('session/:code/tasks/:taskId/b-complete')
  bCompleteTask(@Param('code') code: string, @Param('taskId') taskId: string, @Headers('idempotency-key') key?: string) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'b-complete', `${sessionCode}:${taskId}`, () =>
      this.experimentService.bCompleteTask(sessionCode, taskId),
    );
  }

  @Get('session/:code/questionnaire')
  getQuestionnaire(@Param('code') code: string, @Query('participantId') participantId?: string) {
    return this.experimentService.getQuestionnaire(code.toUpperCase(), participantId);
  }

  @Post('session/:code/questionnaire')
  submitQuestionnaire(
    @Param('code') code: string,
    @Body() body: { participantId: string; answers: Prisma.InputJsonValue },
    @Headers('idempotency-key') key?: string,
  ) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'submit-questionnaire', `${sessionCode}:${body.participantId}`, () =>
      this.experimentService.submitQuestionnaire(sessionCode, body.participantId, body.answers),
    );
  }

  @Post('session/:code/sidetask/:planId/answer')
  answerSideTask(
    @Param('code') code: string,
    @Param('planId') planId: string,
    @Body() body: { participantId: string; answer: string },
    @Headers('idempotency-key') key?: string,
  ) {
    const sessionCode = code.toUpperCase();
    return this.idem(key, 'side-task-answer', `${sessionCode}:${planId}:${body.participantId}`, () =>
      this.experimentService.answerSideTask(sessionCode, planId, body.participantId, body.answer),
    );
  }

  @Post('session/:code/sidetask/:planId/exposure')
  recordSideTaskExposure(
    @Param('code') code: string,
    @Param('planId') planId: string,
    @Body() body: { participantId: string; eventType: string; payload?: Record<string, unknown> },
  ) {
    return this.experimentService.recordSideTaskExposure(
      code.toUpperCase(),
      planId,
      body.participantId,
      body.eventType,
      body.payload,
    );
  }
}
