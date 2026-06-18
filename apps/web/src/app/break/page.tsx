'use client';

import { QuestionnaireForm, type QuestionnaireAnswers } from '@/components/questionnaire-form';
import { SessionTopbar } from '@/components/session-topbar';
import { idempotencyHeaders } from '@/lib/idempotency';
import { useSessionRuntime } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function BreakPage() {
  const router = useRouter();
  const { bootstrap, runtime, loading, countdownLabel, refresh, connectionStatus, pendingDraftCount } = useSessionRuntime();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const feedbackResumeTaskId =
    typeof window !== 'undefined' && bootstrap ? sessionStorage.getItem(`b_feedback_resume:${bootstrap.sessionCode}`) : null;

  const redirectPath = !loading && !bootstrap
    ? '/login'
    : !loading && runtime?.phase === 'pre_segment_instruction'
      ? '/pre-segment-instruction'
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
        headers: idempotencyHeaders(
          `questionnaire:${bootstrap.sessionCode}:${bootstrap.participantId}:${runtime?.questionnaireTemplate?.segmentIndex ?? 'break'}`,
          { 'Content-Type': 'application/json' },
        ),
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

  // 判断问卷类型，显示不同图标
  const questionnaireIcon = questionnaire?.kind === 'post_survey' ? '📋' : '📊';
  const stageLabel = questionnaire?.kind === 'post_survey' ? '最终问卷' : '工作段后问卷';

  return (
    <main className="flex h-screen flex-col bg-gradient-to-br from-[#f0f4f8] via-[#f5f7fa] to-[#e8edf2] text-[#1d2129]">
      <SessionTopbar
        roleLabel={runtime?.assignedRole === 'A' ? '尽调员' : '投资经理'}
        currentLabel="休息问卷"
        stageLabel="休息剩余时间"
        countdownLabel={countdownLabel}
        connectionStatus={connectionStatus}
        pendingDraftCount={pendingDraftCount}
      />

      <div className="no-scrollbar flex-1 overflow-y-auto p-6">
        <div
          className="mx-auto max-w-3xl rounded-2xl border border-[#eaecf0] bg-white p-8"
          style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)' }}
        >
          {/* 问卷头部 */}
          <div className="mb-6 text-center">
            <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
              {questionnaireIcon}
            </div>
            <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#1e80ff]">休息阶段</div>
            <div className="text-2xl font-bold text-[#1d2129]">{questionnaire?.title ?? stageLabel}</div>
          </div>

          {/* 倒计时卡片 */}
          <div className="mb-6 flex items-center justify-center gap-3 rounded-xl border border-blue-100 bg-gradient-to-r from-blue-50/80 to-blue-50/50 px-5 py-4">
            <svg className="h-5 w-5 text-[#1e80ff]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-[#1e80ff]">
              当前休息剩余时间：<span className="font-bold">{countdownLabel}</span>
            </span>
          </div>

          {/* AI 升级提示 */}
          {runtime?.aiUpgradeNotice?.type === 'break' ? (
            <div className="mb-6 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-purple-50 p-4 text-sm font-semibold text-violet-700">
              <div className="flex items-center gap-2">
                <span className="text-lg">✨</span>
                {runtime.aiUpgradeNotice.message}
              </div>
            </div>
          ) : null}

          {/* 问卷内容 */}
          {submitted ? (
            <div className="rounded-xl border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-8 text-center">
              <div className="mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
                ✓
              </div>
              <div className="mb-2 text-lg font-bold text-green-700">问卷已提交</div>
              <div className="text-sm leading-relaxed text-green-600">
                请留在本页等待休息结束。<br />
                系统进入下一阶段后会自动跳转。
              </div>
            </div>
          ) : questionnaire ? (
            <QuestionnaireForm
              questionnaire={questionnaire}
              submitting={submitting}
              submitLabel="提交问卷并等待休息结束"
              onSubmit={handleSubmit}
            />
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#93c5fd] border-t-[#1e80ff]" />
              <div className="text-sm text-[#86909c]">正在加载问卷...</div>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="mt-6 text-center text-xs text-[#86909c]">
          问卷数据已自动保存，请放心作答
        </div>
      </div>
    </main>
  );
}
