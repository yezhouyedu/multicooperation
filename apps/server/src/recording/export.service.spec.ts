import { ExperimentPhase, ParticipantRole } from '@prisma/client';
import { ExportService } from './export.service';

describe('ExportService integrity-adjusted timing', () => {
  it('exports each practice clock without using the team stage duration', () => {
    const service = new ExportService({} as never, {} as never);
    const session = {
      experimentSnapshot: { practiceTiming: { A: 5, B: 6 } },
      progresses: [
        { participantId: 'a', stage: 'practice_timer_started', payload: { startedAt: '2026-10-10T00:00:00.000Z', endsAt: '2026-10-10T00:05:00.000Z', durationMinutes: 5 } },
        { participantId: 'b', stage: 'practice_timer_started', payload: { startedAt: '2026-10-10T00:01:00.000Z', endsAt: '2026-10-10T00:07:00.000Z', durationMinutes: 6 } },
      ],
      tasks: [{ phase: ExperimentPhase.PRACTICE, aSubmittedAt: new Date('2026-10-10T00:05:00Z'), bCompletedAt: new Date('2026-10-10T00:07:00Z') }],
    };
    expect((service as any).buildPracticeTiming(session, 'a', ParticipantRole.A)).toEqual({ configuredMinutes: 5, startedAt: '2026-10-10T00:00:00.000Z', plannedEndsAt: '2026-10-10T00:05:00.000Z', endedAt: '2026-10-10T00:05:00.000Z', elapsedSeconds: 300, source: 'participant_practice_timer' });
    expect((service as any).buildPracticeTiming(session, 'b', ParticipantRole.B).elapsedSeconds).toBe(360);
  });

  it('marks legacy practice exports instead of inventing a personal start time', () => {
    const service = new ExportService({} as never, {} as never);
    const timing = (service as any).buildPracticeTiming({ experimentSnapshot: {}, progresses: [], tasks: [] }, 'a', ParticipantRole.A);
    expect(timing).toEqual({ configuredMinutes: null, startedAt: null, plannedEndsAt: null, endedAt: null, elapsedSeconds: null, source: 'legacy_no_personal_timer' });
  });
  it('uses B personal practice start in company timing instead of A submission', () => {
    const service = new ExportService({} as never, {} as never);
    const task = { id: 'practice', phase: ExperimentPhase.PRACTICE, aSubmittedAt: new Date('2026-10-10T00:05:00Z') };
    const session = { tasks: [task], pairings: [{ participantBId: 'b' }], progresses: [{ participantId: 'b', stage: 'practice_timer_started', payload: { startedAt: '2026-10-10T00:01:00.000Z' } }] };
    expect((service as any).bAssignedAt(session, 'practice')).toBe('2026-10-10T00:01:00.000Z');
    expect((service as any).bAssignedAtFromTask(task)).toBeNull();
    expect((service as any).bAssignedAt({ ...session, progresses: [] }, 'practice')).toBeNull();
  });

  it('exports feedback send context with readable company codes', () => {
    const service = new ExportService({} as never, {} as never);
    const metadata = (service as any).buildCompanyMetadata(
      {
        randomizationAudit: null,
        pairings: [{ participantBId: 'participant-b' }],
        experimentEvents: [
          {
            participantId: 'participant-b',
            taskAssignmentId: 'b-task-1',
            companyId: 'b-company-1',
            eventType: 'b_feedback_to_a',
            serverTime: new Date('2026-09-14T12:00:00.000Z'),
            payload: {
              feedbackContext: {
                sourceTaskAssignmentId: 'b-task-1',
                sourceCompanyId: 'b-company-1',
                aActiveTaskAssignmentIdAtSend: 'a-task-6',
                aActiveCompanyIdAtSend: 'a-company-6',
              },
            },
          },
        ],
        integrityStates: [],
        segmentStates: [],
        tasks: [
          {
            id: 'b-task-1',
            companyId: 'b-company-1',
            company: { id: 'b-company-1', name: 'B公司', roundLabel: 'P01', materials: [] },
          },
          {
            id: 'a-task-6',
            companyId: 'a-company-6',
            company: { id: 'a-company-6', name: 'A公司', roundLabel: 'P06', materials: [] },
          },
        ],
      },
      {
        id: 'b-task-1',
        companyId: 'b-company-1',
        phase: ExperimentPhase.FORMAL,
        sequenceIndex: 1,
        snapshots: [],
        bSequenceIndex: 1,
        company: { id: 'b-company-1', name: 'B公司', roundLabel: 'P01', materials: [] },
      },
      ParticipantRole.B,
    );

    expect(metadata.task.feedbackSendContext).toEqual({
      sourceTaskAssignmentId: 'b-task-1',
      sourceCompanyId: 'b-company-1',
      sourceCompanyCode: 'P01',
      aActiveTaskAssignmentIdAtSend: 'a-task-6',
      aActiveCompanyIdAtSend: 'a-company-6',
      aActiveCompanyCodeAtSend: 'P06',
    });
  });

  it('sums company-level A-material exposure intervals without double counting overlaps', () => {
    const service = new ExportService({} as never, {} as never);
    const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
    const metadata = (service as any).buildCompanyMetadata(
      {
        randomizationAudit: null,
        pairings: [{ participantBId: 'participant-b' }],
        experimentEvents: [
          { participantId: 'participant-b', taskAssignmentId: 'task-1', eventType: 'b_a_original_material_view_started', serverTime: at(10), payload: { exposureId: 'view-1' } },
          { participantId: 'participant-b', taskAssignmentId: 'task-1', eventType: 'b_a_original_material_view_started', serverTime: at(15), payload: { exposureId: 'view-2' } },
          { participantId: 'participant-b', taskAssignmentId: 'task-1', eventType: 'b_a_original_material_view_ended', serverTime: at(20), payload: { exposureId: 'view-1' } },
          { participantId: 'participant-b', taskAssignmentId: 'task-1', eventType: 'b_a_original_material_view_ended', serverTime: at(25), payload: { exposureId: 'view-2' } },
        ],
        integrityStates: [],
        segmentStates: [],
        tasks: [],
      },
      {
        id: 'task-1',
        companyId: 'company-1',
        phase: ExperimentPhase.FORMAL,
        sequenceIndex: 1,
        snapshots: [],
        bSequenceIndex: 1,
        company: { id: 'company-1', name: 'P01', roundLabel: 'P01', materials: [] },
      },
      ParticipantRole.B,
    );

    expect(metadata.timing.bAOriginalMaterialsVisibleMs).toBe(15_000);
    expect(metadata.timing.bAOriginalMaterialsVisibleQualityFlags).toEqual([]);
  });

  it('caps an unclosed A-material exposure at B completion and flags it', () => {
    const service = new ExportService({} as never, {} as never);
    const at = (seconds: number) => new Date(Date.UTC(2026, 0, 1, 0, 0, seconds));
    const metadata = (service as any).buildCompanyMetadata(
      {
        randomizationAudit: null,
        pairings: [{ participantBId: 'participant-b' }],
        experimentEvents: [
          { participantId: 'participant-b', taskAssignmentId: 'task-1', eventType: 'b_a_original_material_view_started', serverTime: at(10), payload: { exposureId: 'view-open' } },
        ],
        integrityStates: [],
        segmentStates: [],
        tasks: [],
      },
      {
        id: 'task-1',
        companyId: 'company-1',
        phase: ExperimentPhase.FORMAL,
        sequenceIndex: 1,
        snapshots: [],
        bSequenceIndex: 1,
        bCompletedAt: at(30),
        company: { id: 'company-1', name: 'P01', roundLabel: 'P01', materials: [] },
      },
      ParticipantRole.B,
    );

    expect(metadata.timing.bAOriginalMaterialsVisibleMs).toBe(20_000);
    expect(metadata.timing.bAOriginalMaterialsVisibleQualityFlags).toEqual([
      'unclosed_b_a_material_view_interval',
    ]);
  });

  it('exports the B five-minute submission gate for each company', () => {
    const service = new ExportService({} as never, {} as never);
    const bCanSubmitAt = new Date('2026-08-23T00:05:00.000Z');
    const metadata = (service as any).buildCompanyMetadata(
      { randomizationAudit: null },
      {
        id: 'task-1',
        companyId: 'company-1',
        phase: ExperimentPhase.FORMAL,
        sequenceIndex: 1,
        snapshots: [],
        bSequenceIndex: 1,
        bCanSubmitAt,
        company: { id: 'company-1', name: 'P01', roundLabel: 'P01', materials: [] },
      },
      ParticipantRole.B,
    );

    expect(metadata.timing.bCanSubmitAt).toBe(bCanSubmitAt.toISOString());
  });

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
