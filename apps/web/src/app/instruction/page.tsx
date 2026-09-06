'use client';

import { useSessionRuntime } from '@/lib/session-runtime';
import { idempotencyHeaders } from '@/lib/idempotency';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

// ========== 文字内容完全来自原始文档，一个字都不能改 ==========

// 第十次会议 A/B 第一页指导语线上实验修订版，按原文顺序拆分为网页层级。
const generalInstructions = [
  { text: '本实验由测试轮和三个正式工作段组成。测试轮用于熟悉页面和操作，不计入绩效。正式任务中，你将与另一名参与者组成两人团队。系统随机分配角色 A 和角色 B，角色在整个实验过程中保持不变。' },
  { text: '实验中每个正式工作段包含任务 1 和任务 2。' },
];

const informationDefinitions = [
  { term: '机会', text: '可能对公司未来经营表现、竞争状态或投资吸引力产生正面影响的信息。' },
  { term: '风险', text: '可能对公司未来经营表现、竞争状态或投资吸引力产生负面影响的信息。' },
  { term: '重要信息', text: '影响范围较大、后果较明显、持续性较强，或足以单独改变整体判断的信息。' },
  { term: '普通信息', text: '影响方向明确，但影响范围、后果或持续性相对有限，通常需要与其他信息合并判断的信息。' },
];

// 角色A指导语.docx
const roleInstructionsA: Array<{ text: string; indent?: boolean }> = [
  { text: '你在本实验中的角色是 A。' },
  { text: '你的任务：阅读系统分配的公司材料，在限定时间内完成一份任务表。任务表包含以下三部分，请按要求依次完成：' },
  { text: '基础数值摘录：从系统给出的材料中，直接抄录题目要求（标 * 号）的指标和数值（例如“成立时间 2004年”）。', indent: true },
  { text: '材料线索记录：系统会提供多份公司材料。请你按顺序，逐一判断每份材料是否包含与该公司投资判断有关的机会线索或风险线索。一份材料可能只有机会，可能只有风险，也可能同时包含二者。发现相应线索时，选择“有”，并填写能够支持判断的简短证据片段；未发现相应线索时，选择“未发现”。证据片段应来自该份材料，不需要填写完整分析理由。如果该材料完全不包含相关线索，则选择“无”，无需填写证据。', indent: true },
  { text: '给角色 B 的总体交接备注：本栏为可选项。你可以提醒角色 B 核验某项信息，也可以说明不同材料之间的关联、口径差异或尚未完全确定的线索。没有需要提醒的内容时可以留空。', indent: true },
  { text: '你的任务表会在限定时间结束后由系统自动提交，你不能提前提交（时间结束前可以修改，结束后自动收卷）。你填写的所有内容将作为角色 B 后续判断的参考。你看不到角色 B 的材料、草稿和最终判断。' },
];

// 角色B指导语.docx
const roleInstructionsB: Array<{ text: string; numbered?: boolean }> = [
  { text: '你在本实验中的角色是 B。你的任务分为两个阶段：角色 A 信息解锁前与解锁后。你需要阅读系统分配给你的公司材料，并在角色 A 信息解锁后，结合角色 A 提交的任务表与自己的材料，完成最终的任务表。' },
  { text: '阶段一：信息解锁前。你只能使用系统当前分配给你的材料进行初步阅读和思考，暂时无法看到角色 A 的任何信息。' },
  { text: '阶段二：信息解锁后（系统会在指定时间自动解锁角色 A 的信息）。你可以查看角色 A 提交的任务表，也可以点击查看角色 A 所依据的原始材料（如果需要核对或深入理解线索）。这些都不是强制的：你认为有用的就看，认为不需要也可以跳过。' },
  { text: '最终，你需要结合你手头所有可用的信息（自己的材料 + 角色 A 的提交内容 + 角色 A 的材料），完成任务表的四项内容：' },
  { text: '1. 重要机会与重要风险枚举：把你认为会显著影响投资判断的“重要机会”和“重要风险”逐条列出。每条信息旁，请选择它的主要来源；如果一条信息同时来自多处，请选择你心中权重最大的那个来源。', numbered: true },
  { text: '2. 普通机会与普通风险数量：普通机会和普通风险不需要逐条写出来，但你需要统计并记住你识别到的总条数。这个数量将在第 4 步“最终投资建议”的填写区域中，有一个专门的位置让你填入数字。', numbered: true },
  { text: '3. 综合判断：用简短的文字说明你是如何权衡你列出的机会和风险的，得出最终判断的主要理由是什么。', numbered: true },
  { text: '4. 最终投资建议：在表单的对应区域做出明确选择“投资”或“不投资”，填写你对这个选择的信心程度，并填入普通机会数量与普通风险数量。', numbered: true },
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

function GeneralInstructionContent() {
  return (
    <div>
      <div className="space-y-3 text-[14px] leading-[1.9] text-[#4e5969]">
        {generalInstructions.map((item) => <p key={item.text}>{item.text}</p>)}
      </div>
      <div className="mt-5 grid grid-cols-2 border-y border-[#e5e6eb] sm:grid-cols-4">
        {['测试轮', '正式工作段 1', '正式工作段 2', '正式工作段 3'].map((label, index) => (
          <div key={label} className="flex min-h-16 items-center gap-3 px-3 py-3 sm:border-l sm:first:border-l-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0f7ff] text-xs font-bold text-[#1e80ff]">{index + 1}</span>
            <span className="text-[13px] font-medium text-[#1d2129]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskOneContent() {
  return (
    <div className="space-y-6 text-[14px] leading-[1.9] text-[#4e5969]">
      <div className="space-y-3">
        <p>任务 1 以两人团队为单位完成同一家公司的信息处理和判断。角色 A 和角色 B 分别获得该公司的不同材料、完成不同的任务，两人的工作共同对应同一家公司的最终处理结果。</p>
        <p>角色 A先处理自己可见的材料，提取其中的信息并完成自己的任务表。角色 A 提交的信息会在规定时间后向角色 B 开放，成为角色 B 后续可以查看和使用的信息。</p>
        <p>角色 B同时处理自己可见的材料。在角色 A 信息开放后，角色 B 可以根据需要查看角色 A 提交的信息和相关材料，并决定是否将这些信息用于自己的判断。角色 B 最终形成并提交该公司的整体判断结果。</p>
        <p className="border-l-2 border-[#1e80ff] pl-4">作答时只能依据页面当前可见的材料、已经开放的信息和页面提供的工具，不要使用材料之外的知识进行推测。</p>
      </div>

      <div>
        <h3 className="mb-3 text-[14px] font-semibold text-[#1d2129]">机会和风险</h3>
        <div className="border-y border-[#e5e6eb]">
          {informationDefinitions.map((item) => (
            <div key={item.term} className="grid grid-cols-[88px_1fr] border-b border-[#eef0f2] last:border-b-0 sm:grid-cols-[120px_1fr]">
              <div className="bg-[#f7f8fa] px-3 py-3 font-semibold text-[#1d2129]">{item.term}</div>
              <div className="px-4 py-3">{item.term}是指{item.text}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div><span className="font-semibold text-[#1d2129]">角色 A：</span>只需判断每份材料是否存在机会线索或风险线索。</div>
          <div><span className="font-semibold text-[#1d2129]">角色 B：</span>需要在最终任务表中区分重要信息和普通信息。</div>
        </div>
      </div>

      <div>
        <h3 className="mb-3 text-[14px] font-semibold text-[#1d2129]">任务 1 计分规则</h3>
        <div className="space-y-3">
          <p><span className="font-semibold text-[#1d2129]">个人绩效：</span>根据每个参与者所完成的任务分别计算（角色 A 和角色 B 的任务不同，各自计分）。</p>
          <p><span className="font-semibold text-[#1d2129]">团队绩效：</span>团队绩效反映两名成员共同完成的公司处理结果。角色 A 负责前序材料的信息处理，其提交内容在规定时间后成为角色 B 可以使用的信息；角色 B 在此基础上形成该公司的最终处理结果。每家公司的团队绩效根据这一最终结果计算，所得团队绩效分由角色 A 和角色 B 共同获得。</p>
          <p>具体得分规则将在各任务表单末尾详细列出。</p>
        </div>
      </div>
    </div>
  );
}

function TaskTwoAndCompensationContent() {
  return (
    <div className="space-y-6 text-[14px] leading-[1.9] text-[#4e5969]">
      <div>
        <p><span className="font-semibold text-[#1d2129]">任务 2</span> 是单项选择题，每题有两个选项，请你从中选出一个正确答案。每个参与者都会参与该任务。</p>
      </div>

      <div>
        <h3 className="mb-3 text-[14px] font-semibold text-[#1d2129]">任务 2 计分规则</h3>
        <div className="grid grid-cols-3 border-y border-[#e5e6eb] text-center">
          <div className="px-2 py-3"><div className="font-semibold text-[#1d2129]">答对</div><div>得 1 分</div></div>
          <div className="border-x border-[#e5e6eb] px-2 py-3"><div className="font-semibold text-[#1d2129]">答错或不答</div><div>不得分</div></div>
          <div className="px-2 py-3"><div className="font-semibold text-[#1d2129]">计分范围</div><div>只计个人绩效</div></div>
        </div>
        <p className="mt-3">答对一题得 1 分；答错或不答不得分，也不扣分，只计入个人绩效。</p>
      </div>

      <div>
        <h3 className="mb-3 text-[14px] font-semibold text-[#1d2129]">报酬</h3>
        <p>总报酬由三部分构成：</p>
        <div className="my-3 border-l-4 border-[#1e80ff] bg-[#f4f9ff] px-4 py-3 text-center text-[15px] font-semibold text-[#1d2129]">
          总报酬 = 固定报酬（20元）+ 个人绩效报酬 + 团队绩效报酬
        </div>
        <div className="space-y-2">
          <p>正式任务中所获得的绩效分，会按统一比例折算成现金。</p>
          <p>所有报酬将在实验结束后通过报名使用的手机号（支付宝）渠道发放，所有报酬会在完成实验两周内发放，如果没有收到请联系实验人员。</p>
        </div>
      </div>

      <div className="border-l-2 border-[#1e80ff] pl-4 font-medium text-[#1d2129]">请注意：测试轮不计入绩效。</div>
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
    router.push('/instruction/task-preview');
  }

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
            <header className="border-b border-[#eaecf0] px-5 py-7 sm:px-10 sm:py-8">
              <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
                <div>
                  <h1 className="text-[22px] font-semibold text-[#1d2129]">开始前，请先阅读以下提示</h1>
                  <p className="mt-2 text-[14px] leading-6 text-[#86909c]">
                    下面内容会帮助你了解实验流程、计分方式和当前任务。阅读完成后进入任务表阅读页。
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
            <div className="px-5 pb-2 sm:px-10">
              {/* 一、通用指导语 */}
              <section className="py-7">
                <SectionHeader num="一" title="通用指导语" />
                <GeneralInstructionContent />
              </section>

              {/* 二、任务1 */}
              <section className="border-t border-[#f0f2f5] py-7">
                <SectionHeader num="二" title="任务 1：公司信息处理" />
                <TaskOneContent />
              </section>

              {/* 三、任务2与报酬 */}
              <section className="border-t border-[#f0f2f5] py-7">
                <SectionHeader num="三" title="任务 2 与报酬" />
                <TaskTwoAndCompensationContent />
              </section>

              {/* 四、角色说明 */}
              <section className="border-t border-[#f0f2f5] py-7">
                <SectionHeader num="四" title="角色说明" />
                {role === 'B' ? <RoleBList /> : <RoleAList />}
              </section>

              <section className="border-t border-[#f0f2f5] py-7">
                <SectionHeader num="五" title="线上实验参与规则" />
                <div className="space-y-3 text-[14px] leading-[1.9] text-[#4e5969]">
                  <p>1. 正式工作段内，请持续参与实验，不要长时间离开电脑，也不要处理与实验无关的事务。</p>
                  <p>2. 处理实验内容时，只能使用实验网站当前向你提供的材料和功能，不得使用实验网站之外的工具，包括AI、计算器、搜索引擎等帮助处理实验内容，也不得请他人帮助完成实验任务。</p>
                  <p>3. 实验网站可能记录长时间没有平台内操作、离开实验页面等情况。持续或严重偏离上述要求时，本次实验可能被判定为未完成，但是也不需要为了保持操作记录而反复点击、滚动页面或切换任务。</p>
                  <p>4. 如果出现短暂网络问题，请保持实验页面打开并尽快恢复连接。网络或实验平台本身的技术故障不会直接作为违反实验规则处理。</p>
                  <p className="font-medium text-[#1d2129]">主动中途退出，或者被正式判定为未完成实验时，将无法获得实验报酬。</p>
                </div>
              </section>

              <section className="border-t border-[#f0f2f5] py-7">
                <SectionHeader num="六" title="规则确认和知情同意说明" />
                <div className="space-y-3 rounded-lg border border-[#e8f3ff] bg-[#f4f9ff] px-5 py-4 text-[14px] leading-[2] text-[#4e5969]">
                  <p>□ 我已阅读并理解上述参与规则。在接下来的实验中，我会持续参与，并只使用实验网站当前提供的材料和功能处理实验任务，不使用网站之外的工具、其他设备或他人帮助。</p>
                  <p>□本实验用于学术研究，所有数据仅用于学术研究和实验质量检查，研究报告中不会展示能够直接识别你个人身份的信息。本实验不评价你的个人能力，也不涉及真实投资建议。测试轮不计入正式绩效，正式任务中的绩效分会按统一规则折算为报酬。参加实验是自愿的，点击“我已阅读，进入下一步”，即表示你已阅读并理解以上说明，并同意参加本实验。</p>
                </div>
              </section>
            </div>

            {/* 底部 */}
            <footer className="flex flex-col items-start justify-between gap-4 border-t border-[#eaecf0] bg-[#fafbfc] px-5 py-5 sm:flex-row sm:items-center sm:px-10">
              <span className="text-[13px] text-[#86909c]">请尽量保持页面开启，不要随意刷新或关闭浏览器窗口。</span>
              <button
                type="button"
                onClick={() => void handleStart()}
                disabled={starting || !role || !sessionCode || !participantId}
                className="h-10 w-full rounded-lg bg-[#1e80ff] px-8 text-[14px] font-semibold text-white shadow-sm transition hover:bg-[#1168e3] active:scale-[0.98] disabled:opacity-60 sm:w-auto"
              >
                {starting ? '正在进入下一步...' : '我已阅读，进行下一步'}
              </button>
            </footer>
          </div>
        </div>
      </div>
    </main>
  );
}
