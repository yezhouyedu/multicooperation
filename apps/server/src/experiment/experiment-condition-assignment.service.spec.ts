import { BadRequestException } from '@nestjs/common';
import { ExperimentConditionAssignmentService } from './experiment-condition-assignment.service';

describe('ExperimentConditionAssignmentService experiment run lifecycle', () => {
  function setup() {
    const tx = {
      experimentRun: {
        findUnique: jest.fn(),
        updateMany: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      experimentConfig: { update: jest.fn() },
      session: { count: jest.fn() },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    return {
      tx,
      service: new ExperimentConditionAssignmentService(prisma as never),
    };
  }

  it('reactivates a paused run without replacing its existing sequence', async () => {
    const { service, tx } = setup();
    const activatedAt = new Date('2026-07-01T00:00:00.000Z');
    tx.experimentRun.findUnique.mockResolvedValue({ id: 'run-1', status: 'CLOSED', activatedAt, designVersion: 'nine_condition_block_v1' });
    tx.experimentRun.updateMany.mockResolvedValue({ count: 1 });
    tx.experimentRun.update.mockResolvedValue({ id: 'run-1', status: 'ACTIVE' });
    tx.experimentConfig.update.mockResolvedValue({});

    await expect(service.activateRun('run-1')).resolves.toMatchObject({ id: 'run-1', status: 'ACTIVE' });
    expect(tx.experimentRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: { status: 'ACTIVE', activatedAt, closedAt: null },
    });
    expect(tx.experimentConfig.update).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: { activeExperimentMode: 'formal', activeExperimentRunId: 'run-1' },
    });
  });

  it('blocks deletion while the run is active', async () => {
    const { service, tx } = setup();
    tx.experimentRun.findUnique.mockResolvedValue({ id: 'run-1', status: 'ACTIVE' });

    await expect(service.deleteRun('run-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.session.count).not.toHaveBeenCalled();
    expect(tx.experimentRun.delete).not.toHaveBeenCalled();
  });

  it('blocks deletion while sessions still reference the run', async () => {
    const { service, tx } = setup();
    tx.experimentRun.findUnique.mockResolvedValue({ id: 'run-1', status: 'CLOSED' });
    tx.session.count.mockResolvedValue(2);

    await expect(service.deleteRun('run-1')).rejects.toThrow('仍关联 2 个 Session');
    expect(tx.experimentRun.delete).not.toHaveBeenCalled();
  });

  it('deletes an inactive run after its sessions have been cleared', async () => {
    const { service, tx } = setup();
    tx.experimentRun.findUnique.mockResolvedValue({ id: 'run-1', status: 'CLOSED' });
    tx.session.count.mockResolvedValue(0);
    tx.experimentRun.delete.mockResolvedValue({ id: 'run-1' });

    await expect(service.deleteRun('run-1')).resolves.toEqual({ id: 'run-1' });
    expect(tx.experimentRun.delete).toHaveBeenCalledWith({ where: { id: 'run-1' } });
  });

  it('pauses the active run when switching to manual mode', async () => {
    const { service, tx } = setup();
    tx.experimentRun.updateMany.mockResolvedValue({ count: 1 });
    tx.experimentConfig.update.mockResolvedValue({});

    await expect(service.useManualMode()).resolves.toEqual({ ok: true });
    expect(tx.experimentRun.updateMany).toHaveBeenCalledWith({
      where: { status: 'ACTIVE' },
      data: { status: 'CLOSED', closedAt: expect.any(Date) },
    });
    expect(tx.experimentConfig.update).toHaveBeenCalledWith({
      where: { id: 'default' },
      data: { activeExperimentMode: 'manual', activeExperimentRunId: null },
    });
  });
});
