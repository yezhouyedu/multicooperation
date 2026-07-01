'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

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
  requireAction?: boolean;
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
      detail:
        role === 'A'
          ? '右侧是任务表，请在这里整理并填写你对公司的分析。'
          : '右侧是任务表，请在这里整理并填写你对公司的分析。',
      eventType: 'task_acknowledge',
      anchor: 'task-panel',
      requireAction: false,
    },
    {
      key: 'ai_message',
      title: '使用 AI 助手',
      detail: '这里你可以借助 AI 的辅助完成任务。',
      eventType: 'ai_message',
      anchor: 'ai-input',
      requireAction: false,
    },
    {
      key: 'sidetask_open',
      title: '任务2',
      detail: '除了任务1，你还会收到任务2。请点击顶部入口查看。',
      eventType: 'sidetask_open',
      anchor: 'sidetask-toggle',
      requireAction: true,
    },
    {
      key: 'sidetask_answer',
      title: '任务2作答',
      detail: '请在任务2中选择一个答案，体验任务2答题流程。',
      eventType: 'sidetask_answer',
      anchor: 'sidetask-option',
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

function getOverviewContent(role: 'A' | 'B') {
  if (role === 'A') {
    return {
      title: '欢迎进入测试轮',
      sections: [
        {
          heading: '你的角色是A',
          text: '你需要负责查看材料、整理关键信息，并填写任务表。',
        },
        {
          heading: '工作台布局',
          items: [
            '左侧是材料区，用于查看公司相关资料',
            '右上是答题区，用于填写A内容',
            '右下是 AI 区，可辅助你整理信息和分析问题。正式实验可用，测试轮不可用',
          ],
        },
        {
          heading: '时间安排',
          items: [
            '测试轮先只做一家公司',
            '正式实验中每家公司有固定工作时长',
            '角色A的任务表会在 5 分钟后自动提交',
          ],
        },
        {
          heading: '任务2',
          items: [
            '除了任务1，你还会收到任务2',
            '顶部会提示“您有新事项入库，请尽快处理”',
            '请合理安排时间处理任务1和任务2',
            '正式实验可用，测试轮无任务2',
          ],
        },
      ],
    };
  }

  return {
    title: '欢迎进入测试轮',
    sections: [
      {
        heading: '你的角色是B',
        text: '你需要结合自有材料、A信息和自己的判断做出投资决策。',
      },
      {
        heading: '工作台布局',
        items: [
          '左侧是材料区，用于查看公司相关资料',
          '右上是答题区，用于填写投资判断',
          '右下是 AI 区，可辅助你整理信息和分析问题。正式实验可用，测试轮不可用',
        ],
      },
      {
        heading: '时间安排',
        items: [
          '测试轮先只做一家公司',
          '正式实验每家公司的工作时长不限，测试轮为5分钟时自动保存提交。',
          '角色A提交后，你可以查看角色A提交的信息',
        ],
      },
      {
        heading: '任务2',
        items: [
          '除了任务1，你还会收到任务2',
          '顶部会提示“您有新事项入库，请尽快处理”',
          '请合理安排时间处理任务1和任务2',
          '正式实验可用，测试轮无任务2',
        ],
      },
    ],
  };
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
  const [completionRecorded, setCompletionRecorded] = useState(completedSteps.length === steps.length);
  const [showCompletionCard, setShowCompletionCard] = useState(false);

  useEffect(() => {
    setLocalCompleted(completedSteps);
    setCompletionRecorded(completedSteps.length === steps.length);
  }, [completedSteps, steps.length]);

  const nextStep = steps.find((step) => !localCompleted.includes(step.key)) ?? null;
  const isOverviewPhase = showOverview && localCompleted.length === 0;

  const markStepDone = useCallback(
    async (stepKey: string) => {
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
    },
    [localCompleted, role, sessionCode],
  );

  useEffect(() => {
    if (isOverviewPhase) {
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
  }, [isOverviewPhase, nextStep]);

  useEffect(() => {
    async function onTutorialEvent(event: Event) {
      const detail = (event as CustomEvent<{ type?: string; userInitiated?: boolean }>).detail;
      if (!detail?.type || detail.type === 'practice_tutorial_step_completed') return;
      const currentStep = steps.find((step) => !localCompleted.includes(step.key));
      if (!currentStep || currentStep.eventType !== detail.type) return;
      if (currentStep.requireAction === false) return;
      if (!detail.userInitiated) return;
      await markStepDone(currentStep.key);
    }

    window.addEventListener('practice-tutorial-event', onTutorialEvent as EventListener);
    return () => {
      window.removeEventListener('practice-tutorial-event', onTutorialEvent as EventListener);
    };
  }, [localCompleted, markStepDone, steps]);

  useEffect(() => {
    if (!completionRecorded && steps.length > 0 && localCompleted.length === steps.length) {
      window.dispatchEvent(new CustomEvent('practice-tutorial-return-main'));
      setCompletionRecorded(true);
      setShowCompletionCard(true);
    }
  }, [completionRecorded, localCompleted.length, steps.length]);

  useEffect(() => {
    if (completedSteps.length === 0) {
      void fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role,
          stage: 'practice_tutorial_started',
          payload: { participantId, aiLevel },
        }),
      }).catch(() => {});
    }
  }, [aiLevel, completedSteps.length, participantId, role, sessionCode]);

  if (!nextStep && !isOverviewPhase && !showCompletionCard) return null;

  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight;

  if (isOverviewPhase) {
    const overview = getOverviewContent(role);
    return (
      <div className="pointer-events-none fixed inset-0 z-[80] bg-slate-950/55">
        <div className="pointer-events-auto absolute left-1/2 top-1/2 max-h-[80vh] w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl border border-white/15 bg-white p-6 shadow-2xl">
          <div className="mb-4 text-xl font-bold text-[#1d2129]">{overview.title}</div>
          {overview.sections.map((section, idx) => (
            <div key={idx} className="mb-4">
              <div className="mb-1 text-sm font-semibold text-[#1d2129]">{section.heading}</div>
              {section.text ? <div className="text-sm leading-6 text-[#4e5969]">{section.text}</div> : null}
              {section.items ? (
                <ul className="list-disc pl-5 text-sm leading-6 text-[#4e5969]">
                  {section.items.map((item, itemIndex) => (
                    <li key={itemIndex}>{item}</li>
                  ))}
                </ul>
              ) : null}
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

  if (showCompletionCard) {
    return (
      <div className="pointer-events-none fixed inset-0 z-[80] bg-slate-950/55">
        <div className="pointer-events-auto absolute left-1/2 top-1/2 w-[520px] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/15 bg-white p-6 shadow-2xl">
          <div className="mb-2 text-xs font-medium tracking-widest text-[#86909c]">教学引导已完成</div>
          <div className="mb-3 text-xl font-semibold text-[#1d2129]">下一步正式进入测试轮</div>
          <div className="text-sm leading-7 text-[#4e5969]">
            请你完成本公司的相关调研，并继续使用刚才体验过的材料区、答题区、AI 区和任务2功能。
          </div>
          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={async () => {
                await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/progress`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    role,
                    stage: 'practice_tutorial_completed',
                    payload: { totalSteps: steps.length },
                  }),
                }).catch(() => {});
                setShowCompletionCard(false);
                onCompleted?.();
              }}
              className="rounded-xl bg-[#1e80ff] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1168e3] active:scale-[0.98]"
            >
              开始测试轮
            </button>
          </div>
        </div>
      </div>
    );
  }

  const cardTop = highlightRect ? Math.min(viewportHeight - 260, highlightRect.bottom + 16) : 24;
  const cardLeft = highlightRect ? Math.min(viewportWidth - 440, Math.max(16, highlightRect.left)) : 24;
  const isAcknowledgeStep = nextStep?.requireAction === false;
  const holeLeft = highlightRect ? Math.max(8, highlightRect.left - 8) : 0;
  const holeTop = highlightRect ? Math.max(8, highlightRect.top - 8) : 0;
  const holeWidth = highlightRect ? Math.min(viewportWidth - 16, highlightRect.width + 16) : 0;
  const holeHeight = highlightRect ? Math.min(viewportHeight - 16, highlightRect.height + 16) : 0;
  const holeRight = holeLeft + holeWidth;
  const holeBottom = holeTop + holeHeight;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80]">
      {highlightRect ? (
        <>
          <div className="absolute inset-x-0 top-0 bg-slate-950/55" style={{ height: holeTop }} />
          <div className="absolute left-0 bg-slate-950/55" style={{ top: holeTop, width: holeLeft, height: holeHeight }} />
          <div className="absolute bg-slate-950/55" style={{ top: holeTop, left: holeRight, right: 0, height: holeHeight }} />
          <div className="absolute inset-x-0 bg-slate-950/55" style={{ top: holeBottom, bottom: 0 }} />
        </>
      ) : (
        <div className="absolute inset-0 bg-slate-950/55" />
      )}

      {highlightRect ? (
        <div
          className="absolute rounded-2xl border-[3px] border-[#60a5fa] bg-transparent shadow-[0_0_0_3px_rgba(255,255,255,0.96),0_0_28px_rgba(96,165,250,0.45)] transition-all duration-200"
          style={{
            left: holeLeft,
            top: holeTop,
            width: holeWidth,
            height: holeHeight,
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
            <div className="mt-4">
              <button
                type="button"
                onClick={() => void markStepDone(nextStep!.key)}
                className="rounded-xl bg-[#1e80ff] px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1168e3] active:scale-[0.98]"
              >
                我了解了
              </button>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-6 text-[#1e80ff]">
              需要你完成真实操作后，系统才会自动进入下一步。
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
