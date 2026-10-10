import { ParticipantRole } from '@prisma/client';
import { ExperimentService } from './experiment.service';

describe('independent practice policy', () => {
  function setup() {
    const task = { id: 't1', phase: 'PRACTICE', aSubmittedAt: null, bCompletedAt: null, aUnlockedForBAt: new Date(), bCanSubmitAt: new Date(0) };
    const session = { id: 's1', runtimePhase: 'PRACTICE', tasks: [task], pairings: [{ participantAId: 'a', participantBId: 'b' }], experimentSnapshot: { onlineIntegrity: { enabled: false } } };
    const prisma = {
      session: { findUnique: jest.fn().mockResolvedValue(session) },
      pairing: { findFirst: jest.fn().mockResolvedValue(session.pairings[0]) },
      taskAssignment: { findFirst: jest.fn().mockResolvedValue(task), update: jest.fn() },
      participantIntegrityState: { upsert: jest.fn() }, experimentEvent: { create: jest.fn() },
    };
    const service = new ExperimentService(prisma as never, {} as never);
    jest.spyOn(service as any, 'syncRuntime').mockResolvedValue({ session, config: {} });
    jest.spyOn(service as any, 'assertRoleCanContinue').mockResolvedValue(undefined);
    return { service, prisma, session, task };
  }
  it.each(['aSubmitTask', 'bCompleteTask', 'viewAInfo', 'viewAMaterials', 'completePractice'])('rejects practice manual/interaction API %s', async (method) => {
    const { service, prisma } = setup();
    await expect((service as any)[method]('TEST', 't1')).rejects.toThrow();
    expect(prisma.taskAssignment.update).not.toHaveBeenCalled();
  });
  it('rejects a practice feedback draft', async () => {
    const { service } = setup();
    await expect(service.saveTaskDraft('TEST', 't1', { role: ParticipantRole.B, section: 'feedback', payload: {} })).rejects.toThrow('测试轮不提供反馈环节');
  });
  it('allows own task read but never practice A data read by B', async () => {
    const { service } = setup();
    await expect(service.getTaskDraft('TEST', 't1', { role: ParticipantRole.A, participantId: 'b' })).rejects.toThrow();
    await expect(service.getTaskDraft('TEST', 't1', { role: ParticipantRole.B, participantId: 'b' })).resolves.toMatchObject({ ok: true });
  });
  it('records formal rules consent when monitoring is disabled without enabling monitoring', async () => {
    const { service, prisma, session } = setup();
    await expect(service.submitIntegrityCommitment('TEST', { participantId: 'a', accepted: true, answers: { formalOnly: true, offscreenRule: true, dropoutRule: true, privacyRule: true } })).resolves.toMatchObject({ passed: true });
    expect(prisma.participantIntegrityState.upsert).toHaveBeenCalled();
    expect(session.experimentSnapshot.onlineIntegrity.enabled).toBe(false);
  });
});
