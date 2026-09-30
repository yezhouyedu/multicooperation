import { AiLevel, ExperimentPhase, RuntimePhase, SegmentType } from '@prisma/client';
import { ExperimentService } from './experiment.service';

describe('practice timeout concurrency', () => {
  const now = new Date('2026-09-30T00:00:31.000Z');
  const endsAt = '2026-09-30T00:00:30.000Z';
  const session = {
    id: 'session-1',
    runtimePhase: RuntimePhase.PRACTICE,
    experimentSnapshot: { aiEnabled: false },
    pairings: [{ participantAId: 'participant-a', participantBId: 'participant-b' }],
    tasks: [{
      id: 'practice-task',
      phase: ExperimentPhase.PRACTICE,
      sortOrder: 0,
      aSubmittedAt: null,
      bCompletedAt: null,
    }],
  };
  const config = {
    segmentOneAiLevel: AiLevel.BASIC,
    segmentTwoAiLevel: AiLevel.BASIC,
    segmentThreeAiLevel: AiLevel.BASIC,
  };

  it('writes timeout progress only for the caller that wins each task update', async () => {
    const tx = {
      taskProgress: {
        findMany: jest.fn().mockResolvedValue([
          { participantId: 'participant-a', payload: { endsAt } },
          { participantId: 'participant-b', payload: { endsAt } },
        ]),
        create: jest.fn(),
      },
      taskAssignment: {
        updateMany: jest.fn()
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 1 })
          .mockResolvedValueOnce({ count: 0 })
          .mockResolvedValueOnce({ count: 0 }),
      },
    };
    const service = new ExperimentService({} as never, {} as never);
    jest.spyOn(service as any, 'advanceAfterPractice').mockResolvedValue(undefined);

    await (service as any).syncPracticeParticipantTimers(tx, session, config, now);
    await (service as any).syncPracticeParticipantTimers(tx, session, config, now);

    expect(tx.taskProgress.create).toHaveBeenCalledTimes(2);
    expect(tx.taskProgress.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ participantId: 'participant-a', stage: 'practice_a_task_auto_submitted' }),
    }));
    expect(tx.taskProgress.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ participantId: 'participant-b', stage: 'practice_b_task_auto_completed' }),
    }));
  });

  it('allows only one transaction to advance practice into formal ready', async () => {
    const tx = {
      session: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      taskAssignment: { findFirst: jest.fn() },
    };
    const service = new ExperimentService({} as never, {} as never);

    await (service as any).advanceAfterPractice(tx, session, now);

    expect(tx.session.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', runtimePhase: RuntimePhase.PRACTICE },
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
    expect(tx.taskAssignment.findFirst).not.toHaveBeenCalled();
  });
});
