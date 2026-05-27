'use client';

import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function ExperimentEndPage() {
  const [recorded, setRecorded] = useState(false);

  useEffect(() => {
    if (recorded) return;
    setRecorded(true);
    const code = sessionStorage.getItem('exp_session_code');
    const role = sessionStorage.getItem('exp_role');
    if (code && role) {
      void fetch(`${serverBaseUrl}/experiment/session/${code}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, stage: 'experiment_completed', payload: {} }),
      }).catch(() => {});
    }
  }, [recorded]);

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
          className="w-full max-w-md rounded-2xl border border-[#eaecf0] bg-white p-12 text-center"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
        >
          <div className="mb-4 text-4xl">🎉</div>
          <div className="mb-3 text-xl font-semibold text-[#1d2129]">实验已完成</div>
          <div className="mb-6 text-sm leading-relaxed text-[#86909c]">
            感谢您的参与！您的所有作答已记录完毕。<br />
            请向实验人员告知您已完成，然后关闭此页面。
          </div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-5 py-3 text-sm text-[#1e80ff]">
            您的贡献对我们的研究非常重要，谢谢！
          </div>
        </div>
      </div>
    </main>
  );
}
