'use client';

import { SessionTopbar } from '@/components/session-topbar';
import { useSessionRuntime } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function PracticeQuizPage() {
  const router = useRouter();
  const { bootstrap, runtime, loading, refresh } = useSessionRuntime();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ correctCount: number; passed: boolean; passCount: number } | null>(null);

  useEffect(() => {
    if (!loading && !bootstrap) {
      router.replace('/login');
      return;
    }
    if (!runtime || !bootstrap) return;
    if (runtime.phase === 'instruction') {
      void fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/practice-quiz`, {
        cache: 'no-store',
      }).then(() => refresh());
    }
    if (runtime.phase === 'practice_ready' && !runtime.practiceQuizPassed) {
      return;
    }
    if (runtime.phase === 'practice_ready' && runtime.syncState?.selfReady) {
      router.replace('/ready?target=practice');
      return;
    }
    if (runtime.phase === 'practice') {
      router.replace('/practice');
      return;
    }
    if (runtime.phase === 'formal_ready' && runtime.syncState?.selfReady) {
      router.replace('/ready?target=formal');
      return;
    }
    if (runtime.phase === 'formal_work') {
      router.replace(runtime.assignedRole === 'B' ? '/workspace/b' : '/workspace/a');
    }
  }, [bootstrap, loading, refresh, router, runtime]);

  const template = runtime?.practiceQuizTemplate;
  const canSubmit = useMemo(() => {
    if (!template) return false;
    return template.items.every((item) => Boolean(answers[item.id]));
  }, [answers, template]);

  async function handleSubmit() {
    if (!bootstrap || !canSubmit) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/practice-quiz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: bootstrap.participantId, answers }),
      });
      if (!response.ok) throw new Error('practice quiz submit failed');
      const data = (await response.json()) as { correctCount: number; passed: boolean; passCount: number };
      setResult(data);
      await refresh();
      if (data.passed) {
        await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/ready-practice`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId: bootstrap.participantId }),
        });
        router.push('/ready?target=practice');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!loading && !bootstrap) return null;

  return (
    <main className="flex h-screen flex-col bg-[#f0f2f5] text-[#1d2129]">
      <SessionTopbar
        roleLabel={runtime?.assignedRole === 'A' ? '尽调员' : '投资经理'}
        currentLabel="测试题"
        stageLabel="当前阶段"
        countdownLabel="--:--"
      />
      <div className="no-scrollbar flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl rounded-2xl border border-[#eaecf0] bg-white p-8 shadow-sm">
          <div className="mb-2 text-xs font-medium tracking-widest text-[#86909c]">测试题</div>
          <div className="mb-3 text-2xl font-semibold text-[#1d2129]">{template?.title ?? '开始前测试题'}</div>
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-[#1e80ff]">
            需要至少答对 {runtime?.practiceQuizPassCount ?? 1} 题，才能进入测试轮。
          </div>

          <div className="space-y-6">
            {(template?.items ?? []).map((item, index) => (
              <section key={item.id} className="rounded-xl border border-[#eaecf0] p-5">
                <div className="mb-3 font-semibold text-[#1d2129]">
                  Q{index + 1}. {item.prompt}
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {item.options.map((option) => {
                    const selected = answers[item.id] === option;
                    return (
                      <label
                        key={option}
                        className={`flex cursor-pointer items-center rounded-xl border px-4 py-3 text-sm transition-colors duration-150 ${
                          selected
                            ? 'border-[#1e80ff] bg-blue-50 text-[#1e80ff]'
                            : 'border-[#eaecf0] bg-white hover:border-blue-200 hover:bg-blue-50/50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={item.id}
                          value={option}
                          checked={selected}
                          onChange={() => setAnswers((prev) => ({ ...prev, [item.id]: option }))}
                          className="mr-3"
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>

          {result ? (
            <div
              className={`mt-6 rounded-xl border p-4 text-sm ${
                result.passed ? 'border-green-200 bg-green-50 text-green-700' : 'border-amber-200 bg-amber-50 text-amber-800'
              }`}
            >
              本次答对 {result.correctCount} 题，需要至少答对 {result.passCount} 题。
              {result.passed ? ' 已通过，正在进入测试轮同步准备。' : ' 未通过，请检查后重新作答。'}
            </div>
          ) : null}

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={!canSubmit || submitting}
              className="rounded-lg bg-[#1e80ff] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1168e3] disabled:opacity-60"
            >
              {submitting ? '提交中...' : '提交测试题'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
