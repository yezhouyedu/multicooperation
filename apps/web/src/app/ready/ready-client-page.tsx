'use client';

import { useSessionRuntime } from '@/lib/session-runtime';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

function formatRoleLabel(role: 'A' | 'B') {
  return role === 'A' ? '尽调员' : '投资经理';
}

export default function ReadyClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { bootstrap, runtime, loading } = useSessionRuntime();
  const [submitting, setSubmitting] = useState(false);
  const target = searchParams.get('target') === 'formal' ? 'formal' : 'practice';

  useEffect(() => {
    if (!bootstrap && !loading) {
      router.replace('/login');
      return;
    }
    if (!runtime) return;

    if (runtime.phase === 'practice') {
      router.replace('/practice');
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
      return;
    }
    if (target === 'practice' && runtime.phase === 'instruction') {
      router.replace('/instruction');
    }
  }, [bootstrap, loading, router, runtime, target]);

  async function handleReady() {
    if (!bootstrap) return;
    setSubmitting(true);
    try {
      const endpoint = target === 'practice' ? 'ready-practice' : 'ready-formal';
      await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId: bootstrap.participantId }),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const title = target === 'practice' ? '已准备进入测试轮' : '已准备进入正式阶段';
  const desc =
    target === 'practice'
      ? '双方都完成指导语阅读并点击准备后，系统会同时进入测试轮。'
      : '双方都完成测试轮并点击准备后，系统会同时进入正式任务页。';
  const readyRoles = (runtime?.syncState?.readyRoles ?? []).map((role) => formatRoleLabel(role));
  const selfReady = runtime?.syncState?.selfReady ?? false;

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <nav className="flex h-[52px] shrink-0 items-center border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
        <div className="text-lg font-bold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      <div className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-xl rounded-xl border border-[#e5e6eb] bg-white p-8 text-center shadow-sm">
          <div className="mb-6 flex justify-center">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-100" />
              <div className="absolute inset-2 animate-spin rounded-full border-4 border-[#1e80ff] border-t-transparent" />
            </div>
          </div>

          <div className="mb-2 text-2xl font-bold text-[#1d2129]">{title}</div>
          <div className="text-sm leading-7 text-[#4e5969]">{desc}</div>

          <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4 text-left text-sm text-[#1e80ff]">
            <div>你的状态：{selfReady ? '已准备' : '等待提交准备状态'}</div>
            <div>当前已准备人数：{runtime?.syncState?.readyCount ?? 0}/2</div>
            <div>已准备角色：{readyRoles.length ? readyRoles.join(' / ') : '暂无'}</div>
          </div>

          <div className="mt-6">
            {selfReady ? (
              <div className="text-sm text-[#86909c]">你已完成准备。页面会自动刷新，并在双方都就绪后自动跳转。</div>
            ) : (
              <button
                type="button"
                onClick={() => void handleReady()}
                disabled={submitting || !bootstrap}
                className="rounded-lg bg-[#1e80ff] px-6 py-2.5 text-sm font-bold text-white hover:bg-blue-600 disabled:opacity-60"
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
