'use client';

import { SessionTopbar } from '@/components/session-topbar';
import { useSessionRuntime } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function BreakPage() {
  const router = useRouter();
  const { bootstrap, runtime, loading, countdownLabel, refresh } = useSessionRuntime();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const redirectPath = !loading && !bootstrap
    ? '/login'
    : !loading && runtime?.phase === 'formal_work'
      ? runtime?.assignedRole === 'B'
        ? '/workspace/b'
        : '/workspace/a'
      : !loading && runtime?.phase === 'end'
        ? '/workspace/end'
        : null;

  useEffect(() => {
    if (redirectPath) router.replace(redirectPath);
  }, [redirectPath, router]);

  const questionnaire = runtime?.questionnaireTemplate;
  const canSubmit = useMemo(() => {
    if (!questionnaire) return false;
    return questionnaire.items.every((item) => Boolean(answers[item.id]));
  }, [questionnaire, answers]);

  useEffect(() => {
    if (runtime?.questionnaireSubmitted) setSubmitted(true);
  }, [runtime?.questionnaireSubmitted]);

  if (redirectPath) return null;

  async function handleSubmit() {
    if (!bootstrap || !canSubmit) return;
    setSubmitting(true);
    try {
      await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: bootstrap.participantId, answers }),
      });
      setSubmitted(true);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex h-screen flex-col bg-[#f0f2f5] text-[#1d2129]">
      <SessionTopbar
        roleLabel={runtime?.assignedRole === 'A' ? '尽调员' : '投资经理'}
        currentLabel="休息问卷"
        stageLabel="休息剩余时间"
        countdownLabel={countdownLabel}
      />

      <div className="no-scrollbar flex-1 overflow-y-auto p-6">
        <div
          className="mx-auto max-w-3xl rounded-2xl border border-[#eaecf0] bg-white p-8"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
        >
          <div className="mb-2 text-xs font-medium tracking-widest text-[#86909c]">休息阶段</div>
          <div className="mb-4 text-2xl font-semibold text-[#1d2129]">{questionnaire?.title ?? '休息问卷'}</div>
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-[#1e80ff]">
            当前休息剩余时间：{countdownLabel}
          </div>

          {submitted ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-sm leading-7 text-green-700">
              <div className="mb-1 text-base font-semibold">问卷已提交</div>
              <div>请留在本页等待休息结束。系统进入下一阶段后会自动跳转。</div>
            </div>
          ) : (
            <>
              <div className="space-y-6">
                {(questionnaire?.items ?? []).map((item, index) => (
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

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={!canSubmit || submitting}
                  className="rounded-lg bg-[#1e80ff] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1168e3] active:scale-[0.98] disabled:opacity-60"
                >
                  {submitting ? '提交中...' : '提交问卷，等待休息结束'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
