import { ExperimentPhase, ParticipantRole, Prisma } from '@prisma/client';
import { ExperimentService } from './experiment.service';

describe('ExperimentService feedback send context', () => {
  function createService(activeATask: { id: string; companyId: string } | null) {
    const sourceTask = {
      id: 'b-task-1',
      companyId: 'b-company-1',
      phase: ExperimentPhase.FORMAL,
      bSequenceIndex: 1,
    };
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-1',
          code: 'TEST01',
          currentPhase: ExperimentPhase.FORMAL,
          currentSegmentIndex: 1,
          tasks: [sourceTask],
          pairings: [
            {
              participantAId: 'participant-a',
              participantBId: 'participant-b',
              participantA: { id: 'participant-a' },
              participantB: { id: 'participant-b' },
            },
          ],
        }),
      },
      taskAssignment: {
        findFirst: jest.fn().mockImplementation(({ where }: { where: Record<string, unknown> }) => {
          if (where.id === sourceTask.id) return Promise.resolve(sourceTask);
          return Promise.resolve(activeATask);
        }),
      },
      taskProgress: {
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({
            id: 'progress-1',
            stage: data.stage,
            payload: data.payload,
            createdAt: new Date('2026-09-14T12:00:00.000Z'),
          }),
        ),
      },
      experimentEvent: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: { data: Record<string, unknown> }) =>
          Promise.resolve({ id: 'timestamp-event-1', ...data }),
        ),
      },
    };
    const audit = { record: jest.fn().mockResolvedValue({ id: 'event-1' }) };
    const service = new ExperimentService(prisma as never, audit as never);
    jest.spyOn(service as any, 'emitSessionEvent').mockImplementation(() => undefined);
    return { service, prisma, audit };
  }

  it('records the B source company and the A active company at send time', async () => {
    const { service, prisma, audit } = createService({ id: 'a-task-6', companyId: 'a-company-6' });

    await service.recordProgress({
      sessionCode: 'TEST01',
      role: ParticipantRole.B,
      stage: 'b_feedback_to_a',
      payload: {
        taskId: 'b-task-1',
        companyId: 'spoofed-company',
        helpfulness: '比较有帮助',
      },
    });

    expect(prisma.taskProgress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          feedbackContext: {
            sourceTaskAssignmentId: 'b-task-1',
            sourceCompanyId: 'b-company-1',
            aActiveTaskAssignmentIdAtSend: 'a-task-6',
            aActiveCompanyIdAtSend: 'a-company-6',
          },
        }),
      }),
    });
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        taskAssignmentId: 'b-task-1',
        companyId: 'b-company-1',
        payload: expect.objectContaining({
          feedbackContext: expect.objectContaining({
            aActiveCompanyIdAtSend: 'a-company-6',
          }),
        }),
      }),
    );
  });

  it('records null A context when A is between companies', async () => {
    const { service, prisma } = createService(null);

    await service.recordProgress({
      sessionCode: 'TEST01',
      role: ParticipantRole.B,
      stage: 'b_feedback_to_a',
      payload: { taskId: 'b-task-1' },
    });

    expect(prisma.taskProgress.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        payload: expect.objectContaining({
          feedbackContext: expect.objectContaining({
            aActiveTaskAssignmentIdAtSend: null,
            aActiveCompanyIdAtSend: null,
          }),
        }),
      }),
    });
  });

  it('accepts A-material exposure only from B and trusts the task company', async () => {
    const { service, prisma } = createService(null);

    await service.recordTimestampEvent('TEST01', {
      participantId: 'participant-b',
      role: ParticipantRole.B,
      eventType: 'b_a_original_material_view_started',
      taskAssignmentId: 'b-task-1',
      companyId: 'spoofed-company',
      payload: { exposureId: 'exposure-1' },
    });

    expect(prisma.experimentEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        participantId: 'participant-b',
        taskAssignmentId: 'b-task-1',
        companyId: 'b-company-1',
        role: ParticipantRole.B,
      }),
    });
  });

  it('rejects A-material exposure sent as the wrong participant', async () => {
    const { service } = createService(null);

    await expect(
      service.recordTimestampEvent('TEST01', {
        participantId: 'participant-a',
        role: ParticipantRole.B,
        eventType: 'b_a_original_material_view_started',
        taskAssignmentId: 'b-task-1',
        payload: { exposureId: 'exposure-1' },
      }),
    ).rejects.toThrow('A 原始材料查看事件必须来自当前 Session 的 B 任务');
  });

  it('recovers when concurrent runtime requests create the same integrity state', async () => {
    const existing = { id: 'integrity-state-1' };
    const upsert = jest.fn().mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('concurrent create', {
        code: 'P2002',
        clientVersion: 'test',
      }),
    );
    const findUniqueOrThrow = jest.fn().mockResolvedValue(existing);
    const service = new ExperimentService(
      { participantIntegrityState: { upsert, findUniqueOrThrow } } as never,
      {} as never,
    );

    await expect(
      (service as any).ensureIntegrityState(
        'session-1',
        'participant-b',
        ParticipantRole.B,
        new Date('2026-09-14T12:00:00.000Z'),
      ),
    ).resolves.toBe(existing);
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where: {
        sessionId_participantId: {
          sessionId: 'session-1',
          participantId: 'participant-b',
        },
      },
    });
  });
});
