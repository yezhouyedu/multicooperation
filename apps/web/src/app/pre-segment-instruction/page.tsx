'use client';

import { useSessionRuntime } from '@/lib/session-runtime';
import { idempotencyHeaders } from '@/lib/idempotency';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

function formatSeconds(seconds: number) {
  const safe = Math.max(0, Math.ceil(seconds));
  return `${safe} 秒`;
}

function workSegmentLabel(segment?: number | null) {
  if (segment === 1) return '即将进入第一个工作段';
  if (segment === 2) return '即将进入第二个工作段';
  if (segment === 3) return '即将进入第三个工作段';
  return '即将进入工作段';
}

export default function PreSegmentInstructionPage() {
  const router = useRouter();
  const { bootstrap, runtime, loading, refresh } = useSessionRuntime();
  const [remaining, setRemaining] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const openedRef = useRef<string | null>(null);
  const instruction = runtime?.preSegmentInstruction ?? null;

  useEffect(() => {
    if (!bootstrap && !loading) {
      router.replace('/login');
      return;
    }
    if (!runtime) return;
    if (runtime.phase === 'formal_work') {
      router.replace(runtime.assignedRole === 'B' ? '/workspace/b' : '/workspace/a');
      return;
    }
    if (runtime.phase === 'formal_break') {
      router.replace('/break');
      return;
    }
    if (runtime.phase === 'formal_ready') {
      router.replace('/ready?target=formal');
      return;
    }
    if (runtime.phase === 'end') {
      router.replace('/workspace/end');
      return;
    }
    if (runtime.phase !== 'pre_segment_instruction') {
      router.replace('/instruction');
    }
  }, [bootstrap, loading, router, runtime]);

  useEffect(() => {
    if (!bootstrap || runtime?.phase !== 'pre_segment_instruction' || !instruction || instruction.selfCompleted) return;
    const key = `${bootstrap.sessionCode}:${bootstrap.participantId}:${instruction.workSegment}`;
    if (openedRef.current === key || instruction.openedAt) return;
    openedRef.current = key;
    fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/pre-segment-instruction/open`, {
      method: 'POST',
      headers: idempotencyHeaders(`pre-segment-open:${key}`, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ participantId: bootstrap.participantId }),
    })
      .then(() => refresh())
      .catch(() => {
        openedRef.current = null;
      });
  }, [bootstrap, instruction, refresh, runtime?.phase]);

  useEffect(() => {
    setRemaining(instruction?.remainingSeconds ?? instruction?.durationSeconds ?? 15);
  }, [instruction?.durationSeconds, instruction?.remainingSeconds, instruction?.workSegment]);

  useEffect(() => {
    if (!instruction || instruction.selfCompleted || remaining <= 0) return;
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [instruction, instruction?.selfCompleted, remaining]);

  const canContinue = useMemo(
    () => Boolean(instruction && !instruction.selfCompleted && remaining <= 0 && !submitting),
    [instruction, remaining, submitting],
  );

  async function handleContinue() {
    if (!bootstrap || !instruction || !canContinue) return;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/pre-segment-instruction/complete`, {
        method: 'POST',
        headers: idempotencyHeaders(
          `pre-segment-complete:${bootstrap.sessionCode}:${bootstrap.participantId}:${instruction.workSegment}`,
          { 'Content-Type': 'application/json' },
        ),
        body: JSON.stringify({ participantId: bootstrap.participantId }),
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { message?: string; error?: string } | null;
        throw new Error(payload?.message ?? payload?.error ?? `请求失败：${response.status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <nav className="flex h-[52px] shrink-0 items-center border-b border-[#eaecf0] bg-white px-5" style={{ boxShadow: 'var(--shadow-topbar)' }}>
        <div className="text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-4 py-10">
        <section className="w-full max-w-3xl rounded-xl border border-[#eaecf0] bg-white p-8" style={{ boxShadow: 'var(--shadow-elevated)' }}>
          <div className="mb-2 text-sm font-medium text-[#86909c]">{workSegmentLabel(instruction?.workSegment)}</div>
          <h1 className="text-2xl font-semibold text-[#1d2129]">阅读材料</h1>

          <div className="mt-6 rounded-lg border border-[#e5e6eb] bg-[#f7f8fa] p-5 text-[16px] leading-8 text-[#1d2129]">
            {instruction?.body ?? '正在加载阅读材料...'}
          </div>

          {error ? (
            <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm leading-6 text-red-600">{error}</div>
          ) : null}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-[#4e5969]">
              {instruction?.selfCompleted
                ? `已完成阅读，等待另一位参与者（${instruction.completedCount}/${instruction.participantCount}）`
                : remaining > 0
                  ? `请继续阅读，${formatSeconds(remaining)} 后可继续`
                  : '可以继续'}
            </div>
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={!canContinue}
              className={`rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition ${
                canContinue ? 'bg-[#00b42a] hover:bg-[#009a29] active:scale-[0.98]' : 'bg-[#c9cdd4]'
              }`}
            >
              {instruction?.selfCompleted ? '等待中' : remaining > 0 ? `继续（${formatSeconds(remaining)}）` : submitting ? '提交中...' : '继续'}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
