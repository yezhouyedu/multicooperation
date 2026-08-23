import { ParticipantRole } from '@prisma/client';
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

  it('records every offscreen interval but flags only durations over two seconds', async () => {
    const interval = { id: 'i-1', startedAt: new Date('2026-08-23T00:00:00.000Z'), metadata: null };
    const prisma = {
      onlineIntegrityInterval: { findFirst: jest.fn().mockResolvedValue(interval), findMany: jest.fn().mockResolvedValue([]), update: jest.fn(({ data }) => ({ ...interval, ...data })) },
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
      onlineIntegrityInterval: { findFirst: jest.fn().mockResolvedValue(interval), findMany: jest.fn().mockResolvedValue([]), update: jest.fn(({ data }) => ({ ...interval, ...data })) },
      participantIntegrityState: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue({ currentState: 'ACTIVE', hasFormalDropout: false }) },
    };
    const service = new ExperimentService(prisma as never, {} as never);
    const result = await (service as any).closeOpenIntegrityInterval('state-1', 'OFFSCREEN', new Date('2026-08-23T00:01:00.000Z'), 'returned', undefined, config);
    expect(result.isViolation).toBe(false);
  });

  it('does flag an authorized-dialog interval after its maximum allowance expires', async () => {
    const interval = { id: 'i-3', startedAt: new Date('2026-08-23T00:00:00.000Z'), metadata: { authorizedDialog: true } };
    const prisma = {
      onlineIntegrityInterval: { findFirst: jest.fn().mockResolvedValue(interval), findMany: jest.fn().mockResolvedValue([]), update: jest.fn(({ data }) => ({ ...interval, ...data })) },
      participantIntegrityState: { update: jest.fn(), findUnique: jest.fn().mockResolvedValue({ currentState: 'ACTIVE', hasFormalDropout: false }) },
    };
    const service = new ExperimentService(prisma as never, {} as never);
    const result = await (service as any).closeOpenIntegrityInterval('state-1', 'OFFSCREEN', new Date('2026-08-23T00:01:00.001Z'), 'returned', undefined, config);
    expect(result.isViolation).toBe(true);
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
});
