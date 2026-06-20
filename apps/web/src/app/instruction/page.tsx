'use client';

import { useSessionRuntime } from '@/lib/session-runtime';
import { idempotencyHeaders } from '@/lib/idempotency';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

const commonInstructions = [
  '本实验有两类任务，任务1和任务2。',
  '你的总报酬由三部分组成：',
  '总报酬 = 固定报酬（25元人民币）+ 个人绩效报酬 + 团队绩效报酬。',
  '总报酬将在一个月内通过手机号支付完毕。',
  '测试轮不计入绩效。正式任务中，你完成的任务会获得绩效分。绩效分会按统一比例折算为现金。',
  '任务2为“二选一”选择题，计入个人绩效。每做对一题得1分；做错或不做不得分，也不额外扣分。',
  '任务1为材料包信息处理，包括摘录信息、判断机会和风险，并形成相关判断。角色A和角色B的个人绩效按各自任务分别计算；团队绩效只计算角色B提交的材料包。',
  '具体得分规则会显示在对应任务表单末尾。',
];

const opportunityRiskInstructions = [
  '请根据材料包判断相关信息对公司投资价值的影响方向和影响强度。',
  '“机会”指对公司未来经营表现、竞争状态或投资吸引力具有正面影响的信息。',
  '“风险”指对公司未来经营表现、竞争状态或投资吸引力具有负面影响的信息。',
  '“重要信息”指影响范围较大、后果较明显、持续性较强，或足以单独改变整体投资判断的信息。',
  '“普通信息”指影响方向明确，但影响范围、后果或持续性相对有限的信息。',
];

const roleInstructions = {
  A: [
    '你在本实验中的角色是A。',
    '你的任务是阅读系统分配给你的公司材料，并在限定时间内完成任务表。你需要完成三类内容：',
    '基础数值摘录：从指定材料中摘录可以直接看到的数值和单位（如，9人），不需要自行计算，也不要判断正常或异常。',
    '材料线索记录：按材料顺序判断每份材料中是否存在与投资判断有关的机会线索或风险线索。若选择“有”，请填写材料中能支持该判断的简短证据片段。',
    '给角色B的总体交接备注：如你认为某些线索需要角色B重点核验、不同材料之间存在关联或信息尚未完全坐实，可以填写备注；没有需要提醒的内容也可以选择留空。',
    '你的任务表会在系统规定时间后锁定并自动提交，并作为角色B后续判断的参考。你看不到角色B的材料、草稿和最终判断。',
  ],
  B: [
    '你在本实验中的角色是B。',
    '你的任务是阅读系统分配给你的公司材料，并在角色A信息解锁后，结合自己可见的材料、角色A提交的信息以及自己的判断，完成自己的任务表。',
    '你需要完成四类内容：',
    '1. 重要机会和重要风险枚举：填写你认为会显著影响投资判断的重要机会和重要风险。每条信息都需要选择一个权重最大的主要来源。',
    '2. 普通机会和普通风险数量：普通机会和普通风险不用逐条列出，但需要在最终投资建议处填写你识别到的数量。',
    '3. 综合判断：简要说明你如何权衡机会和风险，并给出形成判断的主要理由。',
    '4. 最终投资建议：根据你识别到的机会和风险，选择投资或不投资，并填写判断信心。',
    '在角色A信息解锁前，你只能使用自己当前可见的材料。信息解锁后，你可以查看角色A提交的任务表或上游原始材料，也可以根据任务需要选择是否查看。',
  ],
};

function InstructionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-[#eaecf0] bg-white p-5">
      <h2 className="mb-3 text-base font-semibold text-[#1d2129]">{title}</h2>
      {children}
    </section>
  );
}

function ParagraphList({ items }: { items: string[] }) {
  return (
    <div className="space-y-2 text-sm leading-7 text-[#4e5969]">
      {items.map((item) => (
        <p key={item}>{item}</p>
      ))}
    </div>
  );
}

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
      headers: idempotencyHeaders(`progress:${nextCode}:${nextRole}:instruction_viewed`, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({ role: nextRole, stage: 'instruction_viewed', payload: {} }),
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

  async function handleStart() {
    if (!participantId || !sessionCode) return;
    setStarting(true);
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
      setStarting(false);
    }
  }

  const activeModeText = runtime?.instructionBlocks?.activeModeText ?? '';
  const roleSpecific = role ? roleInstructions[role] : [];

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      <nav
        className="flex h-[52px] shrink-0 items-center border-b border-[#eaecf0] bg-white px-5"
        style={{ boxShadow: 'var(--shadow-topbar)' }}
      >
        <div className="text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      <div className="flex flex-1 items-start justify-center px-4 py-10">
        <div className="w-full max-w-4xl space-y-5">
          <div
            className="rounded-2xl border border-[#eaecf0] bg-white px-8 py-6"
            style={{ boxShadow: 'var(--shadow-elevated)' }}
          >
            <div className="mb-1 text-xs font-medium text-[#86909c]">实验说明</div>
            <h1 className="text-2xl font-semibold text-[#1d2129]">开始前，请先阅读以下提示</h1>
          </div>

          <InstructionCard title="通用指导语">
            <ParagraphList items={commonInstructions} />
          </InstructionCard>

          <InstructionCard title="机会/风险判断说明">
            <ParagraphList items={opportunityRiskInstructions} />
          </InstructionCard>

          <InstructionCard title={role === 'B' ? '角色B说明' : '角色A说明'}>
            <ParagraphList items={roleSpecific} />
          </InstructionCard>

          {activeModeText.trim() ? (
            <InstructionCard title="实验条件提示">
              <div className="text-sm leading-7 text-[#1e80ff]">{activeModeText}</div>
            </InstructionCard>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 text-sm text-amber-800">
            <span>请尽量保持页面开启，不要随意刷新或关闭浏览器窗口。</span>
            <button
              type="button"
              onClick={() => void handleStart()}
              disabled={starting || !role || !sessionCode || !participantId}
              className="rounded-lg bg-[#1e80ff] px-8 py-2.5 text-sm font-semibold text-white hover:bg-[#1168e3] active:scale-[0.98] disabled:opacity-60"
            >
              {starting ? '正在进入测试题...' : '我已阅读，开始测试题'}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}
