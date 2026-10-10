import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AiService } from './ai.service';

describe('AiService practice policy', () => {
  it('rejects practice AI calls even when the session has an AI-enabled condition', async () => {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-id',
          code: 'SESSION1',
          currentPhase: 'FORMAL',
          experimentSnapshot: { aiEnabled: true, aiCondition: 'ADVANCED' },
        }),
      },
    };
    const service = new AiService(
      new ConfigService(),
      prisma as never,
      {} as never,
      {} as never,
    );
    const privateService = service as unknown as {
      resolveChatContext(input: { sessionCode: string; phase: 'practice' }): Promise<unknown>;
    };

    await expect(privateService.resolveChatContext({ sessionCode: 'SESSION1', phase: 'practice' }))
      .rejects
      .toEqual(new BadRequestException('测试轮仅用于熟悉任务流程，不能调用 AI'));
  });

  it('rejects a request labelled formal while the session is still in practice', async () => {
    const prisma = {
      session: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'session-id',
          code: 'SESSION1',
          currentPhase: 'PRACTICE',
          experimentSnapshot: { aiEnabled: true, aiCondition: 'ADVANCED' },
        }),
      },
    };
    const service = new AiService(new ConfigService(), prisma as never, {} as never, {} as never);
    const privateService = service as unknown as {
      resolveChatContext(input: { sessionCode: string; phase: 'formal'; segmentIndex: number }): Promise<unknown>;
    };

    await expect(privateService.resolveChatContext({ sessionCode: 'SESSION1', phase: 'formal', segmentIndex: 1 }))
      .rejects
      .toEqual(new BadRequestException('测试轮仅用于熟悉任务流程，不能调用 AI'));
  });
});

describe('AI request history', () => {
  function setup(history: unknown[]) {
    const prisma = {
      session: { findUnique: jest.fn().mockResolvedValue({ id: 's1', code: 'TEST', currentPhase: 'FORMAL', experimentSnapshot: { aiEnabled: true } }) },
      pairing: { findFirst: jest.fn().mockResolvedValue({ participantAId: 'p1', participantBId: 'p2' }) },
      participantIntegrityState: { findMany: jest.fn().mockResolvedValue([]) },
      aiSettings: { findUnique: jest.fn().mockResolvedValue({ basicContextLimit: 2, advancedContextLimit: 2 }) },
      aiMessageLog: { findMany: jest.fn().mockResolvedValue(history) },
    };
    const storage = { readSavedImage: jest.fn().mockResolvedValue('data:image/png;base64,aGVsbG8=') };
    const service = new AiService(new ConfigService(), prisma as never, {} as never, storage as never);
    jest.spyOn(service as any, 'buildSystemPrompt').mockResolvedValue('system');
    return { prisma, storage, service };
  }
  const request = { sessionCode: 'TEST', participantId: 'p1', companyId: 'c1', phase: 'formal', segmentIndex: 3, message: 'follow up' };
  it('loads the latest company messages across work segments in chronological order', async () => {
    const { service, prisma } = setup([
      { messageRole: 'assistant', content: 'newest', attachments: [] },
      { messageRole: 'user', content: 'previous', attachments: [] },
    ]);
    const result = await (service as any).resolveChatContext(request);
    expect(prisma.aiMessageLog.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ participantId: 'p1', companyId: 'c1', segmentIndex: undefined }),
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], take: 2,
    }));
    expect(result.historyMessages.map((message: any) => message.content)).toEqual(['previous', 'newest']);
  });
  it('keeps task 2 isolated by segment', async () => {
    const { service, prisma } = setup([]);
    await (service as any).resolveChatContext({ ...request, contextType: 'side' });
    expect(prisma.aiMessageLog.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ contextType: 'side', companyId: null, segmentIndex: 3 }) }));
  });
  it('returns a scoped image URL for refreshed chat history, not a raw storage object', async () => {
    const { service } = setup([{ id: 'm1', participantId: 'p1', messageRole: 'user', content: 'picture', attachments: [{ imageRef: 'picture1', relativePath: 'saved.png' }] }]);
    const result = await service.getHistory({ sessionCode: 'TEST', participantId: 'p1', contextType: 'main', companyId: 'c1' });
    expect(result.messages[0].attachments).toEqual(['/ai/attachment?sessionCode=TEST&participantId=p1&imageRef=picture1']);
  });
  it('rejects an attachment belonging to another participant', async () => {
    const { service, storage } = setup([]);
    await expect(service.getAttachment('TEST', 'outsider', 'picture1')).rejects.toThrow('Participant 不属于当前 Session');
    expect(storage.readSavedImage).not.toHaveBeenCalled();
  });
  it('restores already-sent saved images for advanced follow-up, never for basic', async () => {
    const attachment = { relativePath: 'saved.png', mimeType: 'image/png' };
    const { service, storage } = setup([{ messageRole: 'user', content: 'read picture', attachments: [attachment] }]);
    const result = await (service as any).resolveChatContext({ ...request, aiLevel: 'ADVANCED' });
    expect(storage.readSavedImage).toHaveBeenCalledWith(attachment, 'TEST', 'p1');
    expect(result.historyMessages[0].content).toEqual([{ type: 'text', text: 'read picture' }, { type: 'image_url', image_url: { url: 'data:image/png;base64,aGVsbG8=' } }]);
    storage.readSavedImage.mockClear();
    await (service as any).resolveChatContext(request);
    expect(storage.readSavedImage).not.toHaveBeenCalled();
  });
});
