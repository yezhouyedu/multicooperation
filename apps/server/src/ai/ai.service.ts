import { BadRequestException, Injectable } from '@nestjs/common';
import { AiLevel, ExperimentPhase, ParticipantRole } from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

type ChatInput = {
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

@Injectable()
export class AiService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async getHistory(input: {
    sessionCode: string;
    participantId?: string;
    contextType: 'main' | 'side';
    companyId?: string;
    phase?: 'practice' | 'formal';
    segmentIndex?: number;
  }) {
    const session = await this.prisma.session.findUnique({ where: { code: input.sessionCode } });
    if (!session) return { ok: true, messages: [] };

    const phase = input.phase === 'practice' ? ExperimentPhase.PRACTICE : ExperimentPhase.FORMAL;
    const messages = await this.prisma.aiMessageLog.findMany({
      where: {
        sessionId: session.id,
        participantId: input.participantId,
        contextType: input.contextType,
        companyId: input.contextType === 'main' ? input.companyId ?? null : undefined,
        phase,
        segmentIndex: input.contextType === 'side' ? input.segmentIndex ?? null : undefined,
      },
      orderBy: { createdAt: 'asc' },
    });

    return {
      ok: true,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.messageRole,
        text: message.content,
        attachments: Array.isArray(message.attachments) ? message.attachments : [],
      })),
    };
  }

  private extractReply(data: any): string {
    const openaiReply = data?.choices?.[0]?.message?.content;
    if (typeof openaiReply === 'string' && openaiReply.trim()) return openaiReply.trim();
    if (Array.isArray(openaiReply)) {
      const joined = openaiReply.map((item: any) => item?.text || item?.content || '').join('\n').trim();
      if (joined) return joined;
    }

    const geminiCandidates = data?.candidates?.[0]?.content?.parts;
    if (Array.isArray(geminiCandidates)) {
      const joined = geminiCandidates.map((part: any) => part?.text || '').join('\n').trim();
      if (joined) return joined;
    }

    const geminiText = data?.candidates?.[0]?.output || data?.text || data?.output_text;
    if (typeof geminiText === 'string' && geminiText.trim()) return geminiText.trim();

    return '';
  }

  private buildEndpoint(baseUrl: string) {
    const normalized = baseUrl.replace(/\/$/, '');
    if (normalized.endsWith('/chat/completions')) return normalized;
    if (normalized.endsWith('/v1')) return `${normalized}/chat/completions`;
    return `${normalized}/v1/chat/completions`;
  }

  async chat(input: ChatInput) {
    const session = await this.prisma.session.findUnique({ where: { code: input.sessionCode } });
    if (!session) {
      throw new BadRequestException('Session 不存在');
    }

    const participantId = input.participantId ?? null;
    const contextType = input.contextType ?? 'main';
    const attachments = input.attachments ?? [];
    const requestedLevel = `${input.aiLevel ?? 'BASIC'}`.toUpperCase() === 'ADVANCED' ? AiLevel.ADVANCED : AiLevel.BASIC;
    if (requestedLevel === AiLevel.BASIC && attachments.length > 0) {
      throw new BadRequestException('基础 AI 模式不支持图片上传');
    }

    const phase = input.phase === 'practice' ? ExperimentPhase.PRACTICE : ExperimentPhase.FORMAL;
    const segmentIndex = input.segmentIndex ?? 0;
    const requestId = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const isAdv = requestedLevel === AiLevel.ADVANCED;
    const settings = await this.prisma.aiSettings.findUnique({ where: { id: 'default' } });
    const baseUrl = isAdv
      ? (settings?.advancedBaseUrl || this.configService.get<string>('OPENAI_BASE_URL'))
      : (settings?.basicBaseUrl || this.configService.get<string>('OPENAI_BASE_URL'));
    const apiKey = isAdv
      ? (settings?.advancedApiKey || this.configService.get<string>('OPENAI_API_KEY'))
      : (settings?.basicApiKey || this.configService.get<string>('OPENAI_API_KEY'));
    const model = isAdv
      ? (settings?.advancedModel || this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini')
      : (settings?.basicModel || this.configService.get<string>('OPENAI_MODEL') || 'gpt-4o-mini');
    const contextLimit = isAdv
      ? (settings?.advancedContextLimit ?? 20)
      : (settings?.basicContextLimit ?? 20);
    const trimmed = input.message?.trim() || '';

    await this.prisma.aiMessageLog.create({
      data: {
        sessionId: session.id,
        participantId,
        companyId: contextType === 'main' ? input.companyId ?? null : null,
        contextType,
        phase,
        segmentIndex: contextType === 'side' ? segmentIndex : null,
        aiLevel: requestedLevel,
        messageRole: 'user',
        requestId,
        content: trimmed || '（发送了图片）',
        attachments,
      },
    });

    if (!baseUrl || !apiKey) {
      const reply = '当前未检测到模型配置，仍处于 mock 模式。';
      await this.prisma.aiMessageLog.create({
        data: {
          sessionId: session.id,
          participantId,
          companyId: contextType === 'main' ? input.companyId ?? null : null,
          contextType,
          phase,
          segmentIndex: contextType === 'side' ? segmentIndex : null,
          aiLevel: requestedLevel,
          messageRole: 'assistant',
          requestId,
          content: reply,
        },
      });
      return {
        ok: true,
        mode: 'mock',
        messageId: requestId,
        createdAt: new Date().toISOString(),
        reply,
      };
    }

    const endpoint = this.buildEndpoint(baseUrl);
    const systemPrompt = input.role === ParticipantRole.B || input.role === 'B'
      ? '你是投资判断助手。请帮助用户拆分机会点、风险点、证据来源和最终建议，输出简洁、结构化、直白。'
      : '你是尽调助手。请帮助用户提炼机会、风险、需要继续追问的问题，输出简洁、结构化、直白。';

    const history = await this.prisma.aiMessageLog.findMany({
      where: {
        sessionId: session.id,
        participantId,
        contextType,
        companyId: contextType === 'main' ? input.companyId ?? null : null,
        phase,
        segmentIndex: contextType === 'side' ? segmentIndex : null,
      },
      orderBy: { createdAt: 'asc' },
      take: contextLimit,
    });

    const historyMessages = history.map((message) => ({
      role: message.messageRole === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }));

    const userMessage = attachments.length > 0
      ? {
          role: 'user',
          content: [
            ...(trimmed ? [{ type: 'text', text: trimmed }] : []),
            ...attachments.map((item) => ({ type: 'image_url', image_url: { url: item } })),
          ],
        }
      : { role: 'user', content: trimmed || '请给我一个简短判断。' };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: systemPrompt }, ...historyMessages, userMessage],
        temperature: 0.7,
      }),
    });

    const raw = await response.text();
    let data: any = null;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      if (!response.ok) {
        throw new BadRequestException(raw || '上游模型接口返回了非 JSON 错误');
      }
    }

    if (!response.ok) {
      throw new BadRequestException(data?.error?.message || data?.message || raw || '上游模型接口调用失败');
    }

    const reply = this.extractReply(data) || `模型没有返回可显示内容。当前请求已打到：${endpoint}`;
    await this.prisma.aiMessageLog.create({
      data: {
        sessionId: session.id,
        participantId,
        companyId: contextType === 'main' ? input.companyId ?? null : null,
        contextType,
        phase,
        segmentIndex: contextType === 'side' ? segmentIndex : null,
        aiLevel: requestedLevel,
        messageRole: 'assistant',
        requestId,
        content: reply,
      },
    });

    return {
      ok: true,
      mode: 'provider',
      providerConfigured: true,
      messageId: data?.id ?? requestId,
      createdAt: data?.created ? new Date(data.created * 1000).toISOString() : new Date().toISOString(),
      reply,
    };
  }
}
