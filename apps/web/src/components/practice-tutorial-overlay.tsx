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
};

function buildSteps(aiLevel: 'BASIC' | 'ADVANCED'): Step[] {
  const base: Step[] = [
    { key: 'material_tab', title: '切换材料标签', detail: '请先点击任意一个材料标签，确认你知道材料区如何切换。', eventType: 'material_tab', anchor: 'material-panel' },
    { key: 'material_fullscreen', title: '材料区全屏', detail: '请点击材料区右上角的全屏按钮。', eventType: 'material_fullscreen', anchor: 'material-panel' },
    { key: 'material_zoom', title: '材料区缩放', detail: '请使用材料区缩放按钮或 Ctrl +/- 调整缩放。', eventType: 'material_zoom', anchor: 'material-panel' },
    { key: 'task_input', title: '答题区输入', detail: '请在答题区输入任意一项内容。', eventType: 'task_input', anchor: 'task-panel' },
    { key: 'task_fullscreen', title: '答题区全屏', detail: '请点击答题区右上角的全屏按钮。', eventType: 'task_fullscreen', anchor: 'task-panel' },
    { key: 'ai_message', title: '主线 AI 发消息', detail: '请在主线 AI 输入框里发送一条消息。', eventType: 'ai_message', anchor: 'ai-panel' },
    { key: 'ai_fullscreen', title: 'AI 区全屏', detail: '请点击 AI 区右上角的全屏按钮。', eventType: 'ai_fullscreen', anchor: 'ai-panel' },
    { key: 'layout_resize', title: '拖拽调整布局', detail: '请拖拽分隔条，调整各区域面积。', eventType: 'layout_resize', anchor: 'task-panel' },
  ];

  if (aiLevel === 'ADVANCED') {
    base.push({
      key: 'ai_screenshot',
      title: '高级 AI 截图',
      detail: '请点击材料区截图入口，确认你知道截图功能在哪里。',
      eventType: 'ai_screenshot',
      anchor: 'material-panel',
    });
  }

  base.push(
    { key: 'sidetask_open', title: '打开副线任务区', detail: '请点击顶部副线入口，打开副线任务界面。', eventType: 'sidetask_open', anchor: 'sidetask-toggle' },
    { key: 'sidetask_answer', title: '副线作答', detail: '请在副线任务区选择一个答案。', eventType: 'sidetask_answer', anchor: 'task-panel' },
    { key: 'sidetask_ai', title: '副线 AI', detail: '请在副线 AI 中发送一条消息。', eventType: 'sidetask_ai', anchor: 'ai-panel' },
  );

  return base;
}

function getVisibleAnchor(anchor: string) {
  const nodes = Array.from(document.querySelectorAll(`[data-tutorial-anchor="${anchor}"]`));
  return [...nodes].reverse().find((node) => {
    if (!(node instanceof HTMLElement)) return false;
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }) as HTMLElement | undefined;
}

export function PracticeTutorialOverlay({
  sessionCode,
  participantId,
  role,
  aiLevel,
  completedSteps = [],
  onCompleted,
}: Props) {
  const steps = useMemo(() => buildSteps(aiLevel), [aiLevel]);
  const [localCompleted, setLocalCompleted] = useState<string[]>(completedSteps);
  const [highlightRect, setHighlightRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    setLocalCompleted(completedSteps);
  }, [completedSteps]);

  const nextStep = steps.find((step) => !localCompleted.includes(step.key)) ?? null;

  useEffect(() => {
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
  }, [nextStep]);

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

    async function onDraftDirty() {
      const currentStep = steps.find((step) => !localCompleted.includes(step.key));
      if (!currentStep || currentStep.key !== 'task_input') return;
      await markStepDone(currentStep.key);
    }

    window.addEventListener('practice-tutorial-event', onTutorialEvent as EventListener);
    window.addEventListener('workbench-draft-dirty', onDraftDirty as EventListener);
    return () => {
      window.removeEventListener('practice-tutorial-event', onTutorialEvent as EventListener);
      window.removeEventListener('workbench-draft-dirty', onDraftDirty as EventListener);
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

  if (!nextStep) return null;

  const viewportWidth = typeof window === 'undefined' ? 1280 : window.innerWidth;
  const viewportHeight = typeof window === 'undefined' ? 720 : window.innerHeight;
  const cardTop = highlightRect ? Math.min(viewportHeight - 260, highlightRect.bottom + 16) : 24;
  const cardLeft = highlightRect ? Math.min(viewportWidth - 440, Math.max(16, highlightRect.left)) : 24;

  return (
    <div className="pointer-events-none fixed inset-0 z-[80] bg-slate-950/55">
      {highlightRect ? (
        <div
          className="absolute rounded-2xl border-2 border-[#60a5fa] bg-white/10 shadow-[0_0_0_9999px_rgba(2,6,23,0.55)] transition-all duration-200"
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
          <div className="mb-2 text-lg font-semibold text-[#1d2129]">{nextStep.title}</div>
          <div className="text-sm leading-7 text-[#4e5969]">{nextStep.detail}</div>
          <div className="mt-4 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs leading-6 text-[#1e80ff]">
            需要你完成真实操作后，系统才会自动进入下一步。
          </div>
        </div>
      </div>
    </div>
  );
}
