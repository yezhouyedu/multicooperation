'use client';

import { useEffect, useMemo, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type Props = {
  sessionCode: string;
  participantId: string;
  role: 'A' | 'B';
  aiLevel: 'BASIC' | 'ADVANCED';
  completedSteps?: string[];
  onCompleted?: () => void;
};

type Step = {
  key: string;
  title: string;
  detail: string;
  eventType: string;
  anchor: string;
  requireAction?: boolean; // 是否需要强制操作解锁，默认 true
};

function buildSteps(role: 'A' | 'B'): Step[] {
  return [
    {
      key: 'material_tab',
      title: '查看材料',
      detail: '请在左侧材料区点击任意标签，查看公司材料。',
      eventType: 'material_tab',
      anchor: 'material-tabs',
      requireAction: true,
    },
    {
      key: 'task_acknowledge',
      title: '填写表单',
      detail: role === 'A'
        ? '右侧为尽调表，用于填写您对公司的分析。'
        : '右侧为投资判断表，用于填写您的投资决策。',
      eventType: 'task_acknowledge',
      anchor: 'task-panel',
      requireAction: false, // 不需要强制操作，点击按钮即可
    },
    {
      key: 'ai_message',
      title: '使用 AI 助手',
      detail: '这里您可以借助 AI 的辅助完成任务。',
      eventType: 'ai_message',
      anchor: 'ai-input',
      requireAction: false, // 不需要强制操作，点击按钮即可
    },
    {
      key: 'sidetask_open',
      title: '副线任务',
      detail: '除了主线任务，您还会收到副线任务。请点击顶部入口查看。',
      eventType: 'sidetask_open',
      anchor: 'sidetask-toggle',
      requireAction: true,
    },
    {
      key: 'sidetask_answer',
      title: '副线作答',
      detail: '请在副线任务中选择一个答案，体验副线答题流程。',
      eventType: 'sidetask_answer',
      anchor: 'sidetask-options',
      requireAction: true,
    },
  ];
}

function getVisibleAnchor(anchor: string) {
  const nodes = Array.from(document.querySelectorAll(`[data-tutorial-anchor="${anchor}"]`));
  return [...nodes].reverse().find((node) => {
    if (!(node instanceof HTMLElement)) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) as HTMLElement | undefined;
}

// 概览卡片内容（分角色）
function getOverviewContent(role: 'A' | 'B') {
  if (role === 'A') {
    return {
      title: '欢迎进入测试轮',
      sections: [
        {
          heading: '您的角色是尽调员',
          text: '负责对目标公司进行尽职调查并填写尽调表。',
        },
        {
          heading: '工作台布局',
          items: [
            '左侧为材料区，包含公司相关材料',
            '右上为答题区，用于填写您的尽调分析',
            '右下为 AI 助手，可为您提供信息检索和分析支持',
          ],
        },
        {
          heading: '时间安排',
          items: [
            '您将依次处理 3 家公司',
            '每家公司有 5 分钟的尽调时间，时间到后系统将自动提交',
            '提交后，您的尽调信息将解锁给投资经理查看',
          ],
        },
        {
          heading: '副线任务',
          items: [
            '除了主线任务，您还会收到副线任务',
            '顶部会滚动提示"您有新事项入库，请尽快处理"',
            '请合理安排时间处理',
          ],
        },
        {
          heading: '反馈提醒',
          items: ['投资经理的反馈可能会以弹窗形式出现在右下角，请注意查收'],
        },
      ],
    };
  } else {
    return {
      title: '欢迎进入测试轮',
      sections: [
        {
          heading: '您的角色是投资经理',
          text: '负责基于尽调信息和自有材料做出投资决策。',
        },
        {
          heading: '工作台布局',
          items: [
            '左侧为材料区，包含公司相关材料',
            '右上为答题区，用于填写您的投资判断',
            '右下为 AI 助手，可为您提供信息检索和分析支持',
          ],
        },
        {
          heading: '时间安排',
          items: [
            '您将依次处理 3 家公司',
            '每家公司有 20 分钟的处理时间',
            '当尽调员完成尽调表后，您可以在"尽调员信息"标签中查看其填写的内容',
          ],
        },
        {
          heading: '副线任务',
          items: [
            '除了主线任务，您还会收到副线任务',
            '顶部会滚动提示"您有新事项入库，请尽快处理"',
            '请合理安排时间处理',
          ],
        },
      ],
    };
  }
}

export function PracticeTutorialOverlay({
  sessionCode,
  participantId,
  role,
  aiLevel,
  completedSteps = [],
  onCompleted,
}: Props) {
  const steps = useMemo(() => buildSteps(role), [role]);
  const [localCompleted, setLocalCompleted] = useState<string[]>(completedSteps);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);
  const [showOverview, setShowOverview] = useState(completedSteps.length === 0);

  useEffect(() => {
    setLocalCompleted(completedSteps);
  }, [completedSteps]);

  // 如果已完成所有步骤，不显示
  const nextStep = steps.find((step) => !localCompleted.includes(step.key)) ?? null;

  // 概览阶段：不显示遮罩，只显示卡片
  const isOverviewPhase = showOverview && localCompleted.length === 0;

  useEffect(() => {
    if (isOverviewPhase) {
      // 概览阶段不需要高亮
      setHighlightRect(null);
      return;
    }

    function syncHighlight() {
      if (!nextStep) {
        setHighlightRect(null);
        return;
      }
      const target = getVisibleAnchor(nextStep.anchor);
      setHighlightRect(target?.getBoundingClientRect() ?? null);
    }

    syncHighlight();
    window.addEventListener('resize', syncHighlight);
    window.addEventListener('scroll', syncHighlight, true);
    const timer = window.setInterval(syncHighlight, 250);
    return () => {
      window.removeEventListener('resize', syncHighlight);
      window.removeEventListener('scroll', syncHighlight, true);
      window.clearInterval(timer);
    };
  }, [nextStep, isOverviewPhase]);

  useEffect(() => {
    async function markStepDone(stepKey: string) {
      if (localCompleted.includes(stepKey)) return;
      setLocalCompleted((prev) => [...prev, stepKey]);
      await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          stage: 'practice_tutorial_step_completed',
          payload: { stepKey },
        }),
      }).catch(() => {});
      window.dispatchEvent(new CustomEvent('practice-tutorial-local-complete', { detail: { stepKey } }));
    }

    async function onTutorialEvent(event: Event) {
      const detail = (event as CustomEvent<{ type?: string }>).detail;
      if (!detail?.type || detail.type === 'practice_tutorial_step_completed') return;
      const currentStep = steps.find((step) => !localCompleted.includes(step.key));
      if (!currentStep || currentStep.eventType !== detail.type) return;
      await markStepDone(currentStep.key);
    }

    window.addEventListener('practice-tutorial-event', onTutorialEvent as EventListener);
    return () => {
      window.removeEventListener('practice-tutorial-event', onTutorialEvent as EventListener);
    };
  }, [localCompleted, role, sessionCode, steps]);

  useEffect(() => {
    if (steps.length > 0 && localCompleted.length === steps.length) {
      void fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          stage: 'practice_tutorial_completed',
          payload: { totalSteps: steps.length },
        }),
      }).catch(() => {});
      onCompleted?.();
    }
  }, [localCompleted.length, onCompleted, role, sessionCode, steps.length]);

  useEffect(() => {
    if (completedSteps.length === 0) {
      void fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          stage: 'practice_tutorial_started',
          payload: { participantId },
        }),
      }).catch(() => {});
    }
  }, [completedSteps.length, participantId, role, sessionCode]);

  // 所有步骤完成，不显示
  if (!nextStep && !isOverviewPhase) return null;

  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight;

  // 概览卡片：居中显示，无遮罩
  if (isOverviewPhase) {
    const overview = getOverviewContent(role);
    return (
      <div className="pointer-events-none fixed inset-0 z-[80] bg-slate-950/55">
        <div className="pointer-events-auto absolute left-1/2 top-1/2 max-h-[80vh] w-[520px] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/15 bg-white p-6 shadow-2xl">
          <div className="mb-4 text-xl font-bold text-[#1d2129]">{overview.title}</div>
          {overview.sections.map((section, idx) => (
            <div key={idx} className="mb-4">
              <div className="mb-1 text-sm font-semibold text-[#1d2129]">{section.heading}</div>
              {section.text && (
                <div className="text-sm leading-6 text-[#4e5969]">{section.text}</div>
              )}
              {section.items && (
                <ul className="list-disc pl-5 text-sm leading-6 text-[#4e5969]">
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          ))}
          <div className="mt-4 flex justify-end">
            <button
              type="button"
              onClick={() => setShowOverview(false)}
              className="rounded-xl bg-[#1e80ff] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1168e3] active:scale-[0.98]"
            >
              我了解了
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 步骤引导卡片
  const cardTop = highlightRect ? Math.min(viewportHeight - 260, highlightRect.bottom + 16) : 24;
  const cardLeft = highlightRect ? Math.min(viewportWidth - 440, Math.max(16, highlightRect.left)) : 24;
  const isAcknowledgeStep = nextStep?.requireAction === false;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {highlightRect ? (
        <div
          className="absolute rounded-2xl border-[3px] border-[#2563eb] bg-sky-100/60 shadow-[0_0_0_3px_rgba(255,255,255,0.96),0_0_0_10px_rgba(37,99,235,0.45),0_18px_48px_rgba(37,99,235,0.28)] transition-all duration-200"
          style={{
            left: Math.max(8, highlightRect.left - 8),
            top: Math.max(8, highlightRect.top - 8),
            width: Math.min(viewportWidth - 16, highlightRect.width + 16),
            height: Math.min(viewportHeight - 16, highlightRect.height + 16),
          }}
        />
      ) : null}

      <div className="absolute max-w-[420px] px-4" style={{ top: cardTop, left: cardLeft }}>
        <div className="pointer-events-auto rounded-2xl border border-white/15 bg-white p-5 shadow-2xl">
          <div className="mb-2 text-xs font-medium tracking-widest text-[#86909c]">
            教学引导 {localCompleted.length + 1} / {steps.length}
          </div>
          <div className="mb-2 text-lg font-semibold text-[#1d2129]">{nextStep!.title}</div>
          <div className="text-sm leading-7 text-[#4e5969]">{nextStep!.detail}</div>

          {isAcknowledgeStep ? (
            // 需要点击按钮的步骤：显示"我了解了"按钮
            <div className="mt-4">
              <button
                type="button"
                onClick={() => {
                  window.dispatchEvent(
                    new CustomEvent('practice-tutorial-event', { detail: { type: nextStep!.eventType } })
                  );
                }}
                className="rounded-xl bg-[#1e80ff] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1168e3] active:scale-[0.98]"
              >
                我了解了
              </button>
            </div>
          ) : (
            // 其他步骤：显示提示
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-6 text-[#1e80ff]">
              需要你完成真实操作后，系统才会自动进入下一步。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
