import { AuthService } from './auth.service';

describe('pairing admission transaction', () => {
  it('uses a fresh post-lock snapshot and never borrows another connection for audit', async () => {
    const tx = {
      $executeRaw: jest.fn(),
      session: { findFirst: jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 's', code: 'CODE', pairings: [{ id: 'pair', participantAId: 'first', participantBId: null }] }), update: jest.fn() },
      participant: { update: jest.fn() }, pairing: { update: jest.fn() }, experimentEvent: { create: jest.fn(), createMany: jest.fn() },
    };
    const prisma = { participant: { findUnique: jest.fn().mockResolvedValue({ id: 'second', isActive: true }) }, session: { findFirst: jest.fn().mockResolvedValue(null) }, $transaction: jest.fn((fn, _options) => fn(tx)) };
    const audit = { record: jest.fn() };
    const service = new AuthService(prisma as never, audit as never, {} as never);
    jest.spyOn(service as any, 'initializeSessionData').mockResolvedValue(undefined);
    await service.login('TEST');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(prisma.$transaction.mock.calls[0][1]).toMatchObject({ isolationLevel: 'ReadCommitted', maxWait: 30000 });
    expect(tx.experimentEvent.createMany.mock.calls[0][0].data).toHaveLength(2);
    expect(audit.record).not.toHaveBeenCalled();
  });
});
