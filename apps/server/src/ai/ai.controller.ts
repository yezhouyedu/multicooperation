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
  taskAssignmentId?: string;
  sideTaskPlanId?: string;
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

  @Get('attachment')
  async attachment(@Query('sessionCode') sessionCode: string, @Query('participantId') participantId: string, @Query('imageRef') imageRef: string, @Res() res: Response) {
    const attachment = await this.aiService.getAttachment(sessionCode, participantId, imageRef);
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.send(attachment.bytes);
  }

  @Post('chat')
  async chat(@Body() body: ChatBody, @Res({ passthrough: true }) res: Response) {
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try { return await this.aiService.chat(body, controller.signal); }
    finally { res.off('close', cancel); }
  }

  @Post('chat-stream')
  async chatStream(@Body() body: ChatBody, @Res() res: Response) {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);

    try {
      await this.aiService.chatStream(body, {
        onStart: (payload) => {
          if (!res.destroyed) res.write(`${JSON.stringify({ type: 'start', ...payload })}\n`);
        },
        onDelta: (delta) => {
          if (!res.destroyed) res.write(`${JSON.stringify({ type: 'delta', delta })}\n`);
        },
        onDone: (payload) => {
          if (!res.destroyed) res.write(`${JSON.stringify({ type: 'done', ...payload })}\n`);
        },
      }, controller.signal);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'AI 流式请求失败';
      if (!res.destroyed) res.write(`${JSON.stringify({ type: 'error', message })}\n`);
    } finally {
      res.off('close', cancel);
      if (!res.destroyed) res.end();
    }
  }
}
