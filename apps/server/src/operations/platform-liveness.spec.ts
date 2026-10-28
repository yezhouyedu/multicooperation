import { PlatformLivenessService } from './platform-liveness.service';

describe('platform recovery evidence', () => {
  function fixture(previous: unknown) {
    const tx = {
      $executeRaw: jest.fn(),
      serverLiveness: { findUnique: jest.fn().mockResolvedValue(previous), upsert: jest.fn() },
      session: { findMany: jest.fn().mockResolvedValue([{ id: 's', currentPhase: 'FORMAL', currentSegmentIndex: 1 }]) },
      experimentEvent: { createMany: jest.fn() },
    };
    const prisma = { $transaction: jest.fn((fn) => fn(tx)) };
    return { tx, service: new PlatformLivenessService(prisma as never) };
  }
  it('initializes without fabricating an outage', async () => {
    const { service, tx } = fixture(null);
    await service.pulse();
    expect(tx.experimentEvent.createMany).not.toHaveBeenCalled();
    expect(tx.serverLiveness.upsert).toHaveBeenCalled();
  });
  it('persists restart bounds, not an invented exact failure time', async () => {
    const { service, tx } = fixture({ instanceId: 'old', lastAliveAt: new Date(Date.now() - 60000) });
    await service.pulse();
    expect(tx.experimentEvent.createMany).toHaveBeenCalledWith({ data: [expect.objectContaining({
      sessionId: 's', eventType: 'platform_service_interruption',
      payload: expect.objectContaining({ reason: 'service_instance_changed', exactOutageDurationKnown: false }),
    })] });
  });
  it('records event and heartbeat atomically; write failure is not swallowed', async () => {
    const { service, tx } = fixture({ instanceId: 'old', lastAliveAt: new Date() });
    tx.experimentEvent.createMany.mockRejectedValue(new Error('DB unavailable'));
    await expect(service.pulse()).rejects.toThrow('DB unavailable');
    expect(tx.serverLiveness.upsert).not.toHaveBeenCalled();
  });
  it('does not overlap liveness transactions', async () => {
    const { service, tx } = fixture(null);
    await Promise.all([service.pulse(), service.pulse()]);
    expect(tx.serverLiveness.upsert).toHaveBeenCalledTimes(1);
  });
  it('records a long gap in the same instance but not healthy routine pulses', async () => {
    const { service, tx } = fixture(null);
    await service.pulse();
    const instanceId = tx.serverLiveness.upsert.mock.calls[0][0].create.instanceId;
    tx.serverLiveness.findUnique.mockResolvedValue({ instanceId, lastAliveAt: new Date() });
    await service.pulse();
    expect(tx.experimentEvent.createMany).not.toHaveBeenCalled();
    tx.serverLiveness.findUnique.mockResolvedValue({ instanceId, lastAliveAt: new Date(Date.now() - 20000) });
    await service.pulse();
    expect(tx.experimentEvent.createMany.mock.calls[0][0].data[0].payload.reason).toBe('liveness_gap');
  });
});
