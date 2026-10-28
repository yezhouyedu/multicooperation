import { ExportService } from './export.service';

describe('platform interruption export', () => {
  it('flags the team for manual review even with no personal violation', () => {
    const service = new ExportService({} as never, {} as never) as any;
    const session = { integrityStates: [], experimentEvents: [{ eventType: 'platform_service_interruption' }] };
    expect(service.buildSessionIntegrityFlags(session)).toMatchObject({ hasPlatformInterruption: true, requiresPlatformReview: true, sessionDataUsable: false });
  });
  it('keeps team incident evidence in both personal integrity exports', () => {
    const service = new ExportService({} as never, {} as never) as any;
    const session = { code: 's', integrityStates: [], experimentSnapshot: {}, experimentEvents: [{ id: 'event', participantId: null, eventType: 'platform_service_interruption', serverTime: new Date(), clientTime: null }] };
    for (const id of ['a', 'b']) expect(service.buildOnlineIntegrity(session, id).events[0].eventType).toBe('platform_service_interruption');
  });
});
