import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { AiService } from './ai.service';

type ChatBody = {
  sessionCode: string;
  participantId?: string;
  role?: string;
  message?: string;
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
}
