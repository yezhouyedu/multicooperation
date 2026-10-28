import { ExperimentService } from './experiment.service';

describe('versioned draft persistence wiring', () => {
  function fixture() {
    let task = { id: 't', phase: 'FORMAL', draftVersions: {} } as Record<string, any>;
    let serial = Promise.resolve();
    const tx = {
      $executeRaw: jest.fn(),
      taskAssignment: {
        findUniqueOrThrow: jest.fn(async () => structuredClone(task)),
        update: jest.fn(async ({ data }) => { task = { ...task, ...data }; return task; }),
      },
    };
    const prisma = {
      session: { findUnique: jest.fn().mockResolvedValue({ id: 's' }) },
      taskAssignment: { findFirst: jest.fn(async () => structuredClone(task)) },
      $transaction: jest.fn((fn) => { const next = serial.then(() => fn(tx)); serial = next.catch(() => undefined); return next; }),
    };
    const service = new ExperimentService(prisma as never, {} as never);
    jest.spyOn(service as any, 'assertRoleCanContinue').mockResolvedValue(undefined);
    jest.spyOn(service, 'recordProgress').mockResolvedValue({ ok: true } as never);
    const save = (revision: number, mutationId: string, payload = mutationId) => service.saveTaskDraft('S', 't', { role: 'A', payload: { text: payload }, expectedRevision: revision, mutationId } as never);
    return { service, tx, save, task: () => task };
  }
  it('only one concurrent save can win the same revision', async () => {
    const { save, task, tx } = fixture();
    const results = await Promise.allSettled([save(0, 'new'), save(0, 'late')]);
    expect(results.map((item) => item.status)).toEqual(['fulfilled', 'rejected']);
    expect(task().aDraft).toEqual({ text: 'new' });
    expect(tx.$executeRaw).toHaveBeenCalledTimes(2);
  });
  it('retries the same mutation without duplicate progress or version advance', async () => {
    const { save, service, task } = fixture();
    await save(0, 'm');
    expect(await save(0, 'm')).toMatchObject({ duplicate: true, revision: 1 });
    expect(service.recordProgress).toHaveBeenCalledTimes(1);
    expect(task().draftVersions['A:main'].revision).toBe(1);
  });
  it('rejects invalid role/section instead of bypassing version scope', async () => {
    const { service } = fixture();
    await expect(service.saveTaskDraft('S', 't', { role: 'X', payload: {} } as never)).rejects.toThrow('草稿角色或区域无效');
    await expect(service.saveTaskDraft('S', 't', { role: 'A', section: 'feedback', payload: {} } as never)).rejects.toThrow('草稿角色或区域无效');
  });
});
