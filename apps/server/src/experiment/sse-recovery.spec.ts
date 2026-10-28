import { ExperimentService } from './experiment.service';

describe('SSE instance-aware replay', () => {
  it('replays only same-process events and never mistakes an old instance ID', () => {
    const service = new ExperimentService({} as never, {} as never) as any;
    service.emitSessionEvent('s', { type: 'feedback', data: {} });
    const first = service.sessionEventCache.get('s')[0].id;
    service.emitSessionEvent('s', { type: 'feedback', data: {} });
    expect(service.getReplayEvents('s', first)).toHaveLength(1);
    expect(service.getReplayEvents('s', 'old-instance:999')).toEqual([]);
    expect(service.getReplayEvents('s', '999')).toEqual([]);
  });
});
