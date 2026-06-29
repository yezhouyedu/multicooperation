'use client';

import { ATaskEditor } from '@/components/a-task-editor';
import { BTaskEditor } from '@/components/b-task-editor';
import { idempotencyHeaders } from '@/lib/idempotency';
import type { CompanyData, MaterialItem } from '@/lib/session-runtime';
import { useSessionRuntime } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';
const minReadSeconds = 30;

function demoMaterial(index: number): MaterialItem {
  return {
    id: `instruction-demo-material-${index}`,
    displayName: `${index}`,
    sourceFilename: `instruction-demo-material-${index}.docx`,
    kind: 'docx',
    storageKey: `instruction-demo-material-${index}.docx`,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sortOrder: index,
    renderMode: 'docx-preview',
    parseStatus: 'ready',
    parseError: null,
    metadata: { participantRole: index <= 5 ? 'A' : 'shared', instructionPreviewOnly: true },
    url: '',
  };
}

const previewCompany: CompanyData = {
  id: 'instruction-preview-company',
  name: '示例公司',
  roundLabel: '示例公司',
  sector: '示例行业',
  usage: 'practice',
  tags: [],
  summary: '这里展示的是任务表结构预览，不对应真实公司材料，也不会保存任何作答。',
  materials: [1, 2, 3, 4, 5, 6].map(demoMaterial),
  researchProfile: {
    companyCode: '示例公司',
    companyName: '示例公司',
    industry: '示例行业',
    alias: '示例公司',
    businessSummary: '这里展示的是任务表结构预览，不对应真实公司材料，也不会保存任何作答。',
    aFacts: [],
    rawText: '',
  },
  autoFillSourceMaterialId: null,
  sortOrder: 0,
};

export default function TaskPreviewInstructionPage() {
  const router = useRouter();
  const { runtime, loading } = useSessionRuntime();
  const [role, setRole] = useState<'A' | 'B' | null>(null);
  const [sessionCode, setSessionCode] = useState<string | null>(null);
  const [participantId, setParticipantId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(minReadSeconds);
  const [submitting, setSubmitting] = useState(false);

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
      headers: idempotencyHeaders(`progress:${nextCode}:${nextRole}:instruction_task_preview_viewed`, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ role: nextRole, stage: 'instruction_task_preview_viewed', payload: {} }),
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
    if (runtime.phase === 'formal_ready') {
      router.replace('/ready?target=formal');
      return;
    }
    if (runtime.phase === 'formal_work') {
      router.replace(runtime.assignedRole === 'B' ? '/workspace/b' : '/workspace/a');
      return;
    }
    if (runtime.phase === 'pre_segment_instruction') {
      router.replace('/pre-segment-instruction');
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

  useEffect(() => {
    setRemaining(minReadSeconds);
    const timer = window.setInterval(() => {
      setRemaining((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [role]);

  const canContinue = Boolean(role && sessionCode && participantId && remaining === 0 && !submitting);

  async function handleContinue() {
    if (!canContinue || !sessionCode || !participantId) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/ready-practice`, {
        method: 'POST',
        headers: idempotencyHeaders(`ready-practice:${sessionCode}:${participantId}`, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ participantId }),
      });
      if (!response.ok) {
        throw new Error('failed to mark practice readiness');
      }
      router.push('/ready?target=practice');
    } finally {
      setSubmitting(false);
    }
  }

  const taskPreview = useMemo(() => {
    if (role === 'B') {
      return (
        <BTaskEditor
          sessionCode="instruction-preview"
          company={previewCompany}
          disabled
          phase="practice"
          segmentIndex={0}
        />
      );
    }
    return (
      <ATaskEditor
        sessionCode="instruction-preview"
        company={previewCompany}
        disabled
        phase="practice"
        segmentIndex={0}
      />
    );
  }, [role]);

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <nav
        className="flex h-[52px] shrink-0 items-center border-b border-[#eaecf0] bg-white px-5"
        style={{ boxShadow: 'var(--shadow-topbar)' }}
      >
        <div className="text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      <div className="flex min-h-0 flex-1 flex-col px-5 py-5">
        <div
          className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#eaecf0] bg-white"
          style={{ boxShadow: 'var(--shadow-elevated)' }}
        >
          <header className="shrink-0 border-b border-[#eaecf0] px-8 py-5">
            <div className="flex items-start justify-between gap-6">
              <div>
                <h1 className="text-[22px] font-semibold text-[#1d2129]">请先阅读你的任务表</h1>
                <p className="mt-2 max-w-3xl text-[14px] leading-6 text-[#4e5969]">
                  下面展示的是你之后需要填写的任务表。请先熟悉各区域的含义和填写规则，之后进入测试题；本页不能输入内容，也不会保存任何作答。
                </p>
              </div>
              {role ? (
                <div className="shrink-0 rounded-lg bg-[#f0f7ff] px-4 py-2 text-[13px] font-medium text-[#1e80ff]">
                  当前角色：{role}
                </div>
              ) : null}
            </div>
          </header>

          <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto bg-[#f7f8fa] px-3 py-3">
            {taskPreview}
          </div>

          <footer className="flex shrink-0 items-center justify-between border-t border-[#eaecf0] bg-[#fafbfc] px-8 py-4">
            <span className="text-[13px] text-[#86909c]">
              请重点阅读表格结构、填写说明和每一部分需要整理的信息。
            </span>
            <button
              type="button"
              onClick={() => void handleContinue()}
              disabled={!canContinue}
              className="h-10 rounded-lg bg-[#1e80ff] px-8 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#1168e3] active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-[#c9d8ee] disabled:text-white"
            >
              {submitting
                ? '正在进入测试题...'
                : remaining > 0
                  ? `请先阅读 ${remaining}s`
                  : '我已阅读，开始测试题'}
            </button>
          </footer>
        </div>
      </div>
    </main>
  );
}
