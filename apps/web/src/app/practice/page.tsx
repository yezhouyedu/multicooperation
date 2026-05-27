'use client';

import { SessionTopbar } from '@/components/session-topbar';
import { useSessionRuntime } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function PracticePage() {
  const router = useRouter();
  const { bootstrap, runtime, loading, countdownLabel } = useSessionRuntime();
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!loading && !bootstrap) {
      router.replace('/login');
    }
  }, [bootstrap, loading, router]);

  useEffect(() => {
    if (loading || !runtime) return;
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

  if (!loading && !bootstrap) return null;

  async function handleComplete() {
    if (!bootstrap) return;
    setSubmitting(true);
    try {
      await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/ready-formal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: bootstrap.participantId }),
      });
      router.push('/ready?target=formal');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex h-screen flex-col bg-[#f0f2f5] text-[#1d2129]">
      <SessionTopbar
        roleLabel={runtime?.assignedRole === 'A' ? '尽调员' : '投资经理'}
        currentLabel="测试轮"
        stageLabel="测试轮剩余时间"
        countdownLabel={countdownLabel}
      />

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="w-full max-w-3xl rounded-xl border border-[#e5e6eb] bg-white p-8 shadow-sm">
          <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[#86909c]">Practice Round</div>
          <div className="mb-4 text-2xl font-bold text-[#1d2129]">测试轮已开始</div>
          <div className="space-y-3 text-sm leading-7 text-[#4e5969]">
            <p>这一页用于熟悉工作台、AI 区和提交流程，测试轮数据不会并入正式分析。</p>
            <p>确认操作无误后，点击下方按钮进入同步准备页。两位参与者都准备完成后，系统会同时进入正式任务页。</p>
          </div>
          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-[#1e80ff]">
            当前测试轮剩余时间：{countdownLabel}
          </div>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={() => void handleComplete()}
              disabled={submitting || !bootstrap}
              className="rounded-lg bg-[#1e80ff] px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
            >
              {submitting ? '正在提交准备状态...' : '结束测试轮，准备进入正式阶段'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
