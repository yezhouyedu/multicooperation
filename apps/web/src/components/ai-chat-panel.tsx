'use client';

import { ClipboardEvent, KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import imageCompression from 'browser-image-compression';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  attachments?: string[];
};

type Props = {
  sessionCode: string;
  participantId?: string;
  role: 'A' | 'B';
  accent: 'blue' | 'purple';
  contextType?: 'main' | 'side';
  companyId?: string;
  phase?: 'practice' | 'formal';
  segmentIndex?: number;
  aiLevel?: 'BASIC' | 'ADVANCED';
};

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export function AiChatPanel({
  sessionCode,
  participantId = 'preview-participant',
  role,
  accent,
  contextType = 'main',
  companyId,
  phase = 'formal',
  segmentIndex = 0,
  aiLevel = 'BASIC',
}: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState<string[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const messageListRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const imageEnabled = aiLevel === 'ADVANCED';

  const accentClass = useMemo(
    () =>
      accent === 'blue'
        ? { button: 'bg-[#1e80ff] hover:bg-[#1168e3]', bubble: 'bg-[#1e80ff] border-[#1168e3]' }
        : { button: 'bg-purple-500 hover:bg-purple-600', bubble: 'bg-purple-500 border-purple-600' },
    [accent],
  );

  useEffect(() => {
    const messageList = messageListRef.current;
    if (!messageList) return;
    messageList.scrollTop = messageList.scrollHeight;
  }, [messages, sending]);

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
    if (!imageEnabled || !files?.length) return;
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

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed && attachments.length === 0) return;

    const draftAttachments = attachments;
    const optimisticMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: trimmed || '（发送了图片）',
      attachments: draftAttachments,
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setInput('');
    setAttachments([]);
    setSending(true);
    setError('');

    try {
      const response = await fetch(`${serverBaseUrl}/ai/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionCode,
          participantId,
          role,
          message: trimmed,
          attachments: draftAttachments,
          contextType,
          companyId,
          phase,
          segmentIndex,
          aiLevel,
        }),
      });

      const raw = await response.text();
      let data: { ok?: boolean; reply?: string; error?: string; messageId?: string } | null = null;
      try {
        data = raw ? JSON.parse(raw) : null;
      } catch {
        data = null;
      }

      if (!response.ok || !data?.ok) {
        throw new Error(data?.error || raw || 'AI 请求失败');
      }

      setMessages((prev) => [
        ...prev,
        {
          id: data.messageId ?? `assistant-${Date.now()}`,
          role: 'assistant',
          text: data.reply ?? '暂无返回内容。',
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI 请求失败');
    } finally {
      setSending(false);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  }

  function onPaste(event: ClipboardEvent<HTMLTextAreaElement>) {
    if (!imageEnabled) return;
    const items = event.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return;
    event.preventDefault();
    void handleFiles(imageFiles);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div ref={messageListRef} className="no-scrollbar flex-1 overflow-y-auto bg-gray-50/50 p-5">
        {loading ? <div className="text-sm text-[#86909c]">AI 历史记录加载中...</div> : null}
        <div className="flex flex-col gap-6">
          {!loading && messages.length === 0 ? (
            <div className="rounded-2xl border border-[#e5e6eb] bg-white p-4 text-sm leading-7 text-[#4e5969] shadow-sm">
              {role === 'A'
                ? '你可以让 AI 帮你提炼机会点、风险点和交接提示。'
                : '你可以让 AI 帮你梳理投资机会、风险、证据来源和最终建议。'}
            </div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className={`flex items-start gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs shadow-sm ${message.role === 'user' ? 'border border-gray-300 bg-gray-200 text-gray-500' : 'bg-gradient-to-br from-purple-400 to-blue-500 text-white'}`}>
                {message.role === 'user' ? '我' : 'AI'}
              </div>
              <div className={`max-w-[85%] rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm ${message.role === 'user' ? `${accentClass.bubble} rounded-tr-none border text-white` : 'rounded-tl-none border border-[#e5e6eb] bg-white text-gray-700'}`}>
                <div>{message.text}</div>
                {message.attachments?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {message.attachments.map((item, index) => (
                      <img key={`${message.id}-${index}`} src={item} alt={`attachment-${index}`} className="h-16 w-16 rounded-xl object-cover" />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          ))}

          {sending ? (
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-purple-400 to-blue-500 text-xs text-white shadow-sm">AI</div>
              <div className="flex max-w-[85%] items-center gap-3 rounded-2xl rounded-tl-none border border-[#e5e6eb] bg-white p-3.5 text-sm text-gray-500 shadow-sm">
                <span>...</span>
                <span>正在整理回复...</span>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="relative border-t border-[#e5e6eb] bg-white p-3">
        {error ? <div className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-500">{error}</div> : null}

        {attachments.length > 0 ? (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((src, index) => (
              <div key={`att-${index}`} className="group relative h-16 w-16 shrink-0">
                <img src={src} alt={`附件 ${index + 1}`} className="h-full w-full rounded-lg object-cover border border-gray-200" />
                <button
                  type="button"
                  onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white opacity-0 transition group-hover:opacity-100"
                  title="移除"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <div className="flex items-end gap-2">
          {imageEnabled ? (
            <label className="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-gray-400 transition hover:bg-purple-50 hover:text-purple-500" title="上传图片">
              图
              <input type="file" accept="image/*" multiple className="hidden" onChange={(event) => void handleFiles(event.target.files)} />
            </label>
          ) : (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gray-100 text-xs text-gray-400" title="基础 AI 不支持图片">
              图
            </div>
          )}
          <div className="flex flex-1 items-center rounded-xl border border-gray-200 bg-gray-50 p-1 transition-all focus-within:border-purple-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-purple-100">
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onKeyDown}
              onPaste={onPaste}
              placeholder={imageEnabled ? '输入问题，或上传/粘贴图片让 AI 辅助分析...' : '输入问题，让 AI 帮你整理判断...'}
              className="no-scrollbar h-9 w-full resize-none bg-transparent p-2 text-sm leading-5 outline-none"
            />
          </div>
          <button type="button" onClick={() => void handleSend()} disabled={sending} className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm disabled:opacity-50 ${accentClass.button}`}>
            发
          </button>
        </div>
      </div>
    </div>
  );
}


