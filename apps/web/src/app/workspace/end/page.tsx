'use client';

import { QuestionnaireForm, type QuestionnaireAnswers } from '@/components/questionnaire-form';
import { idempotencyHeaders } from '@/lib/idempotency';
import { useSessionRuntime } from '@/lib/session-runtime';
import { OnlineIntegrityGuard } from '@/components/online-integrity-guard';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

function safeQuestionnaireTitle(title: string | undefined, fallback: string) {
  const value = title?.trim();
  if (!value || value.includes('????') || value.includes('\\u')) return fallback;
  return value;
}

export default function ExperimentEndPage() {
  const { bootstrap, runtime, loading, refresh } = useSessionRuntime();
  const [recorded, setRecorded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const questionnaire = runtime?.questionnaireTemplate ?? null;

  useEffect(() => {
    setPaymentConfirmed(Boolean(runtime?.paymentPhoneConfirmed));
  }, [runtime?.paymentPhoneConfirmed]);

  useEffect(() => {
    if (loading || recorded || questionnaire || !paymentConfirmed) return;
    setRecorded(true);
    const code = bootstrap?.sessionCode ?? sessionStorage.getItem('exp_session_code');
    const role = bootstrap?.role ?? sessionStorage.getItem('exp_role');
    if (code && role) {
      void fetch(`${serverBaseUrl}/experiment/session/${code}/progress`, {
        method: 'POST',
        headers: idempotencyHeaders(`progress:${code}:${role}:experiment_completed`, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ role, stage: 'experiment_completed', payload: {} }),
      }).catch(() => {});
    }
  }, [bootstrap?.role, bootstrap?.sessionCode, loading, paymentConfirmed, questionnaire, recorded]);

  async function handleSubmit(answers: QuestionnaireAnswers) {
    if (!bootstrap) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/questionnaire`, {
        method: 'POST',
        headers: idempotencyHeaders(`questionnaire:${bootstrap.sessionCode}:${bootstrap.participantId}:post`, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ participantId: bootstrap.participantId, answers }),
      });
      if (!response.ok) throw new Error(await response.text());
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function confirmPaymentPhone() {
    if (!bootstrap) return;
    setConfirmingPayment(true);
    try {
      const response = await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/progress`, {
        method: 'POST',
        headers: idempotencyHeaders(`progress:${bootstrap.sessionCode}:${bootstrap.role}:payment_phone_confirmed`, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({
          role: bootstrap.role,
          stage: 'payment_phone_confirmed',
          payload: {},
        }),
      });
      if (!response.ok) throw new Error(await response.text());
      setPaymentConfirmed(true);
    } finally {
      setConfirmingPayment(false);
    }
  }

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <OnlineIntegrityGuard bootstrap={bootstrap} runtime={runtime} />
      <nav
        className="flex h-[52px] shrink-0 items-center border-b border-[#eaecf0] bg-white px-5"
        style={{ boxShadow: 'var(--shadow-topbar)' }}
      >
        <div className="text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      {questionnaire ? (
        <div className="flex-1 overflow-y-auto p-6">
          <div
            className="mx-auto max-w-3xl rounded-2xl border border-[#eaecf0] bg-white p-8"
            style={{ boxShadow: 'var(--shadow-elevated)' }}
          >
            <div className="mb-2 text-xs font-medium tracking-widest text-[#86909c]">
              {questionnaire.kind === 'segment_survey' ? '第 3 段工作回顾' : '最后问卷'}
            </div>
            <div className="mb-6 text-2xl font-semibold text-[#1d2129]">
              {safeQuestionnaireTitle(questionnaire.title, '最终问卷')}
            </div>
            <QuestionnaireForm
              questionnaire={questionnaire}
              submitting={submitting}
              submitLabel="提交"
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-1 items-center justify-center p-6">
          <div
            className="w-full max-w-md rounded-2xl border border-[#eaecf0] bg-white p-12 text-center"
            style={{ boxShadow: 'var(--shadow-elevated)' }}
          >
            {!paymentConfirmed ? (
              <>
                <div className="mb-2 text-xs font-medium tracking-widest text-[#86909c]">支付确认</div>
                <div className="mb-3 text-xl font-semibold text-[#1d2129]">确认报酬接收手机号</div>
                <div className="mb-5 text-sm leading-relaxed text-[#86909c]">
                  请确认报名时绑定的手机号（支付宝）是否正确。完整手机号不会写入问卷答案表，也不会随分析数据导出。
                </div>
                <div className="mb-6 rounded-lg border border-[#e5e6eb] bg-[#f7f8fa] px-5 py-4 font-mono text-lg font-semibold text-[#1d2129]">
                  {runtime?.maskedPhone ?? '手机号信息不可用，请联系实验人员'}
                </div>
                <button type="button" disabled={confirmingPayment || !runtime?.maskedPhone} onClick={() => void confirmPaymentPhone()} className="w-full rounded-lg bg-[#1e80ff] px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">
                  {confirmingPayment ? '确认中...' : '手机号无误，确认提交'}
                </button>
                <div className="mt-4 text-xs leading-5 text-[#86909c]">如手机号有误，请联系实验人员进入独立修改流程。</div>
              </>
            ) : (
              <>
                <div className="mb-3 text-xl font-semibold text-[#1d2129]">实验已完成</div>
                <div className="mb-6 text-sm leading-relaxed text-[#86909c]">感谢您的参与，您的所有作答已经记录完毕。报酬将在完成实验两周内发放，如未收到请联系实验人员。</div>
                <div className="rounded-lg border border-blue-100 bg-blue-50/70 px-5 py-3 text-sm text-[#1e80ff]">请向实验人员告知您已完成，然后关闭此页面。</div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
