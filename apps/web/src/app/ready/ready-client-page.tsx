'use client';

import { useSessionRuntime } from '@/lib/session-runtime';
import { idempotencyHeaders } from '@/lib/idempotency';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

function formatRoleLabel(role: 'A' | 'B') {
  return role === 'A' ? 'A' : 'B';
}

export default function ReadyClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { bootstrap, runtime, loading, refresh } = useSessionRuntime();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [ruleAnswers, setRuleAnswers] = useState({ formalOnly: false, offscreenRule: false, dropoutRule: false, privacyRule: false });
  const target = searchParams.get('target') === 'formal' ? 'formal' : 'practice';

  useEffect(() => {
    if (!bootstrap && !loading) {
      router.replace('/login');
      return;
    }
    if (!runtime) return;

    const practiceTaskDone =
      target === 'formal' &&
      runtime.phase === 'practice' &&
      Boolean(
        runtime.assignedRole === 'A'
          ? runtime.currentTask?.aSubmittedAt
          : runtime.currentTask?.bCompletedAt,
      );

    if (runtime.phase === 'practice' && !practiceTaskDone) {
      router.replace('/practice');
      return;
    }
    if (runtime.phase === 'formal_work') {
      router.replace(runtime.assignedRole === 'B' ? '/workspace/b' : '/workspace/a');
      return;
    }
    if (runtime.phase === 'pre_segment_instruction') {
      router.replace('/pre-segment-instruction');
      return;
    }
    if (runtime.phase === 'formal_break') {
      router.replace('/break');
      return;
    }
    if (runtime.phase === 'end') {
      router.replace('/workspace/end');
      return;
    }
    if (target === 'practice' && runtime.phase === 'instruction') {
      router.replace('/instruction');
      return;
    }
    if (target === 'practice' && runtime.phase === 'practice_quiz') {
      router.replace('/practice-quiz');
    }
  }, [bootstrap, loading, router, runtime, target]);

  async function handleReady() {
    if (!bootstrap) return;
    setSubmitting(true);
    setError('');
    try {
      if (target === 'formal' && runtime?.onlineIntegrity.config.enabled && !runtime.onlineIntegrity.commitmentCompleted) {
        const commitmentResponse = await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/integrity/commitment`, {
          method: 'POST',
          headers: idempotencyHeaders(`integrity-commitment:${bootstrap.sessionCode}:${bootstrap.participantId}`, { 'Content-Type': 'application/json' }),
          body: JSON.stringify({ participantId: bootstrap.participantId, accepted, answers: ruleAnswers }),
        });
        if (!commitmentResponse.ok) {
          const payload = await commitmentResponse.json().catch(() => null) as { message?: string } | null;
          throw new Error(payload?.message ?? '线上实验规则确认失败');
        }
      }
      const endpoint = target === 'practice' ? 'ready-practice' : 'ready-formal';
      const response = await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/${endpoint}`, {
        method: 'POST',
        headers: idempotencyHeaders(`${endpoint}:${bootstrap.sessionCode}:${bootstrap.participantId}`, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ participantId: bootstrap.participantId }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { message?: string; error?: string } | null;
        if (payload?.message === 'Current session phase does not support this readiness action') {
          await refresh();
          throw new Error('当前阶段已变化，页面正在刷新，请稍等。');
        }
        throw new Error(payload?.message ?? payload?.error ?? `请求失败：${response.status}`);
      }
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : '提交准备状态失败');
    } finally {
      setSubmitting(false);
    }
  }

  const title = target === 'practice' ? '已准备进入测试轮' : '正在等待进入正式实验';
  const desc =
    target === 'practice'
      ? '双方都完成测试题并点击准备后，系统会同时进入测试轮。'
      : '双方都完成测试轮并确认正式实验注意事项后，系统会同时进入正式任务。';
  const readyRoles = (runtime?.syncState?.readyRoles ?? []).map((role) => formatRoleLabel(role));
  const selfReady = runtime?.syncState?.selfReady ?? false;
  const needsIntegrityCommitment = target === 'formal' && Boolean(runtime?.onlineIntegrity.config.enabled) && !runtime?.onlineIntegrity.commitmentCompleted;
  const allRulesCorrect = accepted && Object.values(ruleAnswers).every(Boolean);

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <nav
        className="flex h-[52px] shrink-0 items-center border-b border-[#eaecf0] bg-white px-5"
        style={{ boxShadow: 'var(--shadow-topbar)' }}
      >
        <div className="text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI 协作决策平台</div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div
          className="w-full max-w-xl rounded-2xl border border-[#eaecf0] bg-white p-8 text-center"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
        >
          <div className="mb-6 flex justify-center">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-50" />
              <div className="absolute inset-2 animate-spin rounded-full border-4 border-[#93c5fd] border-t-[#1e80ff]" />
            </div>
          </div>

          <div className="mb-2 text-2xl font-semibold text-[#1d2129]">{title}</div>
          <div className="text-sm leading-7 text-[#4e5969]">{desc}</div>

          <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50/70 p-4 text-left text-sm text-[#1e80ff]">
            <div>你的状态：{selfReady ? '已准备' : '等待提交准备状态'}</div>
            <div>当前已准备人数：{runtime?.syncState?.readyCount ?? 0}/2</div>
            <div>已准备角色：{readyRoles.length ? readyRoles.join(' / ') : '暂无'}</div>
          </div>

          {needsIntegrityCommitment ? (
            <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50/60 p-5 text-left text-sm leading-6 text-[#4e5969]">
              <div className="font-bold text-[#1d2129]">正式实验特别注意</div>
              <label className="mt-3 flex gap-2">
                <input
                  type="checkbox"
                  checked={Object.values(ruleAnswers).every(Boolean)}
                  onChange={(event) => setRuleAnswers({ formalOnly: event.target.checked, offscreenRule: event.target.checked, dropoutRule: event.target.checked, privacyRule: event.target.checked })}
                  className="mt-1"
                />
                <span>请保持实验页面全屏，不要切换标签页、微信、桌面或其他应用，也不要使用平台外工具，包括搜索引擎、计算器和AI等。长时间没有操作、切换页面或使用外部工具的行为，可能被记录为违规；出现两次异常行为会被系统判定为退出实验。</span>
              </label>
              <label className="mt-4 flex gap-2 border-t border-amber-200 pt-4 font-semibold text-[#1d2129]">
                <input type="checkbox" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} className="mt-1" />
                <span>如果被系统判定为退出实验，或者你选择中途退出，将无法获得任何报酬。如果你的队友中途退出，你的实验报酬仍会按照实际完成部分和正常规则发放。</span>
              </label>
            </div>
          ) : null}

          <div className="mt-6">
            {error ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left text-xs leading-5 text-red-600">
                {error}
              </div>
            ) : null}
            {selfReady ? (
              <div className="text-sm text-[#86909c]">你已完成准备。页面会自动刷新，并在双方都就绪后自动跳转。</div>
            ) : (
              <button
                type="button"
                onClick={() => void handleReady()}
                disabled={submitting || !bootstrap || (needsIntegrityCommitment && !allRulesCorrect)}
                className="rounded-lg bg-[#1e80ff] px-6 py-2.5 text-sm font-semibold text-white hover:bg-[#1168e3] active:scale-[0.98] disabled:opacity-60"
              >
                {submitting ? '正在提交准备状态...' : '我已准备'}
              </button>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
