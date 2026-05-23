'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function WaitingRoomPage() {
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [status, setStatus] = useState('WAITING');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const storedRole = sessionStorage.getItem('exp_role');
    const storedCode = sessionStorage.getItem('exp_session_code');
    if (!storedRole || !storedCode) {
      router.replace('/login');
      return;
    }

    setRole(storedRole);
    setSessionCode(storedCode);

    async function poll() {
      try {
        const response = await fetch(`${serverBaseUrl}/experiment/session/${storedCode}`, { cache: 'no-store' });
        if (!response.ok) return;
        const data = (await response.json()) as { session: { status: string } };
        setStatus(data.session.status);
        if (data.session.status === 'MATCHED' || data.session.status === 'IN_PROGRESS') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          router.push('/instruction');
        }
        if (data.session.status === 'COMPLETED') {
          if (intervalRef.current) clearInterval(intervalRef.current);
          router.push('/workspace/end');
        }
      } catch {}
    }

    void poll();
    intervalRef.current = setInterval(() => void poll(), 3000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [router]);

  const roleLabel = role === 'A' ? '尽调员' : role === 'B' ? '投资经理' : '加载中';

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <nav className="flex h-[52px] shrink-0 items-center border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
        <div className="text-lg font-bold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-[#e5e6eb] bg-white p-10 text-center shadow-sm">
          <div className="mb-6 flex justify-center">
            <span className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-sm font-medium text-[#1e80ff]">当前身份：{roleLabel}</span>
          </div>

          <div className="mb-6 flex justify-center">
            <div className="relative h-16 w-16">
              <div className="absolute inset-0 animate-ping rounded-full bg-blue-100" />
              <div className="absolute inset-2 animate-spin rounded-full border-4 border-[#1e80ff] border-t-transparent" />
            </div>
          </div>

          <div className="mb-2 text-base font-bold text-[#1d2129]">正在等待开始</div>
          <div className="text-sm text-[#86909c]">
            {status === 'MATCHED' || status === 'IN_PROGRESS' ? '即将进入实验...' : '请保持页面开启，系统准备完成后会自动进入下一步。'}
          </div>

          {sessionCode ? <div className="mt-6 rounded-lg bg-gray-50 px-4 py-2 text-xs text-[#86909c]">系统已记录本次实验身份，请保持页面开启。</div> : null}
        </div>
      </div>
    </main>
  );
}
