import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { AiService } from './ai.service';

type ChatBody = {
  sessionCode: string;
  participantId?: string;
  role?: string;
  message?: string;
  followUpContext?: string;
  attachments?: string[];
  contextType?: 'main' | 'side';
  companyId?: string;
  phase?: 'practice' | 'formal';
  segmentIndex?: number;
  aiLevel?: 'BASIC' | 'ADVANCED' | 'basic' | 'advanced';
};

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Get('history')
  history(
    @Query('sessionCode') sessionCode: string,
    @Query('participantId') participantId?: string,
    @Query('contextType') contextType: 'main' | 'side' = 'main',
    @Query('companyId') companyId?: string,
    @Query('phase') phase?: 'practice' | 'formal',
    @Query('segmentIndex') segmentIndex?: string,
  ) {
    return this.aiService.getHistory({
      sessionCode,
      participantId,
      contextType,
      companyId,
      phase,
      segmentIndex: segmentIndex ? Number(segmentIndex) : undefined,
    });
  }

  @Post('chat')
  chat(@Body() body: ChatBody) {
    return this.aiService.chat(body);
  }

  @Post('chat-stream')
  async chatStream(@Body() body: ChatBody, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');

    try {
      await this.aiService.chatStream(body, {
        onStart: (payload) => {
          res.write(`${JSON.stringify({ type: 'start', ...payload })}\n`);
        },
        onDelta: (delta) => {
          res.write(`${JSON.stringify({ type: 'delta', delta })}\n`);
        },
        onDone: (payload) => {
          res.write(`${JSON.stringify({ type: 'done', ...payload })}\n`);
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 流式请求失败';
      res.write(`${JSON.stringify({ type: 'error', message })}\n`);
    } finally {
      res.end();
    }
  }
}
