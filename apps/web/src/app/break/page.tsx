'use client';

import { QuestionnaireForm, type QuestionnaireAnswers } from '@/components/questionnaire-form';
import { SessionTopbar } from '@/components/session-topbar';
import { useSessionRuntime } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function BreakPage() {
  const router = useRouter();
  const { bootstrap, runtime, loading, countdownLabel, refresh } = useSessionRuntime();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const feedbackResumeTaskId =
    typeof window !== 'undefined' && bootstrap ? sessionStorage.getItem(`b_feedback_resume:${bootstrap.sessionCode}`) : null;

  const redirectPath = !loading && !bootstrap
    ? '/login'
    : !loading && runtime?.phase === 'formal_work'
      ? runtime?.assignedRole === 'B'
        ? feedbackResumeTaskId && feedbackResumeTaskId === runtime.currentTask?.id && !runtime.currentTask?.bCompletedAt
          ? '/workspace/b-feedback'
          : '/workspace/b'
        : '/workspace/a'
      : !loading && runtime?.phase === 'end'
        ? '/workspace/end'
        : null;

  useEffect(() => {
    if (redirectPath) router.replace(redirectPath);
  }, [redirectPath, router]);

  useEffect(() => {
    setSubmitted(Boolean(runtime?.questionnaireSubmitted));
  }, [runtime?.questionnaireSubmitted, runtime?.questionnaireTemplate?.segmentIndex]);

  if (redirectPath) return null;

  async function handleSubmit(answers: QuestionnaireAnswers) {
    if (!bootstrap) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/questionnaire`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: bootstrap.participantId, answers }),
      });
      if (!response.ok) throw new Error(await response.text());
      setSubmitted(true);
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  const questionnaire = runtime?.questionnaireTemplate;

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
          <div className="mb-4 text-2xl font-semibold text-[#1d2129]">{questionnaire?.title ?? '工作段后问卷'}</div>
          <div className="mb-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-sm text-[#1e80ff]">
            当前休息剩余时间：{countdownLabel}
          </div>
          {runtime?.aiUpgradeNotice?.type === 'break' ? (
            <div className="mb-6 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm font-semibold text-violet-700">
              {runtime.aiUpgradeNotice.message}
            </div>
          ) : null}

          {submitted ? (
            <div className="rounded-xl border border-green-200 bg-green-50 p-6 text-sm leading-7 text-green-700">
              <div className="mb-1 text-base font-semibold">问卷已提交</div>
              <div>请留在本页等待休息结束。系统进入下一阶段后会自动跳转。</div>
            </div>
          ) : questionnaire ? (
            <QuestionnaireForm
              questionnaire={questionnaire}
              submitting={submitting}
              submitLabel="提交工作段后问卷，等待休息结束"
              onSubmit={handleSubmit}
            />
          ) : (
            <div className="rounded-xl border border-[#e5e6eb] bg-[#fafafa] p-6 text-sm text-[#86909c]">
              正在加载问卷...
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
