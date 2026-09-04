import { ExperimentPhase, ParticipantRole } from '@prisma/client';
import { ExportService } from './export.service';

describe('ExportService integrity-adjusted timing', () => {
  it('keeps raw timing and subtracts the union of invalid, disconnected, and post-dropout time', () => {
    const service = new ExportService({} as never, {} as never);
    const at = (seconds: number) =>
      new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
    const participant = { id: 'participant-1' };
    const session = {
      code: 'TEST01',
      segmentStates: [
        {
          phase: ExperimentPhase.FORMAL,
          segmentIndex: 1,
          startedAt: at(0),
          completedAt: at(100),
          endsAt: at(100),
        },
      ],
      experimentEvents: [
        {
          id: 'side-enter',
          participantId: participant.id,
          eventType: 'side_area_entered',
          serverTime: at(10),
          taskAssignmentId: 'task-1',
          companyId: 'company-1',
          sideTaskPlanId: null,
          segmentIndex: 1,
          payload: {},
        },
        {
          id: 'main-return',
          participantId: participant.id,
          eventType: 'main_area_returned',
          serverTime: at(50),
          taskAssignmentId: 'task-1',
          companyId: 'company-1',
          sideTaskPlanId: null,
          segmentIndex: 1,
          payload: {},
        },
      ],
      integrityStates: [
        {
          participantId: participant.id,
          hasFormalDropout: true,
          formalDropoutAt: at(90),
          intervals: [
            {
              intervalType: 'INACTIVITY',
              startedAt: at(20),
              endedAt: at(30),
              isViolation: true,
            },
            {
              intervalType: 'OFFSCREEN',
              startedAt: at(25),
              endedAt: at(35),
              isViolation: true,
            },
            {
              intervalType: 'OFFSCREEN',
              startedAt: at(40),
              endedAt: at(45),
              isViolation: false,
            },
            {
              intervalType: 'DISCONNECT',
              startedAt: at(60),
              endedAt: at(80),
              isViolation: false,
            },
          ],
        },
      ],
      aiMessages: [],
      tasks: [
        {
          id: 'task-1',
          companyId: 'company-1',
          phase: ExperimentPhase.FORMAL,
          aStartedAt: at(0),
          aSubmittedAt: at(100),
          frozenAt: null,
          aDraft: {},
          bSequenceIndex: null,
          bDraft: null,
          bCompletedAt: null,
          bPreAAiLevel: null,
          snapshots: [],
          company: { id: 'company-1', roundLabel: 'C01' },
        },
      ],
    };

    const timestamps = (service as any).buildTimestamps(
      session,
      participant,
      ParticipantRole.A,
    );

    expect(timestamps.derived).toMatchObject({
      eligibleWorkMs: 100_000,
      totalMainTimeMs: 60_000,
      totalSideTimeMs: 40_000,
      invalidInactivityExcludedMs: 10_000,
      offscreenViolationExcludedMs: 10_000,
      invalidBehaviorExcludedMs: 15_000,
      disconnectExcludedMs: 20_000,
      postDropoutExcludedMs: 10_000,
      totalExcludedMs: 45_000,
      validEligibleWorkMs: 55_000,
      validMainTimeMs: 30_000,
      validSideTimeMs: 25_000,
      validMainTimeShare: 0.5455,
      validSideTimeShare: 0.4545,
    });
    expect(timestamps.sideSwitches[0]).toMatchObject({
      durationMs: 40_000,
      invalidBehaviorExcludedMs: 15_000,
      disconnectExcludedMs: 0,
      postDropoutExcludedMs: 0,
      totalExcludedMs: 15_000,
      validDurationMs: 25_000,
    });
    expect(timestamps.formalWorkSegments[0]).toMatchObject({
      durationMs: 100_000,
      invalidBehaviorExcludedMs: 15_000,
      disconnectExcludedMs: 20_000,
      postDropoutExcludedMs: 10_000,
      totalExcludedMs: 45_000,
      validDurationMs: 55_000,
    });
    expect(timestamps.companyTimelines[0]).toMatchObject({
      companyId: 'company-1',
      sideMs: 40_000,
      mainMs: 60_000,
      totalExcludedMs: 45_000,
      validTotalMs: 55_000,
      validSideMs: 25_000,
      validMainMs: 30_000,
    });
  });
});
