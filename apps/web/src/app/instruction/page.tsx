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
      await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/ready-practice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId }),
      });
      router.push('/ready?target=practice');
    } finally {
      setStarting(false);
    }
  }

  const roleLabel = role === 'A' ? '尽调员' : role === 'B' ? '投资经理' : '加载中';
  const roleDesc =
    role === 'A'
      ? '你需要阅读原始材料，记录关键信息，并整理出供投资经理使用的尽调内容。'
      : '你需要综合自有材料、尽调员信息和自己的判断，完成投资判断并给出反馈。';

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <nav className="flex h-[52px] shrink-0 items-center border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
        <div className="text-lg font-bold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      <div className="flex flex-1 items-start justify-center px-4 py-12">
        <div className="w-full max-w-3xl rounded-xl border border-[#e5e6eb] bg-white shadow-sm">
          <div className="border-b border-[#e5e6eb] px-8 py-6">
            <div className="mb-1 text-xs text-[#86909c]">实验说明</div>
            <div className="text-xl font-bold text-[#1d2129]">开始前，请阅读以下提示</div>
          </div>

          <div className="space-y-5 px-8 py-6 text-sm leading-relaxed text-[#4e5969]">
            <div className="rounded-lg border-l-4 border-[#1e80ff] bg-blue-50 p-4">
              <div className="mb-1 font-bold text-[#1e80ff]">你的角色：{roleLabel}</div>
              <div>{roleDesc}</div>
            </div>

            <div>
              <div className="mb-2 font-bold text-[#1d2129]">实验过程中请注意</div>
              <ol className="list-decimal space-y-2 pl-5">
                <li>先进入测试轮，熟悉页面布局、AI 区和提交流程。</li>
                <li>测试轮结束后，系统会先进入同步准备页，双方准备完成后再同时进入正式任务页。</li>
                <li>正式阶段中，系统会在合适的时点自动保存你已填写的内容。</li>
                <li>请独立完成，不要与他人讨论任务内容。</li>
              </ol>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800">
              <span className="font-bold">提示：</span>
              尽量保持页面开启，不要随意刷新或关闭浏览器窗口。
            </div>
          </div>

          <div className="flex justify-end border-t border-[#e5e6eb] px-8 py-5">
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={starting || !role || !sessionCode || !participantId}
              className="rounded-lg bg-[#1e80ff] px-8 py-2.5 text-sm font-bold text-white transition hover:bg-blue-600 disabled:opacity-60"
            >
              {starting ? '正在提交准备状态...' : '我已阅读，准备进入测试轮'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
