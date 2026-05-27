'use client';

import { requestExperimentFullscreen } from '@/components/experiment-fullscreen';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    const trimmed = phone.trim();
    if (!trimmed) { setError('请输入手机号'); return; }
    setLoading(true);
    setError('');
    try {
      sessionStorage.setItem('exp_prefer_fullscreen', '1');
      requestExperimentFullscreen();
      const res = await fetch(`${serverBaseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: trimmed }),
      });
      if (res.status === 403) { setError('手机号未在被试名单中，请核对后重试'); return; }
      if (!res.ok) { setError('登录失败，请稍后重试'); return; }
      const data = (await res.json()) as { participantId: string; role: string | null; sessionCode: string };
      sessionStorage.setItem('exp_participant_id', data.participantId);
      if (data.role) {
        sessionStorage.setItem('exp_role', data.role);
      } else {
        sessionStorage.removeItem('exp_role');
      }
      sessionStorage.setItem('exp_session_code', data.sessionCode);
      router.push('/waiting-room');
    } catch {
      setError('网络错误，请检查连接');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f0f2f5]">
      <div className="w-full max-w-sm rounded-xl border border-[#e5e6eb] bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <div className="mb-2 text-lg font-bold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
          <div className="text-sm text-[#86909c]">请使用实验账号登录</div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#1d2129]">手机号</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void handleLogin()}
              placeholder="请输入参与实验的手机号"
              className="w-full rounded-lg border border-[#e5e6eb] bg-gray-50 px-3 py-2.5 text-sm text-[#1d2129] outline-none transition focus:border-[#1e80ff] focus:bg-white focus:ring-1 focus:ring-[#1e80ff]"
            />
          </div>

          {error ? <div className="text-xs text-red-500">{error}</div> : null}

          <button
            type="button"
            onClick={() => void handleLogin()}
            disabled={loading}
            className="w-full rounded-lg bg-[#1e80ff] py-2.5 text-sm font-bold text-white transition hover:bg-blue-600 disabled:opacity-60"
          >
            {loading ? '登录中…' : '进入实验'}
          </button>
        </div>
      </div>
    </main>
  );
}
