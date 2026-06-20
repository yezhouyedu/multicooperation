'use client';

import { useSessionRuntime } from '@/lib/session-runtime';
import { idempotencyHeaders } from '@/lib/idempotency';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

// ========== 文字内容完全来自原始文档，一个字都不能改 ==========

const defaultExperimentFlow =
  '实验开始后，你将先完成测试题和测试轮，用来熟悉页面与操作方式。测试轮不计入绩效。随后进入正式任务，共 3 个工作段。每个工作段前会先阅读提示材料；工作段结束后需要完成对应问卷，并在休息后进入下一段。';

// 通用指导语.docx
const commonInstructions: Array<{ text: string; highlight?: 'formula' | 'info' }> = [
  { text: '本实验有两类任务，任务1和任务2。' },
  { text: '你的总报酬由三部分组成：' },
  { text: '总报酬 = 固定报酬（25元人民币）+ 个人绩效报酬 + 团队绩效报酬。', highlight: 'formula' },
  { text: '总报酬将在一个月内通过手机号支付完毕。' },
  { text: '测试轮不计入绩效。正式任务中，你完成的任务会获得绩效分。绩效分会按统一比例折算为现金。' },
  { text: '任务2为"二选一"选择题，计入个人绩效。每做对一题得1分；做错或不做不得分，也不额外扣分。' },
  { text: '任务1为材料包信息处理，包括摘录信息、判断机会和风险，并形成相关判断。角色A和角色B的个人绩效按各自任务分别计算；团队绩效只计算角色B提交的材料包。' },
  { text: '具体得分规则会显示在对应任务表单末尾。', highlight: 'info' },
];

// 通用指导语.docx - 机会/风险判断说明
const opportunityRiskInstructions: Array<{ text: string; highlight?: 'definition' }> = [
  { text: '请根据材料包判断相关信息对公司投资价值的影响方向和影响强度。' },
  { text: '"机会"指对公司未来经营表现、竞争状态或投资吸引力具有正面影响的信息。', highlight: 'definition' },
  { text: '"风险"指对公司未来经营表现、竞争状态或投资吸引力具有负面影响的信息。', highlight: 'definition' },
  { text: '"重要信息"指影响范围较大、后果较明显、持续性较强，或足以单独改变整体投资判断的信息。', highlight: 'definition' },
  { text: '"普通信息"指影响方向明确，但影响范围、后果或持续性相对有限的信息。', highlight: 'definition' },
];

// 角色A指导语.docx
const roleInstructionsA: Array<{ text: string; indent?: boolean }> = [
  { text: '你在本实验中的角色是A。' },
  { text: '你的任务是阅读系统分配给你的公司材料，并在限定时间内完成任务表。你需要完成三类内容：' },
  { text: '基础数值摘录：从指定材料中摘录可以直接看到的数值和单位（如，9人），不需要自行计算，也不要判断正常或异常。', indent: true },
  { text: '材料线索记录：按材料顺序判断每份材料中是否存在与投资判断有关的机会线索或风险线索。若选择"有"，请填写材料中能支持该判断的简短证据片段。', indent: true },
  { text: '给角色B的总体交接备注：如你认为某些线索需要角色B重点核验、不同材料之间存在关联或信息尚未完全坐实，可以填写备注；没有需要提醒的内容也可以选择留空。', indent: true },
  { text: '你的任务表会在系统规定时间后锁定并自动提交，并作为角色B后续判断的参考。你看不到角色B的材料、草稿和最终判断。' },
];

// 角色B指导语.docx
const roleInstructionsB: Array<{ text: string; numbered?: boolean }> = [
  { text: '你在本实验中的角色是B。' },
  { text: '你的任务是阅读系统分配给你的公司材料，并在角色A信息解锁后，结合自己可见的材料、角色A提交的信息以及自己的判断，完成自己的任务表。' },
  { text: '你需要完成四类内容：' },
  { text: '1. 重要机会和重要风险枚举：填写你认为会显著影响投资判断的重要机会和重要风险。每条信息都需要选择一个权重最大的主要来源。', numbered: true },
  { text: '2. 普通机会和普通风险数量：普通机会和普通风险不用逐条列出，但需要在最终投资建议处填写你识别到的数量。', numbered: true },
  { text: '3. 综合判断：简要说明你如何权衡机会和风险，并给出形成判断的主要理由。', numbered: true },
  { text: '4. 最终投资建议：根据你识别到的机会和风险，选择投资或不投资，并填写判断信心。', numbered: true },
  { text: '在角色A信息解锁前，你只能使用自己当前可见的材料。信息解锁后，你可以查看角色A提交的任务表或上游原始材料，也可以根据任务需要选择是否查看。' },
];

// ========== UI 组件 ==========

/** 带序号的 section 标题 */
function SectionHeader({ num, title }: { num: string; title: string }) {
  return (
    <div className="mb-5 flex items-baseline gap-3">
      <span className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-md bg-[#1e80ff] px-1.5 text-[13px] font-bold text-white">
        {num}
      </span>
      <h2 className="text-[16px] font-semibold text-[#1d2129]">{title}</h2>
    </div>
  );
}

/** 任务介绍段落列表：公式行高亮、提示行高亮 */
function CommonInstructionList() {
  return (
    <div className="space-y-3">
      {commonInstructions.map((item) => {
        if (item.highlight === 'formula') {
          return (
            <div
              key={item.text}
              className="rounded-lg border border-blue-100 bg-blue-50/60 px-4 py-3 text-[14px] font-medium leading-[1.8] text-[#1d2129]"
            >
              {item.text}
            </div>
          );
        }
        if (item.highlight === 'info') {
          return (
            <div
              key={item.text}
              className="border-l-2 border-l-[#1e80ff] pl-4 text-[14px] leading-[1.8] text-[#86909c]"
            >
              {item.text}
            </div>
          );
        }
        return (
          <p key={item.text} className="text-[14px] leading-[1.9] text-[#4e5969]">
            {item.text}
          </p>
        );
      })}
    </div>
  );
}

/** 机会/风险定义列表：定义项用浅色卡片 */
function OpportunityRiskList() {
  return (
    <div className="space-y-2.5">
      {opportunityRiskInstructions.map((item) => {
        if (item.highlight === 'definition') {
          return (
            <div
              key={item.text}
              className="flex items-start gap-3 rounded-lg bg-gray-50 px-4 py-3"
            >
              <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#1e80ff]" />
              <p className="text-[14px] leading-[1.8] text-[#4e5969]">{item.text}</p>
            </div>
          );
        }
        return (
          <p key={item.text} className="text-[14px] leading-[1.9] text-[#4e5969]">
            {item.text}
          </p>
        );
      })}
    </div>
  );
}

/** 角色A段落列表：首句加粗，三类内容缩进 */
function RoleAList() {
  return (
    <div className="space-y-3">
      {roleInstructionsA.map((item, i) => {
        if (i === 0) {
          return (
            <p key={item.text} className="text-[14px] font-semibold leading-[1.9] text-[#1d2129]">
              {item.text}
            </p>
          );
        }
        return (
          <p
            key={item.text}
            className={`text-[14px] leading-[1.9] text-[#4e5969] ${item.indent ? 'pl-4 border-l-2 border-l-gray-200' : ''}`}
          >
            {item.text}
          </p>
        );
      })}
    </div>
  );
}

/** 角色B段落列表：首句加粗，编号项突出 */
function RoleBList() {
  return (
    <div className="space-y-3">
      {roleInstructionsB.map((item, i) => {
        if (i === 0) {
          return (
            <p key={item.text} className="text-[14px] font-semibold leading-[1.9] text-[#1d2129]">
              {item.text}
            </p>
          );
        }
        if (item.numbered) {
          return (
            <div key={item.text} className="flex gap-3 rounded-lg bg-gray-50 px-4 py-3">
              <span className="mt-0.5 text-[14px] font-bold text-[#1e80ff]">
                {item.text.charAt(0)}
              </span>
              <p className="flex-1 text-[14px] leading-[1.8] text-[#4e5969]">
                {item.text.slice(3)}
              </p>
            </div>
          );
        }
        return (
          <p key={item.text} className="text-[14px] leading-[1.9] text-[#4e5969]">
            {item.text}
          </p>
        );
      })}
    </div>
  );
}

// ========== 页面 ==========

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
  const experimentFlow = runtime?.instructionBlocks?.experimentFlow?.trim() || defaultExperimentFlow;

  // 动态编号：始终从一开始
  let sectionNum = 0;
  const nextNum = () => {
    sectionNum += 1;
    const nums = ['一', '二', '三', '四', '五'];
    return nums[sectionNum - 1] || String(sectionNum);
  };

  return (
    <main className="flex min-h-screen flex-col bg-[#f0f2f5]">
      {/* 顶栏 */}
      <nav
        className="flex h-[52px] shrink-0 items-center border-b border-[#eaecf0] bg-white px-5"
        style={{ boxShadow: 'var(--shadow-topbar)' }}
      >
        <div className="text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
      </nav>

      {/* 主体 */}
      <div className="flex flex-1 items-start justify-center px-4 py-8">
        <div className="w-full max-w-4xl">
          <div
            className="overflow-hidden rounded-2xl border border-[#eaecf0] bg-white"
            style={{ boxShadow: 'var(--shadow-elevated)' }}
          >
            {/* 头部 */}
            <header className="border-b border-[#eaecf0] px-10 py-8">
              <div className="flex items-end justify-between">
                <div>
                  <h1 className="text-[22px] font-semibold text-[#1d2129]">开始前，请先阅读以下提示</h1>
                  <p className="mt-2 text-[14px] leading-6 text-[#86909c]">
                    下面内容会帮助你了解实验流程、计分方式和当前任务。阅读完成后进入测试题。
                  </p>
                </div>
                {role ? (
                  <div className="shrink-0 rounded-lg bg-[#f0f7ff] px-4 py-2 text-[13px] font-medium text-[#1e80ff]">
                    当前角色：{role === 'A' ? '角色A' : '角色B'}
                  </div>
                ) : null}
              </div>
            </header>

            {/* 内容 */}
            <div className="px-10 pb-2">
              {/* 一、实验流程 */}
              <section className="py-7">
                <SectionHeader num={nextNum()} title="实验流程" />
                <div className="rounded-lg border border-[#e8f3ff] bg-[#f4f9ff] px-5 py-4">
                  <p className="text-[14px] leading-[2] text-[#4e5969]">{experimentFlow}</p>
                </div>
              </section>

              {/* 任务介绍 */}
              <section className="border-t border-[#f0f2f5] py-7">
                <SectionHeader num={nextNum()} title="任务介绍" />
                <CommonInstructionList />
              </section>

              {/* 机会/风险判断说明 */}
              <section className="border-t border-[#f0f2f5] py-7">
                <SectionHeader num={nextNum()} title="机会/风险判断说明" />
                <OpportunityRiskList />
              </section>

              {/* 角色说明 */}
              <section className="border-t border-[#f0f2f5] py-7">
                <SectionHeader num={nextNum()} title="角色说明" />
                {role === 'B' ? <RoleBList /> : <RoleAList />}
              </section>

              {/* 实验条件额外提示（如有） */}
              {activeModeText.trim() ? (
                <section className="border-t border-[#f0f2f5] py-7">
                  <SectionHeader num={nextNum()} title="本轮额外提示" />
                  <div className="rounded-lg border border-[#fef3c7] bg-[#fffbeb] px-5 py-4 text-[14px] leading-[1.9] text-[#92400e]">
                    {activeModeText}
                  </div>
                </section>
              ) : null}
            </div>

            {/* 底部 */}
            <footer className="flex items-center justify-between border-t border-[#eaecf0] bg-[#fafbfc] px-10 py-5">
              <span className="text-[13px] text-[#86909c]">请尽量保持页面开启，不要随意刷新或关闭浏览器窗口。</span>
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={starting || !role || !sessionCode || !participantId}
                className="h-10 rounded-lg bg-[#1e80ff] px-8 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#1168e3] active:scale-[0.98] disabled:opacity-60"
              >
                {starting ? '正在进入测试题...' : '我已阅读，开始测试题'}
              </button>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
