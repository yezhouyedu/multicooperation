'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type FeedbackPayload = {
  companyName: string;
  companyNo: number;
  helpfulness: string;
  missingContent: string;
  improvement: string;
  appreciative: boolean;
};

type Props = {
  sessionCode: string;
  participantId?: string;
  durationSec?: number;
};

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export function AFeedbackNotification({ sessionCode, participantId, durationSec = 10 }: Props) {
  const [visible, setVisible] = useState(false);
  const [payload, setPayload] = useState<FeedbackPayload | null>(null);
  const seenIds = useRef<Set<string>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((p: FeedbackPayload) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setPayload(p);
    setVisible(true);
    timerRef.current = setTimeout(() => setVisible(false), Math.max(1, durationSec) * 1000);
  }, [durationSec]);

  useEffect(() => {
    if (!sessionCode) return;

    const consume = (detail: { type: string; data: unknown }) => {
      if (detail.type !== 'b_feedback_to_a') return;
      const data = detail.data && typeof detail.data === 'object' ? (detail.data as { id?: string; payload?: FeedbackPayload }) : {};
      const nextPayload = data.payload;
      if (!nextPayload) return;
      const key = data.id ?? JSON.stringify(nextPayload);
      if (seenIds.current.has(key)) return;
      seenIds.current.add(key);
      show(nextPayload);
    };

    const customHandler = (event: Event) => {
      const nextEvent = event as CustomEvent<{ type: string; data: unknown }>;
      consume(nextEvent.detail);
    };
    window.addEventListener('session-stream-event', customHandler);

    const streamUrl = `${serverBaseUrl}/experiment/session/${sessionCode}/events${participantId ? `?participantId=${participantId}` : ''}`;
    const source = new EventSource(streamUrl);
    source.addEventListener('b_feedback_to_a', (event) => {
      const message = event as MessageEvent<string>;
      try {
        consume({ type: 'b_feedback_to_a', data: JSON.parse(message.data) });
      } catch {}
    });

    return () => {
      window.removeEventListener('session-stream-event', customHandler);
      source.close();
    };
  }, [participantId, sessionCode, show]);

  if (!visible || !payload) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[100] w-64 rounded-xl border border-blue-200 bg-white shadow-2xl">
      <div className="flex items-center justify-between border-b border-[#e5e6eb] px-3 py-2">
        <span className="text-xs font-bold text-[#1e80ff]">投资经理反馈</span>
        <button type="button" onClick={() => setVisible(false)} className="text-sm leading-none text-gray-400 hover:text-gray-600">关闭</button>
      </div>
      <div className="space-y-2 px-3 py-3">
        <div className="text-xs font-semibold text-gray-700">
          {payload.companyName} / No.{payload.companyNo}
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">帮助程度</span>
          <span className="rounded bg-blue-50 px-2 py-0.5 font-medium text-blue-700">{payload.helpfulness}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">主要缺失</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600">{payload.missingContent}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-400">改进建议</span>
          <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-600">{payload.improvement}</span>
        </div>
        {payload.appreciative ? (
          <div className="mt-1 text-center text-xs text-amber-500">对方表达了感谢或认可</div>
        ) : null}
      </div>
    </div>
  );
}
