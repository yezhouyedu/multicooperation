'use client';

import { ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';
import { Camera } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: string[];
};

type FollowUpTarget = {
  messageId: string;
  preview: string;
  fullText: string;
};

type Props = {
  sessionCode: string;
  participantId?: string;
  role: 'A' | 'B';
  accent: 'blue' | 'purple';
  contextType?: 'main' | 'side';
  companyId?: string;
  taskAssignmentId?: string;
  sideTaskPlanId?: string;
  phase?: 'practice' | 'formal';
  segmentIndex?: number;
  aiLevel?: 'BASIC' | 'ADVANCED';
  disabledReason?: string;
  onScreenshot?: () => void;
};

type StreamStartChunk = {
  type: 'start';
  requestId: string;
};

type StreamDeltaChunk = {
  type: 'delta';
  delta: string;
};

type StreamDoneChunk = {
  type: 'done';
  messageId: string;
  createdAt: string;
  reply: string;
  mode: 'mock' | 'provider';
};

type StreamErrorChunk = {
  type: 'error';
  message: string;
};

type StreamChunk = StreamStartChunk | StreamDeltaChunk | StreamDoneChunk | StreamErrorChunk;

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';
const streamingStatusLabels = ['正在理解材料', '正在组织答案', '正在生成结构'];

function buildPreview(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 80);
}

function ThinkingIndicator({ active }: { active: boolean }) {
  const [labelIndex, setLabelIndex] = useState(0);

  useEffect(() => {
    if (!active) {
      setLabelIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setLabelIndex((current) => (current + 1) % streamingStatusLabels.length);
    }, 1400);
    return () => window.clearInterval(timer);
  }, [active]);

  return (
    <div className="flex items-center gap-2 text-sm text-[#667085]">
      <div className="flex items-center gap-1">
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#60a5fa] [animation-delay:-0.2s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#60a5fa] [animation-delay:-0.1s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-[#60a5fa]" />
      </div>
      <span className="animate-pulse">{streamingStatusLabels[labelIndex]}</span>
    </div>
  );
}

function MarkdownMessage({ text, isUser }: { text: string; isUser: boolean }) {
  return (
    <div className={`max-w-none select-text break-words text-sm ${isUser ? 'text-white' : 'text-[#334155]'}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-2 text-base font-bold">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 text-[15px] font-bold">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1.5 text-sm font-bold">{children}</h3>,
          p: ({ children }) => <p className="mb-2 leading-7 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="leading-7">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noreferrer"
              className={
                isUser
                  ? 'underline decoration-white/50 underline-offset-2'
                  : 'text-[#1e80ff] underline underline-offset-2'
              }
            >
              {children}
            </a>
          ),
          code: ({ children, className }) =>
            className ? (
              <code className={className}>{children}</code>
            ) : (
              <code
                className={`rounded px-1.5 py-0.5 text-[12px] ${
                  isUser ? 'bg-white/16 text-white' : 'bg-[#f2f3f5] text-[#1d2129]'
                }`}
              >
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre
              className={`mb-2 overflow-x-auto rounded-2xl px-3 py-3 text-[12px] leading-6 ${
                isUser ? 'bg-white/12 text-white' : 'bg-[#0f172a] text-slate-100'
              }`}
            >
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className={`mb-2 border-l-4 pl-3 italic ${
                isUser ? 'border-white/40 text-white/90' : 'border-[#bfd4ff] text-[#4e5969]'
              }`}
            >
              {children}
            </blockquote>
          ),
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
}

function MessageActions({
  visible,
  onCopy,
  onRetry,
  onFollowUp,
}: {
  visible: boolean;
  onCopy?: () => void;
  onRetry?: () => void;
  onFollowUp?: () => void;
}) {
  if (!visible) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-2 text-xs">
      {onCopy ? (
        <button
          type="button"
          onClick={onCopy}
          className="rounded-full border border-[#d9dee7] bg-white px-3 py-1 text-[#4e5969] hover:bg-[#f7f8fa]"
        >
          复制
        </button>
      ) : null}
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="rounded-full border border-[#d9dee7] bg-white px-3 py-1 text-[#4e5969] hover:bg-[#f7f8fa]"
        >
          重新生成
        </button>
      ) : null}
      {onFollowUp ? (
        <button
          type="button"
          onClick={onFollowUp}
          className="rounded-full border border-[#d9dee7] bg-white px-3 py-1 text-[#4e5969] hover:bg-[#f7f8fa]"
        >
          继续追问
        </button>
      ) : null}
    </div>
  );
}

export function AiChatPanel({
  sessionCode,
  participantId = 'preview-participant',
  role,
  accent,
  contextType = 'main',
  companyId,
  taskAssignmentId,
  sideTaskPlanId,
  phase = 'formal',
  segmentIndex = 0,
  aiLevel = 'BASIC',
  disabledReason,
  onScreenshot,
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedMessage, setCopiedMessage] = useState<{ id: string; kind: 'selection' | 'message' } | null>(null);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [slowStreamingMessageId, setSlowStreamingMessageId] = useState<string | null>(null);
  const [lastSubmittedText, setLastSubmittedText] = useState('');
  const [lastSubmittedAttachments, setLastSubmittedAttachments] = useState<string[]>([]);
  const [followUpTarget, setFollowUpTarget] = useState<FollowUpTarget | null>(null);
  const messageListRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const imageEnabled = aiLevel === 'ADVANCED';
  const isDisabled = Boolean(disabledReason);
  const abortRef = useRef<AbortController | null>(null);

  const accentClass = useMemo(
    () =>
      accent === 'blue'
        ? {
            button: 'bg-[#1e80ff] hover:bg-[#1168e3]',
            bubble: 'bg-[linear-gradient(135deg,#3b82f6_0%,#1e6bff_100%)] border-[#1168e3]',
            softTag: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]',
          }
        : {
            button: 'bg-[linear-gradient(135deg,#8b5cf6_0%,#7c3aed_100%)] hover:brightness-110',
            bubble: 'bg-[linear-gradient(135deg,#8b5cf6_0%,#7c3aed_100%)] border-purple-600',
            softTag: 'border-[#ddd6fe] bg-[#f5f3ff] text-[#6d28d9]',
          },
    [accent],
  );

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [messages, sending, streamingMessageId]);

  useEffect(() => {
    if (!streamingMessageId) {
      setSlowStreamingMessageId(null);
      return;
    }
    setSlowStreamingMessageId(null);
    const timer = window.setTimeout(() => setSlowStreamingMessageId(streamingMessageId), 10000);
    return () => window.clearTimeout(timer);
  }, [streamingMessageId]);

  useEffect(() => {
    async function loadHistory() {
      setLoading(true);
      setError('');
      try {
        const params = new URLSearchParams({
          sessionCode,
          participantId,
          contextType,
          phase,
          segmentIndex: String(segmentIndex),
        });
        if (contextType === 'main' && companyId) {
          params.set('companyId', companyId);
        }
        const res = await fetch(`${serverBaseUrl}/ai/history?${params.toString()}`, { cache: 'no-store' });
        const data = (await res.json()) as { ok: boolean; messages: Message[] };
        setMessages(data.messages ?? []);
      } catch {
        setError('AI 历史记录加载失败');
      } finally {
        setLoading(false);
      }
    }

    void loadHistory();
  }, [sessionCode, participantId, contextType, companyId, phase, segmentIndex]);

  async function fileToDataUrl(file: File) {
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function handleFiles(files: FileList | File[] | null) {
    if (isDisabled || !imageEnabled || !files?.length) return;
    const picked = Array.from(files).slice(0, 3 - attachments.length);
    const results = await Promise.all(
      picked.map(async (file) => {
        const compressed = await imageCompression(file, {
          maxSizeMB: 0.2,
          maxWidthOrHeight: 1024,
          useWebWorker: true,
        });
        return fileToDataUrl(compressed);
      }),
    );
    setAttachments((prev) => [...prev, ...results].slice(0, 3));
  }

  async function readStreamChunks(response: Response, assistantMessageId: string) {
    if (!response.body) throw new Error('流式响应为空');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) continue;
        const chunk = JSON.parse(line) as StreamChunk;
        if (chunk.type === 'delta') {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId ? { ...message, text: `${message.text}${chunk.delta}` } : message,
            ),
          );
        } else if (chunk.type === 'done') {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId ? { ...message, id: chunk.messageId, text: chunk.reply } : message,
            ),
          );
          setStreamingMessageId(null);
          if (contextType === 'main') {
            window.dispatchEvent(new CustomEvent('timestamp-anchor', { detail: { anchorType: 'ai_response_end' } }));
          }
        } else if (chunk.type === 'error') {
          if (contextType === 'main') {
            window.dispatchEvent(new CustomEvent('timestamp-anchor', { detail: { anchorType: 'ai_response_end' } }));
          }
          throw new Error(chunk.message);
        }
      }
    }
  }

  async function submitMessage(nextText?: string, nextAttachments?: string[]) {
    if (isDisabled) return;
    const trimmed = (nextText ?? input).trim();
    const draftAttachments = nextAttachments ?? attachments;
    if (!trimmed && draftAttachments.length === 0) return;

    const activeFollowUp = followUpTarget;
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed || '（发送了图片）',
      attachments: draftAttachments,
    };
    const assistantMessageId = `assistant-stream-${Date.now()}`;

    setMessages((prev) => [...prev, userMessage, { id: assistantMessageId, role: 'assistant', text: '' }]);
    setInput('');
    setAttachments([]);
    setSending(true);
    setError('');
    setStreamingMessageId(assistantMessageId);
    setLastSubmittedText(trimmed);
    setLastSubmittedAttachments(draftAttachments);
    setFollowUpTarget(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`${serverBaseUrl}/ai/chat-stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          sessionCode,
          participantId,
          role,
          message: trimmed,
          attachments: draftAttachments,
          contextType,
          companyId,
          taskAssignmentId,
          sideTaskPlanId,
          phase,
          segmentIndex,
          aiLevel,
          followUpContext: activeFollowUp?.fullText,
        }),
      });

      await readStreamChunks(response, assistantMessageId);
      window.dispatchEvent(
        new CustomEvent('practice-tutorial-event', {
          detail: { type: contextType === 'side' ? 'sidetask_ai' : 'ai_message' },
        }),
      );
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : 'AI 请求失败';
      setError(`AI 生成失败，请稍后重试或点击重新生成。${message ? `（${message}）` : ''}`);
      setMessages((prev) =>
        prev.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                text: '## AI生成失败\n- 本次回复未成功生成\n- 可以点击“重新生成”或下方“重试”再试一次',
              }
            : item,
        ),
      );
      setStreamingMessageId(null);
    } finally {
      abortRef.current = null;
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (isDisabled) return;
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void submitMessage();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (isDisabled) return;
    if (!imageEnabled) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return;
    event.preventDefault();
    void handleFiles(imageFiles);
  }

  function getSelectedTextInMessage(messageId: string) {
    const selection = window.getSelection();
    const selectedText = selection?.toString().trim();
    if (!selection || !selectedText || selection.rangeCount === 0) return '';
    const container = document.querySelector(`[data-ai-message-id="${messageId}"]`);
    if (!container) return '';
    const range = selection.getRangeAt(0);
    return container.contains(range.commonAncestorContainer) || range.intersectsNode(container) ? selectedText : '';
  }

  async function copyMessage(text: string, messageId: string) {
    const selectedText = getSelectedTextInMessage(messageId);
    const copyText = selectedText || text;
    const kind = selectedText ? 'selection' : 'message';
    await navigator.clipboard.writeText(copyText);
    setCopiedMessage({ id: messageId, kind });
    window.setTimeout(
      () => setCopiedMessage((current) => (current?.id === messageId && current.kind === kind ? null : current)),
      1200,
    );
  }

  function startFollowUp(message: Message) {
    if (isDisabled) return;
    setFollowUpTarget({
      messageId: message.id,
      preview: buildPreview(message.text),
      fullText: message.text,
    });
    inputRef.current?.focus();
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div
        ref={messageListRef}
        className="no-scrollbar flex-1 overflow-y-auto bg-[radial-gradient(circle_at_top,_rgba(30,128,255,0.08),_transparent_34%),linear-gradient(180deg,#f8fafc_0%,#f2f4f7_100%)] p-5"
      >
        {loading ? <div className="text-sm text-[#86909c]">AI 历史记录加载中...</div> : null}
        <div className="flex flex-col gap-6">
          {!loading && messages.length === 0 ? (
            <div className="rounded-3xl border border-[#e5e6eb] bg-white/96 p-4 text-sm leading-7 text-[#4e5969] shadow-sm backdrop-blur-sm">
              {role === 'A'
                ? '你可以让 AI 帮你提炼机会点、风险点和交接提示。'
                : '你可以让 AI 帮你梳理投资机会、风险、证据来源和最终建议。'}
            </div>
          ) : null}

          {messages.map((message, index) => {
            const previousUser = message.role === 'assistant' ? messages[index - 1] : null;
            const isStreaming = streamingMessageId === message.id;
            const showSlowNotice = slowStreamingMessageId === message.id;
            const showThinking = isStreaming && !message.text;
            return (
              <div
                key={message.id}
                className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs shadow-sm ${
                    message.role === 'user'
                      ? 'border border-gray-300 bg-white text-gray-500'
                      : 'bg-gradient-to-br from-cyan-500 to-blue-600 text-white'
                  }`}
                >
                  {message.role === 'user' ? '我' : 'AI'}
                </div>
                <div
                  data-ai-message-id={message.id}
                  className={`max-w-[85%] rounded-3xl p-4 text-sm leading-relaxed shadow-sm ${
                    message.role === 'user'
                      ? `${accentClass.bubble} rounded-tr-md border text-white`
                      : 'select-text rounded-tl-md border border-[#e5e6eb] bg-white/96 text-gray-700 backdrop-blur-sm'
                  }`}
                >
                  {message.attachments?.length ? (
                    <div className="mb-3">
                      <div
                        className={`mb-2 text-xs font-semibold ${
                          message.role === 'user' ? 'text-white/85' : 'text-[#86909c]'
                        }`}
                      >
                        本轮参考图片
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {message.attachments.map((item, imageIndex) => (
                          <img
                            key={`${message.id}-${imageIndex}`}
                            src={item}
                            alt={`attachment-${imageIndex}`}
                            className="h-24 w-24 rounded-2xl border border-white/20 object-cover"
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {showThinking ? <ThinkingIndicator active /> : null}
                  {message.text ? <MarkdownMessage text={message.text} isUser={message.role === 'user'} /> : null}
                  {showSlowNotice ? (
                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-700">
                      AI 正在生成，可能需要较长时间，请先继续阅读材料或填写任务表。
                    </div>
                  ) : null}

                  {message.role === 'assistant' ? (
                    <MessageActions
                      visible={!isStreaming}
                      onCopy={message.text ? () => void copyMessage(message.text, message.id) : undefined}
                      onRetry={
                        previousUser && !isDisabled ? () => void submitMessage(previousUser.text, previousUser.attachments) : undefined
                      }
                      onFollowUp={message.text && !isDisabled ? () => startFollowUp(message) : undefined}
                    />
                  ) : null}

                  {copiedMessage?.id === message.id ? (
                    <div className="mt-2 text-xs text-[#1e80ff]">
                      {copiedMessage.kind === 'selection' ? '已复制选中内容' : '已复制本条回复'}
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative border-t border-[#e5e6eb] bg-white p-3">
        {error ? (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-500">
            {error}
            {lastSubmittedText || lastSubmittedAttachments.length > 0 ? (
              <button
                type="button"
                onClick={() => void submitMessage(lastSubmittedText, lastSubmittedAttachments)}
                className="ml-3 rounded-full border border-red-200 bg-white px-3 py-1 text-red-500"
              >
                重试
              </button>
            ) : null}
          </div>
        ) : null}

        {disabledReason ? (
          <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-[#4e5969]">
            {disabledReason}
          </div>
        ) : null}

        {followUpTarget ? (
          <div className={`mb-2 flex items-center justify-between gap-3 rounded-2xl border px-3 py-2 text-xs ${accentClass.softTag}`}>
            <div className="min-w-0">
              <div className="font-semibold">正在追问上一条回答</div>
              <div className="truncate opacity-80">{followUpTarget.preview}</div>
            </div>
            <button
              type="button"
              onClick={() => setFollowUpTarget(null)}
              className="shrink-0 rounded-full border border-current/20 px-2 py-0.5 text-[11px]"
            >
              取消
            </button>
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="mb-2">
            <div className="mb-2 text-xs font-semibold text-[#86909c]">待发送图片</div>
            <div className="flex flex-wrap gap-2">
              {attachments.map((src, index) => (
                <div key={`att-${index}`} className="group relative h-20 w-20 shrink-0">
                  <img
                    src={src}
                    alt={`附件 ${index + 1}`}
                    className="h-full w-full rounded-2xl border border-gray-200 object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition group-hover:opacity-100"
                    title="移除"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          {imageEnabled && onScreenshot ? (
            <button
              type="button"
              onClick={isDisabled ? undefined : onScreenshot}
              disabled={isDisabled}
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 transition hover:bg-purple-50 hover:text-purple-500 disabled:cursor-not-allowed disabled:opacity-45"
              title="点击使用截图功能"
            >
              <Camera size={18} />
            </button>
          ) : imageEnabled ? (
            <label
              className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 transition hover:bg-purple-50 hover:text-purple-500"
              title="上传图片"
            >
              <Camera size={18} />
              <input
                type="file"
                accept="image/*"
                multiple
                disabled={isDisabled}
                className="hidden"
                onChange={(event) => void handleFiles(event.target.files)}
              />
            </label>
          ) : (
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400"
              title="基础 AI 不支持图片"
            >
              <Camera size={18} className="opacity-40" />
            </div>
          )}
          <div className="flex flex-1 items-center rounded-2xl border border-gray-200 bg-gray-50 p-1.5 transition-all focus-within:border-purple-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-100">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              disabled={isDisabled}
              data-tutorial-anchor="ai-input"
              placeholder={
                disabledReason
                  ? ''
                  : followUpTarget
                  ? '继续写你的追问，发送时不会复制整段原回答...'
                  : imageEnabled
                    ? '输入问题，或上传/粘贴图片让 AI 辅助分析...'
                    : '输入问题，让 AI 帮你整理判断...'
              }
              className="no-scrollbar h-9 w-full resize-none bg-transparent p-2 text-sm leading-6 outline-none disabled:cursor-not-allowed disabled:text-[#86909c]"
            />
          </div>
          {sending ? (
            <button
              type="button"
              onClick={() => abortRef.current?.abort()}
              className="flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-500 shadow-sm"
            >
              停止
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void submitMessage()}
            disabled={sending || isDisabled}
            className={`flex h-10 min-w-10 shrink-0 items-center justify-center rounded-full px-3 text-sm font-semibold text-white shadow-sm disabled:opacity-50 ${accentClass.button}`}
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
