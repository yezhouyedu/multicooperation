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
      <nav className="flex h-[52px] shrink-0 items-center border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
        <div className="text-lg font-bold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      <div className="flex flex-1 items-center justify-center">
        <div className="w-full max-w-md rounded-xl border border-[#e5e6eb] bg-white p-12 shadow-sm text-center">
          <div className="mb-4 text-4xl">🎉</div>
          <div className="mb-3 text-xl font-bold text-[#1d2129]">实验已完成</div>
          <div className="mb-6 text-sm leading-relaxed text-[#86909c]">
            感谢您的参与！您的所有作答已记录完毕。<br />
            请向实验人员告知您已完成，然后关闭此页面。
          </div>
          <div className="rounded-lg bg-blue-50 border border-blue-100 px-5 py-3 text-sm text-[#1e80ff]">
            您的贡献对我们的研究非常重要，谢谢！
          </div>
        </div>
      </div>
    </main>
  );
}
