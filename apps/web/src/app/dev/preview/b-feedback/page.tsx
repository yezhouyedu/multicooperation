'use client';

import { BFeedbackForm } from '@/components/b-feedback-form';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function BFeedbackInner() {
  const params = useSearchParams();
  const router = useRouter();
  const code = params.get('code') ?? '未提供';
  const companyName = params.get('company') ?? '当前公司';
  const companyNo = Number(params.get('no') ?? '1');

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#f0f2f5] text-[#1d2129] text-sm">
      <div className="flex h-full flex-col">
        <nav className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="text-lg font-bold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
            <div className="rounded border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-[#86909c]">角色: 投资经理</div>
            <div className="rounded border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-[#86909c]">
              {companyName} · 反馈
            </div>
          </div>
        </nav>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto">
          <BFeedbackForm
            sessionCode={code}
            taskId="preview-task"
            companyName={companyName}
            companyNo={companyNo}
            onSubmitted={() => router.push(`/dev/preview/b?code=${code}`)}
          />
        </div>
      </div>
    </main>
  );
}

export default function BFeedbackPage() {
  return (
    <Suspense>
      <BFeedbackInner />
    </Suspense>
  );
}
