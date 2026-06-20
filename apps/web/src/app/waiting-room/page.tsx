'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

function formatRoleLabel(role: string | null) {
  if (role === 'A') return 'A';
  if (role === 'B') return 'B';
  return '等待随机分配';
}

export default function WaitingRoomPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [status, setStatus] = useState('WAITING');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const storedRole = sessionStorage.getItem('exp_role');
    const storedCode = sessionStorage.getItem('exp_session_code');
    const storedParticipantId = sessionStorage.getItem('exp_participant_id');
    if (!storedCode || !storedParticipantId) {
      router.replace('/login');
      return;
    }

    setRole(storedRole);
    setSessionCode(storedCode);
    setParticipantId(storedParticipantId);

    async function enterInstructionIfReady() {
      const runtimeRes = await fetch(
        `${serverBaseUrl}/experiment/session/${storedCode}/runtime?participantId=${storedParticipantId}`,
        { cache: 'no-store' },
      );
      if (!runtimeRes.ok) return false;
      const runtime = (await runtimeRes.json()) as { assignedRole?: 'A' | 'B' };
      if (!runtime.assignedRole) return false;
      sessionStorage.setItem('exp_role', runtime.assignedRole);
      setRole(runtime.assignedRole);
      router.push('/instruction');
      return true;
    }

    async function poll() {
      try {
        const response = await fetch(`${serverBaseUrl}/experiment/session/${storedCode}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { session: { status: string } };
        setStatus(data.session.status);

        if (data.session.status === 'MATCHED' || data.session.status === 'IN_PROGRESS') {
          const entered = await enterInstructionIfReady();
          if (entered && intervalRef.current) clearInterval(intervalRef.current);
          return;
        }

        if (data.session.status === 'COMPLETED') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          router.push('/workspace/end');
        }
      } catch {
        // ignore polling errors in waiting room
      }
    }

    void poll();
    intervalRef.current = setInterval(() => void poll(), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router]);

  const statusMessage =
    status === 'WAITING'
      ? '系统正在等待另一位参与者进入。两人配对后，会先随机分配角色，再进入指导语页面。'
      : '已完成配对，系统正在分配角色并准备进入指导语页面。';

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <nav
        className="flex h-[52px] shrink-0 items-center border-b border-[#eaecf0] bg-white px-5"
        style={{ boxShadow: 'var(--shadow-topbar)' }}
      >
        <div className="text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      <div className="flex flex-1 items-center justify-center">
        <div
          className="w-full max-w-md rounded-2xl border border-[#eaecf0] bg-white p-10 text-center"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
        >
          <div className="mb-6 flex justify-center">
            <span className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-sm font-medium text-[#1e80ff]">
              当前角色：{formatRoleLabel(role)}
            </span>
          </div>

          <div className="mb-6 flex justify-center">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-50" />
              <div className="absolute inset-2 animate-spin rounded-full border-4 border-[#93c5fd] border-t-[#1e80ff]" />
            </div>
          </div>

          <div className="mb-2 text-base font-semibold text-[#1d2129]">正在等待开始</div>
          <div className="text-sm leading-relaxed text-[#86909c]">{statusMessage}</div>

          {sessionCode && participantId ? (
            <div className="mt-6 rounded-lg bg-[#f5f7fa] px-4 py-2.5 text-xs text-[#86909c]">
              已记录本次实验登录信息，请保持页面开启。
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
