import { Body, Controller, Get, MessageEvent, Param, Post, Query, Sse } from '@nestjs/common';
import { ParticipantRole, Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { ExperimentService } from './experiment.service';

type EnterExperimentBody = {
  nickname?: string;
  role?: ParticipantRole;
};

type RecordProgressBody = {
  role: ParticipantRole;
  stage: string;
  payload?: Prisma.InputJsonValue;
};

@Controller('experiment')
export class ExperimentController {
  constructor(private readonly experimentService: ExperimentService) {}

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
  ) {
    return this.experimentService.submitPracticeQuiz(code.toUpperCase(), body.participantId, body.answers);
  }

  @Post('session/:code/ready-practice')
  readyPractice(@Param('code') code: string, @Body() body: { participantId: string }) {
    return this.experimentService.readyPractice(code.toUpperCase(), body.participantId);
  }

  @Post('session/:code/complete-practice')
  completePractice(@Param('code') code: string) {
    return this.experimentService.completePractice(code.toUpperCase());
  }

  @Post('session/:code/ready-formal')
  readyFormal(@Param('code') code: string, @Body() body: { participantId: string }) {
    return this.experimentService.readyFormal(code.toUpperCase(), body.participantId);
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
  ): Observable<MessageEvent> {
    return this.experimentService.createSessionEventStream(code.toUpperCase(), participantId);
  }

  @Post('session/:code/progress')
  recordProgress(@Param('code') code: string, @Body() body: RecordProgressBody) {
    return this.experimentService.recordProgress({
      sessionCode: code.toUpperCase(),
      role: body.role,
      stage: body.stage,
      payload: body.payload,
    });
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
  ) {
    return this.experimentService.saveTaskDraft(code.toUpperCase(), taskId, body);
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
  viewAInfo(@Param('code') code: string, @Param('taskId') taskId: string) {
    return this.experimentService.viewAInfo(code.toUpperCase(), taskId);
  }

  @Post('session/:code/tasks/:taskId/view-a-materials')
  viewAMaterials(@Param('code') code: string, @Param('taskId') taskId: string) {
    return this.experimentService.viewAMaterials(code.toUpperCase(), taskId);
  }

  @Post('session/:code/tasks/:taskId/a-submit')
  aSubmitTask(@Param('code') code: string, @Param('taskId') taskId: string) {
    return this.experimentService.aSubmitTask(code.toUpperCase(), taskId);
  }

  @Post('session/:code/tasks/:taskId/b-complete')
  bCompleteTask(@Param('code') code: string, @Param('taskId') taskId: string) {
    return this.experimentService.bCompleteTask(code.toUpperCase(), taskId);
  }

  @Get('session/:code/questionnaire')
  getQuestionnaire(@Param('code') code: string) {
    return this.experimentService.getQuestionnaire(code.toUpperCase());
  }

  @Post('session/:code/questionnaire')
  submitQuestionnaire(
    @Param('code') code: string,
    @Body() body: { participantId: string; answers: Prisma.InputJsonValue },
  ) {
    return this.experimentService.submitQuestionnaire(code.toUpperCase(), body.participantId, body.answers);
  }

  @Post('session/:code/sidetask/:planId/answer')
  answerSideTask(
    @Param('code') code: string,
    @Param('planId') planId: string,
    @Body() body: { participantId: string; answer: string },
  ) {
    return this.experimentService.answerSideTask(code.toUpperCase(), planId, body.participantId, body.answer);
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
