'use client';

import { useSessionRuntime } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function InstructionPage() {
  const router = useRouter();
  const { runtime, loading } = useSessionRuntime();
  const [role, setRole] = useState<'A' | 'B' | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    const nextRole = sessionStorage.getItem('exp_role') as 'A' | 'B' | null;
    const nextCode = sessionStorage.getItem('exp_session_code');
    const nextParticipantId = sessionStorage.getItem('exp_participant_id');
    if (!nextRole || !nextCode || !nextParticipantId) {
      router.replace('/login');
      return;
    }

    setRole(nextRole);
    setSessionCode(nextCode);
    setParticipantId(nextParticipantId);

    void fetch(`${serverBaseUrl}/experiment/session/${nextCode}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: nextRole, stage: 'instruction_viewed', payload: {} }),
    }).catch(() => {});
  }, [router]);

  useEffect(() => {
    if (loading || !runtime) return;
    if (runtime.phase === 'practice_quiz') {
      router.replace('/practice-quiz');
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
      return;
    }
    if (runtime.phase === 'formal_break') {
      router.replace('/break');
      return;
    }
    if (runtime.phase === 'end') {
      router.replace('/workspace/end');
    }
  }, [loading, router, runtime]);

  async function handleStart() {
    if (!participantId || !sessionCode) return;
    setStarting(true);
    try {
      await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/practice-quiz`, {
        method: 'GET',
        cache: 'no-store',
      });
      router.push('/practice-quiz');
    } finally {
      setStarting(false);
    }
  }

  const roleLabel = role === 'A' ? '尽调员' : role === 'B' ? '投资经理' : '加载中';
  const roleDesc =
    role === 'A'
      ? '你需要阅读材料、记录关键信息，并整理出供投资经理使用的尽调内容。'
      : '你需要综合自有材料、尽调信息和自己的判断，完成投资决策并给出反馈。';

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <nav
        className="flex h-[52px] shrink-0 items-center border-b border-[#eaecf0] bg-white px-5"
        style={{ boxShadow: 'var(--shadow-topbar)' }}
      >
        <div className="text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      <div className="flex flex-1 items-start justify-center px-4 py-12">
        <div
          className="w-full max-w-3xl rounded-2xl border border-[#eaecf0] bg-white"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
        >
          <div className="border-b border-[#eaecf0] px-8 py-6">
            <div className="mb-1 text-xs font-medium text-[#86909c]">实验说明</div>
            <div className="text-xl font-semibold text-[#1d2129]">开始前，请先阅读以下提示</div>
          </div>

          <div className="space-y-5 px-8 py-6 text-sm leading-relaxed text-[#4e5969]">
            <div className="rounded-xl border-l-4 border-[#1e80ff] bg-blue-50/70 p-4">
              <div className="mb-1 font-semibold text-[#1e80ff]">你的角色：{roleLabel}</div>
              <div>{roleDesc}</div>
            </div>

            <div>
              <div className="mb-2 font-semibold text-[#1d2129]">实验流程</div>
              <ol className="list-decimal space-y-2 pl-5">
                <li>先完成测试题，通过后进入测试轮。</li>
                <li>测试轮只做一家公司，流程与正式轮一致，但不计分。</li>
                <li>测试轮内会有页面教学引导，请按提示完成真实操作。</li>
                <li>测试轮完成后，双方都准备就绪，系统才会进入正式阶段。</li>
              </ol>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-amber-800">
              <span className="font-semibold">提示：</span>
              请尽量保持页面开启，不要随意刷新或关闭浏览器窗口。
            </div>
          </div>

          <div className="flex justify-end border-t border-[#eaecf0] px-8 py-5">
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={starting || !role || !sessionCode || !participantId}
              className="rounded-lg bg-[#1e80ff] px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#1168e3] active:scale-[0.98] disabled:opacity-60"
            >
              {starting ? '正在进入测试题...' : '我已阅读，开始测试题'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
