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
