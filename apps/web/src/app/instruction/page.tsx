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
  '任务2为"二选一"选择题，计入个人绩效。每做对一题得1分；做错或不做不得分，也不额外扣分。',
  '任务1为材料包信息处理，包括摘录信息、判断机会和风险，并形成相关判断。A 和 B 的个人绩效按各自任务分别计算；团队绩效只计算 B 提交的材料包。',
  '具体得分规则会显示在对应任务表单末尾。',
];

const opportunityRiskInstructions = [
  '请根据材料包判断相关信息对公司投资价值的影响方向和影响强度。',
  '"机会"指对公司未来经营表现、竞争状态或投资吸引力具有正面影响的信息。',
  '"风险"指对公司未来经营表现、竞争状态或投资吸引力具有负面影响的信息。',
  '"重要信息"指影响范围较大、后果较明显、持续性较强，或足以单独改变整体投资判断的信息。',
  '"普通信息"指影响方向明确，但影响范围、后果或持续性相对有限的信息。',
];

const roleInstructions = {
  A: [
    '你在本实验中是任务1。',
    '你的任务是阅读系统分配给你的公司材料，并在限定时间内完成任务表。你需要完成三类内容：',
    '基础数值摘录：从指定材料中摘录可以直接看到的数值和单位（如，9人），不需要自行计算，也不要判断正常或异常。',
    '材料线索记录：按材料顺序判断每份材料中是否存在与投资判断有关的机会线索或风险线索。若选择"有"，请填写材料中能支持该判断的简短证据片段。',
    '给任务2的总体交接备注：如你认为某些线索需要任务2重点核验、不同材料之间存在关联或信息尚未完全坐实，可以填写备注；没有需要提醒的内容也可以选择留空。',
    '你的任务表会在系统规定时间后锁定并自动提交，并作为任务2后续判断的参考。你看不到任务2的材料、草稿和最终判断。',
  ],
  B: [
    '你在本实验中是任务2。',
    '你的任务是阅读系统分配给你的公司材料，并在任务1信息解锁后，结合自己可见的材料、任务1提交的信息以及自己的判断，完成自己的任务表。',
    '你需要完成四类内容：',
    '1. 重要机会和重要风险枚举：填写你认为会显著影响投资判断的重要机会和重要风险。每条信息都需要选择一个权重最大的主要来源。',
    '2. 普通机会和普通风险数量：普通机会和普通风险不用逐条列出，但需要在最终投资建议处填写你识别到的数量。',
    '3. 综合判断：简要说明你如何权衡机会和风险，并给出形成判断的主要理由。',
    '4. 最终投资建议：根据你识别到的机会和风险，选择投资或不投资，并填写判断信心。',
    '在任务1信息解锁前，你只能使用自己当前可见的材料。信息解锁后，你可以查看任务1提交的任务表或上游原始材料，也可以根据任务需要选择是否查看。',
  ],
};

function InstructionSection({
  index,
  title,
  description,
  icon,
  children,
}: {
  index: string;
  title: string;
  description?: string;
  icon?: string;
  children: ReactNode;
}) {
  return (
    <section className="relative border-b border-[#f0f2f5] px-8 py-8 last:border-b-0">
      <div className="flex items-start gap-5">
        {/* 序号圆圈 */}
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e8f3ff] to-[#dbeafe] text-sm font-bold text-[#1e80ff]">
          {icon || index}
        </div>
        <div className="flex-1">
          {/* 标题 */}
          <h2 className="text-[17px] font-semibold text-[#1d2129]">{title}</h2>
          {description ? (
            <p className="mt-1.5 text-[13px] leading-6 text-[#86909c]">{description}</p>
          ) : null}
          {/* 内容 */}
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </section>
  );
}

function ParagraphList({ items }: { items: string[] }) {
  return (
    <div className="space-y-3">
      {items.map((item, index) => {
        // 检查是否是公式或重要数据（包含等号、数字、括号）
        const isFormula = /[=（）\d]/.test(item) && item.length < 100;
        // 检查是否是定义类内容（以引号开头）
        const isDefinition = item.startsWith('"') || item.startsWith('"');

        return (
          <div
            key={item}
            className={`rounded-lg px-4 py-3 text-[14px] leading-7 ${
              isFormula
                ? 'border border-[#e8f3ff] bg-[#f4f9ff] font-medium text-[#1d2129]'
                : isDefinition
                  ? 'border-l-2 border-l-[#1e80ff] bg-[#fafbfc] pl-5 text-[#4e5969]'
                  : 'text-[#4e5969]'
            }`}
          >
            {isFormula && <span className="mr-2 text-[#1e80ff]">📌</span>}
            {item}
          </div>
        );
      })}
    </div>
  );
}

function FlowList({ text }: { text: string }) {
  const items = text
    .split(/\r?\n|；|;/)
    .map((item) => item.replace(/^[-\d.、\s]+/, '').trim())
    .filter(Boolean);

  if (items.length === 0) return null;

  return (
    <div className="space-y-3">
      {items.map((item, index) => (
        <div key={`${item}-${index}`} className="flex items-start gap-3">
          <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1e80ff] text-xs font-bold text-white">
            {index + 1}
          </div>
          <div className="flex-1 rounded-lg bg-[#f7f8fa] px-4 py-3 text-[14px] leading-7 text-[#4e5969]">
            {item}
          </div>
        </div>
      ))}
    </div>
  );
}

function RoleCard({ role }: { role: 'A' | 'B' }) {
  const isA = role === 'A';
  return (
    <div
      className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
        isA
          ? 'bg-gradient-to-r from-[#e8f3ff] to-[#dbeafe] text-[#1e80ff]'
          : 'bg-gradient-to-r from-[#f0fdf4] to-[#dcfce7] text-[#16a34a]'
      }`}
    >
      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-xs font-bold shadow-sm">
        {role}
      </span>
      <span>{isA ? '任务1 · 材料处理与信息提取' : '任务2 · 综合判断与投资决策'}</span>
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
  const experimentFlow = runtime?.instructionBlocks?.experimentFlow ?? '';
  const roleSpecific = role ? roleInstructions[role] : [];
  const roleTaskTitle = '你接下来要完成的任务';
  const roleTaskDescription = role === 'B' ? '请结合自己材料与任务1提交的信息形成判断。' : '请阅读自己材料，并在限定时间内完成任务表。';

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-b from-[#f8fafc] to-[#f0f2f5]">
      {/* 顶部导航 */}
      <nav
        className="flex h-[56px] shrink-0 items-center border-b border-[#eaecf0] bg-white/80 px-6 backdrop-blur-sm"
        style={{ boxShadow: 'var(--shadow-topbar)' }}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1e80ff] text-sm font-bold text-white">
            AI
          </div>
          <span className="text-[15px] font-semibold tracking-wide text-[#1d2129]">投资决策协作平台</span>
        </div>
      </nav>

      <div className="flex flex-1 items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-4xl">
          {/* 主卡片 */}
          <div
            className="overflow-hidden rounded-2xl border border-[#eaecf0] bg-white"
            style={{ boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}
          >
            {/* 头部区域 */}
            <header className="relative overflow-hidden border-b border-[#eaecf0] bg-gradient-to-r from-[#f8fafc] to-[#f0f9ff] px-8 py-8">
              {/* 装饰背景 */}
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#1e80ff]/5" />
              <div className="absolute -bottom-4 -right-4 h-20 w-20 rounded-full bg-[#1e80ff]/3" />

              <div className="relative">
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#1e80ff]/10 px-3 py-1 text-xs font-semibold text-[#1e80ff]">
                  <span className="h-1.5 w-1.5 rounded-full bg-[#1e80ff]" />
                  实验说明
                </div>
                <h1 className="text-[22px] font-bold text-[#1d2129]">开始前，请先阅读以下提示</h1>
                <p className="mt-2 text-[14px] leading-7 text-[#86909c]">
                  下面内容会帮助你了解实验流程、计分方式和当前任务。<br />
                  阅读完成后进入测试题。
                </p>

                {/* 角色卡片 */}
                {role ? (
                  <div className="mt-5">
                    <RoleCard role={role} />
                  </div>
                ) : null}
              </div>
            </header>

            {/* 内容区域 */}
            <div className="divide-y divide-[#f0f2f5]">
              {experimentFlow.trim() ? (
                <InstructionSection index="01" title="实验流程" description="先熟悉操作，再进入正式任务。" icon="📋">
                  <FlowList text={experimentFlow} />
                </InstructionSection>
              ) : null}

              <InstructionSection
                index={experimentFlow.trim() ? '02' : '01'}
                title="报酬与任务说明"
                description="测试轮不计入绩效，正式任务按规则计分。"
                icon="💰"
              >
                <ParagraphList items={commonInstructions} />
              </InstructionSection>

              <InstructionSection
                index={experimentFlow.trim() ? '03' : '02'}
                title="机会与风险怎么判断"
                description="请按材料信息的影响方向和强度进行判断。"
                icon="⚖️"
              >
                <ParagraphList items={opportunityRiskInstructions} />
              </InstructionSection>

              <InstructionSection
                index={experimentFlow.trim() ? '04' : '03'}
                title={roleTaskTitle}
                description={roleTaskDescription}
                icon={role === 'A' ? '📝' : '🎯'}
              >
                <ParagraphList items={roleSpecific} />
              </InstructionSection>

              {activeModeText.trim() ? (
                <InstructionSection
                  index={experimentFlow.trim() ? '05' : '04'}
                  title="本轮额外提示"
                  icon="💡"
                >
                  <div className="rounded-xl border border-[#fef3c7] bg-gradient-to-r from-[#fffbeb] to-[#fef9c3] px-5 py-4 text-[14px] leading-7 text-[#92400e]">
                    <span className="mr-2">✨</span>
                    {activeModeText}
                  </div>
                </InstructionSection>
              ) : null}
            </div>

            {/* 底部操作区 */}
            <footer className="border-t border-[#eaecf0] bg-[#fafbfc] px-8 py-6">
              <div className="flex flex-col items-center gap-4 md:flex-row md:justify-between">
                {/* 左侧提示 */}
                <div className="flex items-center gap-2 text-[13px] text-[#86909c]">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <span>请尽量保持页面开启，不要随意刷新或关闭浏览器窗口</span>
                </div>

                {/* 右侧按钮 */}
                <button
                  type="button"
                  onClick={() => void handleStart()}
                  disabled={starting || !role || !sessionCode || !participantId}
                  className="group relative overflow-hidden rounded-xl bg-[#1e80ff] px-8 py-3 text-[15px] font-semibold text-white shadow-lg shadow-[#1e80ff]/25 transition-all hover:bg-[#1168e3] hover:shadow-xl hover:shadow-[#1e80ff]/30 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  <span className="relative z-10 flex items-center gap-2">
                    {starting ? (
                      <>
                        <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          />
                        </svg>
                        正在进入测试题...
                      </>
                    ) : (
                      <>
                        我已阅读，开始测试题
                        <svg
                          className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </footer>
          </div>

          {/* 底部安全提示 */}
          <div className="mt-6 text-center text-[12px] text-[#c9cdd4]">
            你的作答数据将被严格保密，仅用于学术研究
          </div>
        </div>
      </div>
    </main>
  );
}
