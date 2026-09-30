import { ParticipantRole, Prisma, RuntimePhase, SegmentType } from '@prisma/client';
import { ExperimentService } from './experiment.service';

describe('online integrity state machine', () => {
  const config = {
    enabled: true,
    idlePromptSeconds: 120,
    idleConfirmationGraceSeconds: 20,
    heartbeatIntervalSeconds: 10,
    connectionLostGraceSeconds: 30,
    dropoutTimeoutSeconds: 180,
    offscreenViolationSeconds: 2,
    fullscreenRequired: true,
    authorizedDialogMaxSeconds: 60,
    pasteAfterOffscreenWindowSeconds: 30,
  };

  const atomicIntervalMock = (interval: Record<string, unknown>) => {
    let closed = interval;
    return {
      findFirst: jest.fn().mockResolvedValue(interval),
      findMany: jest.fn().mockResolvedValue([]),
      updateMany: jest.fn(({ data }) => {
        closed = { ...interval, ...data };
        return Promise.resolve({ count: 1 });
      }),
      findUnique: jest.fn(({ where }) => Promise.resolve({ ...closed, id: where.id })),
    };
  };

  it('records every offscreen interval but flags only durations over two seconds', async () => {
    const interval = { id: 'i-1', startedAt: new Date('2026-08-23T00:00:00.000Z'), metadata: null };
    const prisma = {
      onlineIntegrityInterval: atomicIntervalMock(interval),
      participantIntegrityState: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue({ currentState: 'ACTIVE', hasFormalDropout: false }) },
    };
    const service = new ExperimentService(prisma as never, {} as never);

    const atThreshold = await (service as any).closeOpenIntegrityInterval('state-1', 'OFFSCREEN', new Date('2026-08-23T00:00:02.000Z'), 'returned', undefined, config);
    expect(atThreshold.isViolation).toBe(false);

    const overThreshold = await (service as any).closeOpenIntegrityInterval('state-1', 'OFFSCREEN', new Date('2026-08-23T00:00:02.001Z'), 'returned', undefined, config);
    expect(overThreshold.isViolation).toBe(true);
    expect(prisma.participantIntegrityState.update).toHaveBeenLastCalledWith(expect.objectContaining({
      data: expect.objectContaining({ hasOffscreenViolation: true, offscreenViolationCount: { increment: 1 } }),
    }));
  });

  it('does not flag an authorized image picker as offscreen cheating', async () => {
    const interval = { id: 'i-2', startedAt: new Date('2026-08-23T00:00:00.000Z'), metadata: { authorizedDialog: true } };
    const prisma = {
      onlineIntegrityInterval: atomicIntervalMock(interval),
      participantIntegrityState: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue({ currentState: 'ACTIVE', hasFormalDropout: false }) },
    };
    const service = new ExperimentService(prisma as never, {} as never);
    const result = await (service as any).closeOpenIntegrityInterval('state-1', 'OFFSCREEN', new Date('2026-08-23T00:01:00.000Z'), 'returned', undefined, config);
    expect(result.isViolation).toBe(false);
  });

  it('does flag an authorized-dialog interval after its maximum allowance expires', async () => {
    const interval = { id: 'i-3', startedAt: new Date('2026-08-23T00:00:00.000Z'), metadata: { authorizedDialog: true } };
    const prisma = {
      onlineIntegrityInterval: atomicIntervalMock(interval),
      participantIntegrityState: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue({ currentState: 'ACTIVE', hasFormalDropout: false }) },
    };
    const service = new ExperimentService(prisma as never, {} as never);
    const result = await (service as any).closeOpenIntegrityInterval('state-1', 'OFFSCREEN', new Date('2026-08-23T00:01:00.001Z'), 'returned', undefined, config);
    expect(result.isViolation).toBe(true);
  });

  it('increments totals only for the caller that atomically closes an interval', async () => {
    const interval = { id: 'i-race', startedAt: new Date('2026-08-23T00:00:00.000Z'), metadata: null };
    const prisma = {
      onlineIntegrityInterval: {
        findFirst: jest.fn().mockResolvedValue(interval),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      participantIntegrityState: { update: jest.fn() },
    };
    const service = new ExperimentService(prisma as never, {} as never);

    await expect((service as any).closeOpenIntegrityInterval(
      'state-race',
      'DISCONNECT',
      new Date('2026-08-23T00:00:31.000Z'),
      'heartbeat_restored',
    )).resolves.toBeNull();
    expect(prisma.participantIntegrityState.update).not.toHaveBeenCalled();
  });

  it('applies the asymmetric A/B dropout policy', () => {
    const service = new ExperimentService({} as never, {} as never);
    const states = [
      { participantId: 'a', role: ParticipantRole.A, hasFormalDropout: false },
      { participantId: 'b', role: ParticipantRole.B, hasFormalDropout: true },
    ];
    expect((service as any).integrityOutcome(ParticipantRole.A, 'a', states)).toBe('CONTINUE_AFTER_B_DROPOUT');
    expect((service as any).integrityOutcome(ParticipantRole.B, 'b', states)).toBe('SELF_DROPPED');

    states[0].hasFormalDropout = true;
    states[1].hasFormalDropout = false;
    expect((service as any).integrityOutcome(ParticipantRole.B, 'b', states)).toBe('STOP_AFTER_A_DROPOUT');
  });

  it('marks the whole session unusable after invalid inactivity', () => {
    const service = new ExperimentService({} as never, {} as never);
    expect((service as any).integrityQualityFlags([{
      hasInvalidInactivity: true,
      hasOffscreenViolation: false,
      hasConnectionLoss: false,
      hasFormalDropout: false,
    }])).toMatchObject({ hasAnyParticipantInvalidInactivity: true, sessionDataUsable: false });
  });

  it('closes an open offscreen interval when a disconnect interval starts', async () => {
    const prisma = {
      participantIntegrityState: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'state-1',
          participantId: 'participant-1',
          role: ParticipantRole.A,
          lastHeartbeatAt: new Date('2026-08-23T00:00:00.000Z'),
          hasFormalDropout: false,
        }]),
        update: jest.fn(),
      },
      onlineIntegrityInterval: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
      },
    };
    const service = new ExperimentService(prisma as never, {} as never);
    const closeSpy = jest.spyOn(service as any, 'closeOpenIntegrityInterval').mockResolvedValue(null);

    await (service as any).evaluateConnectionStates(
      'session-1',
      config,
      new Date('2026-08-23T00:00:31.000Z'),
    );

    expect(closeSpy).toHaveBeenCalledWith(
      'state-1',
      'OFFSCREEN',
      new Date('2026-08-23T00:00:30.000Z'),
      'superseded_by_disconnect',
      undefined,
      config,
    );
    expect(prisma.onlineIntegrityInterval.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ intervalType: 'DISCONNECT', startedAt: new Date('2026-08-23T00:00:30.000Z') }),
    }));
  });

  it('does not double-count a disconnect when another caller wins the unique open interval', async () => {
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError('duplicate open interval', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const prisma = {
      participantIntegrityState: {
        findMany: jest.fn().mockResolvedValue([{
          id: 'state-race',
          participantId: 'participant-race',
          role: ParticipantRole.B,
          lastHeartbeatAt: new Date('2026-08-23T00:00:00.000Z'),
          hasFormalDropout: false,
        }]),
        update: jest.fn(),
      },
      onlineIntegrityInterval: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockRejectedValue(uniqueConflict),
      },
    };
    const service = new ExperimentService(prisma as never, {} as never);
    jest.spyOn(service as any, 'closeOpenIntegrityInterval').mockResolvedValue(null);

    await (service as any).evaluateConnectionStates(
      'session-race',
      config,
      new Date('2026-08-23T00:00:31.000Z'),
    );

    expect(prisma.participantIntegrityState.update).not.toHaveBeenCalled();
  });

  it('deduplicates a persisted task-2 release event across remounts', async () => {
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError('duplicate release', {
      code: 'P2002',
      clientVersion: 'test',
    });
    const prisma = {
      sideTaskPlan: {
        findUnique: jest.fn().mockResolvedValue({ id: 'plan-1', sessionId: 'session-1', releasedAt: new Date() }),
        update: jest.fn(),
      },
      sideTaskExposureLog: { create: jest.fn().mockRejectedValue(uniqueConflict) },
    };
    const service = new ExperimentService(prisma as never, {} as never);
    jest.spyOn(service as any, 'syncRuntime').mockResolvedValue({ session: { id: 'session-1' } });

    await expect(service.recordSideTaskExposure(
      'SESSION',
      'plan-1',
      'participant-1',
      'side_task_released',
    )).resolves.toEqual({ ok: true, duplicate: true });
    expect(prisma.sideTaskExposureLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ deduplicationKey: 'side-task-release:participant-1:plan-1' }),
    }));
  });

  it('records the actual work-segment end when A terminates the team session', async () => {
    const tx = {
      session: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          id: 'session-1',
          currentSegmentIndex: 3,
          experimentSnapshot: {},
        }),
        update: jest.fn(),
      },
      sessionSegmentState: { updateMany: jest.fn() },
      onlineIntegrityInterval: { findMany: jest.fn().mockResolvedValue([]) },
      participantIntegrityState: { update: jest.fn() },
      experimentEvent: { create: jest.fn() },
    };
    const prisma = {
      participantIntegrityState: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn(),
      },
      onlineIntegrityInterval: { findMany: jest.fn().mockResolvedValue([]) },
      experimentEvent: { create: jest.fn() },
      session: { findUnique: jest.fn().mockResolvedValue({ code: 'SESSION' }) },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const service = new ExperimentService(prisma as never, {} as never);
    const stoppedAt = new Date('2026-08-23T00:04:12.000Z');

    await (service as any).markFormalDropout(
      'state-a',
      'session-1',
      'participant-a',
      ParticipantRole.A,
      'participant_confirmed_quit',
      stoppedAt,
    );

    expect(tx.session.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { status: 'TERMINATED', runtimePhase: RuntimePhase.END },
    });
    expect(tx.sessionSegmentState.updateMany).toHaveBeenCalledWith({
      where: {
        sessionId: 'session-1',
        phase: 'FORMAL',
        segmentIndex: 3,
        type: SegmentType.WORK,
        completedAt: null,
      },
      data: { completedAt: stoppedAt },
    });
  });

  it('stores validated task and company context for clipboard events', async () => {
    const prisma = {
      participantIntegrityState: {
        upsert: jest.fn().mockResolvedValue({ id: 'state-1', hasFormalDropout: false }),
      },
      taskAssignment: {
        findFirst: jest.fn().mockResolvedValue({ id: 'task-1', companyId: 'company-1' }),
      },
      experimentEvent: { create: jest.fn() },
    };
    const service = new ExperimentService(prisma as never, {} as never);
    jest.spyOn(service as any, 'getIntegrityContext').mockResolvedValue({
      session: {
        id: 'session-1',
        runtimePhase: 'FORMAL_WORK',
        currentSegmentIndex: 2,
      },
      role: ParticipantRole.A,
      config,
    });

    await service.recordIntegrityEvent('SESSION', {
      participantId: 'participant-1',
      eventType: 'clipboard_paste',
      payload: {
        charCount: 12,
        contentHash: 'hash-1',
        classification: 'platform_external',
        afterOffscreen: true,
        taskAssignmentId: 'task-1',
        companyId: 'untrusted-company-id',
      },
    });

    expect(prisma.taskAssignment.findFirst).toHaveBeenCalledWith({
      where: { id: 'task-1', sessionId: 'session-1' },
      select: { id: true, companyId: true },
    });
    expect(prisma.experimentEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        taskAssignmentId: 'task-1',
        companyId: 'company-1',
        payload: expect.objectContaining({ taskAssignmentId: 'task-1', companyId: 'company-1' }),
      }),
    }));
  });
});
