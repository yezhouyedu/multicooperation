'use client';

import { AiChatPanel } from '@/components/ai-chat-panel';
import { WorkbenchLayout } from '@/components/workbench-layout';
import { idempotencyHeaders } from '@/lib/idempotency';
import { RuntimeState } from '@/lib/session-runtime';
import { recordTimestampEvent } from '@/lib/timestamp-events';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type QueueItem = RuntimeState['sideTaskQueue'][number];
type SideTaskConfig = RuntimeState['sideTaskConfig'];

type Props = {
  sessionCode: string;
  participantId?: string;
  role: 'A' | 'B';
  aiLevel?: 'BASIC' | 'ADVANCED';
  sideTaskQueue: QueueItem[];
  sideTaskConfig: SideTaskConfig;
  phase?: 'practice' | 'formal';
  segmentIndex?: number;
};

export function SideTaskStrip({
  sessionCode,
  participantId,
  role,
  aiLevel = 'BASIC',
  sideTaskQueue,
  sideTaskConfig,
  phase = 'formal',
  segmentIndex = 0,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [optimisticAnswers, setOptimisticAnswers] = useState<Record<string, string>>({});

  // Track known planIds for detecting new arrivals
  const knownPlanIdsRef = useRef<Set<string>>(new Set());

  // Ticker animation refs
  const tickerRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number>(0);
  const activeRef = useRef(false);
  const handledPulseIdsRef = useRef<Set<string>>(new Set());

  // Detect new arrivals and report side_task_released
  const reportReleased = useCallback(
    async (planIds: string[]) => {
      if (!participantId || planIds.length === 0) return;
      for (const planId of planIds) {
        try {
          await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/sidetask/${planId}/exposure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ participantId, eventType: 'side_task_released' }),
          });
        } catch {
          // ignore network errors for exposure reporting
        }
      }
    },
    [participantId, sessionCode],
  );

  // On queue change, detect new planIds
  useEffect(() => {
    const known = knownPlanIdsRef.current;
    const newPlanIds: string[] = [];
    for (const item of sideTaskQueue) {
      if (!known.has(item.planId)) {
        known.add(item.planId);
        newPlanIds.push(item.planId);
      }
    }
    if (newPlanIds.length > 0) {
      void reportReleased(newPlanIds);
    }
  }, [sideTaskQueue, reportReleased]);

  useEffect(() => {
    function handleReturnMain() {
      setExpanded(false);
    }

    window.addEventListener('practice-tutorial-return-main', handleReturnMain);
    return () => {
      window.removeEventListener('practice-tutorial-return-main', handleReturnMain);
    };
  }, []);

  useEffect(() => {
    if (!expanded) return;
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.shiftKey) return;
      event.preventDefault();
      setExpanded(false);
      setSelectedPlanId(null);
    }

    window.addEventListener('keydown', handleEscape, true);
    return () => window.removeEventListener('keydown', handleEscape, true);
  }, [expanded]);

  // Merge server answers with optimistic answers
  const effectiveQueue = useMemo(
    () =>
      sideTaskQueue.map((item) => ({
        ...item,
        answered: item.answered || !!optimisticAnswers[item.planId],
        answer: item.answer ?? optimisticAnswers[item.planId] ?? null,
      })),
    [sideTaskQueue, optimisticAnswers],
  );

  const reportNotified = useCallback(
    async (planIds: string[], pulse: NonNullable<SideTaskConfig['notificationPulse']>, displayed: boolean) => {
      if (!participantId || planIds.length === 0) return;
      for (const planId of planIds) {
        try {
          await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/sidetask/${planId}/exposure`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              participantId,
              eventType: 'side_task_notified',
              payload: {
                pulseId: pulse.id,
                reason: pulse.reason,
                newCount: pulse.newCount,
                windowStart: pulse.windowStart,
                windowEnd: pulse.windowEnd,
                displayed,
              },
            }),
          });
        } catch {
          // ignore network errors for exposure reporting
        }
      }
    },
    [participantId, sessionCode],
  );

  const pendingItems = useMemo(() => effectiveQueue.filter((i) => !i.answered), [effectiveQueue]);
  const answeredItems = useMemo(() => effectiveQueue.filter((i) => i.answered), [effectiveQueue]);
  const pendingCount = pendingItems.length;

  useEffect(() => {
    if (pendingCount !== 0) return;
    activeRef.current = false;
    cancelAnimationFrame(rafRef.current);
    const el = tickerRef.current;
    if (!el) return;
    el.style.display = 'none';
    el.style.opacity = '0';
    el.style.left = '100%';
  }, [pendingCount]);

  // Play one ticker pass for each server-side notification pulse.
  useEffect(() => {
    const pulse = sideTaskConfig.notificationPulse;
    if (!pulse || handledPulseIdsRef.current.has(pulse.id)) return;
    handledPulseIdsRef.current.add(pulse.id);

    if (expanded || pendingCount === 0) {
      const el = tickerRef.current;
      if (el) el.style.display = 'none';
      void reportNotified(pulse.planIds, pulse, false);
      return;
    }

    const el = tickerRef.current;
    if (!el) return;

    cancelAnimationFrame(rafRef.current);
    activeRef.current = true;
    void reportNotified(pulse.planIds, pulse, true);

    const SCROLL = sideTaskConfig.scrollDurationSec * 1000;
    const HOLD = sideTaskConfig.holdSec * 1000;
    const FADE = sideTaskConfig.fadeSec * 1000;
    const TOTAL = SCROLL + HOLD + FADE;

    el.style.display = '';
    el.style.position = 'absolute';
    el.style.top = '50%';
    el.style.transform = 'translateY(-50%)';
    el.style.whiteSpace = 'nowrap';
    el.style.left = '100%';
    el.style.opacity = '1';

    const t0 = performance.now();

    function tick(now: number) {
      if (!activeRef.current) return;
      const e = now - t0;

      if (e < SCROLL) {
        el!.style.left = `${100 * (1 - e / SCROLL)}%`;
        el!.style.opacity = '1';
        rafRef.current = requestAnimationFrame(tick);
      } else if (e < SCROLL + HOLD) {
        el!.style.left = '0%';
        el!.style.opacity = '1';
        rafRef.current = requestAnimationFrame(tick);
      } else if (e < TOTAL) {
        el!.style.left = '0%';
        el!.style.opacity = String(1 - (e - SCROLL - HOLD) / FADE);
        rafRef.current = requestAnimationFrame(tick);
      } else {
        el!.style.display = 'none';
        activeRef.current = false;
      }
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
    };
  }, [
    expanded,
    pendingCount,
    reportNotified,
    sideTaskConfig.fadeSec,
    sideTaskConfig.holdSec,
    sideTaskConfig.notificationPulse,
    sideTaskConfig.scrollDurationSec,
  ]);

  // Auto-select first unanswered when opening
  useEffect(() => {
    if (expanded && !selectedPlanId && pendingItems.length > 0) {
      setSelectedPlanId(pendingItems[0].planId);
    }
  }, [expanded, selectedPlanId, pendingItems]);

  const selectedItem = effectiveQueue.find((i) => i.planId === selectedPlanId) ?? null;

  async function answerSideTask(planId: string, answer: string) {
    // Optimistic update
    setOptimisticAnswers((prev) => ({ ...prev, [planId]: answer }));
    window.dispatchEvent(
      new CustomEvent('practice-tutorial-event', {
        detail: { type: 'sidetask_answer', planId, userInitiated: true },
      }),
    );

    // Auto-advance to next unanswered
    const currentIdx = pendingItems.findIndex((i) => i.planId === planId);
    if (currentIdx >= 0 && currentIdx < pendingItems.length - 1) {
      setSelectedPlanId(pendingItems[currentIdx + 1].planId);
    }

    try {
      void recordTimestampEvent({
        sessionCode,
        participantId,
        role,
        eventType: 'side_activity',
        sideTaskPlanId: planId,
        phase,
        segmentIndex,
        payload: { activityKind: 'answer', answer },
      });
      await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/sidetask/${planId}/answer`, {
        method: 'POST',
        headers: idempotencyHeaders(`side-task-answer:${sessionCode}:${participantId}:${planId}`, {
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ participantId, answer }),
      });
    } catch {
      // Server will reconcile via SSE
    }
  }

  function openPanel() {
    setExpanded(true);
    window.dispatchEvent(
      new CustomEvent('practice-tutorial-event', { detail: { type: 'sidetask_open', userInitiated: true } }),
    );
    // Report opened exposure
    if (participantId) {
      const firstPlanId = pendingItems[0]?.planId ?? sideTaskQueue[0]?.planId ?? null;
      void recordTimestampEvent({
        sessionCode,
        participantId,
        role,
        eventType: 'side_area_entered',
        sideTaskPlanId: firstPlanId,
        phase,
        segmentIndex,
        payload: { source: 'side_task_panel_open' },
      });
      void recordTimestampEvent({
        sessionCode,
        participantId,
        role,
        eventType: 'side_activity',
        sideTaskPlanId: firstPlanId,
        phase,
        segmentIndex,
        payload: { activityKind: 'open' },
      });
      // Report all currently visible items as opened
      for (const item of sideTaskQueue) {
        void fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/sidetask/${item.planId}/exposure`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ participantId, eventType: 'side_task_opened' }),
        }).catch(() => {});
      }
    }
  }

  const tickerCount = sideTaskConfig.notificationPulse?.newCount ?? pendingCount;
  const tickerMessage = sideTaskConfig.tickerMessage.replace('N', String(tickerCount));

  // Queue list sidebar
  const sidebar = (
    <div className="flex h-full flex-col text-sm">
      <div className="border-b border-[#e5e6eb] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#86909c]">
        待处理 ({pendingItems.length})
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {pendingItems.map((item, index) => (
          <button
            key={item.planId}
            type="button"
            onClick={() => setSelectedPlanId(item.planId)}
            className={`block w-full border-b border-[#f0f1f2] px-4 py-3 text-left transition ${
              selectedPlanId === item.planId ? 'bg-blue-50 text-[#1e80ff]' : 'text-[#4e5969] hover:bg-gray-50'
            }`}
          >
            <div className="text-xs text-[#86909c]">#{item.queueOrder}</div>
            <div className="mt-0.5 line-clamp-2 font-medium">{item.text}</div>
          </button>
        ))}
        {pendingItems.length === 0 && (
          <div className="px-4 py-6 text-center text-xs text-[#c9cdd4]">暂无待处理事项</div>
        )}
      </div>

      {answeredItems.length > 0 && (
        <>
          <div className="border-t border-[#e5e6eb] px-4 py-2 text-xs font-bold uppercase tracking-widest text-[#86909c]">
            已处理 ({answeredItems.length})
          </div>
          <div className="max-h-48 overflow-y-auto">
            {answeredItems.map((item) => (
              <button
                key={item.planId}
                type="button"
                onClick={() => setSelectedPlanId(item.planId)}
                className={`block w-full border-b border-[#f0f1f2] px-4 py-2 text-left text-xs transition ${
                  selectedPlanId === item.planId ? 'bg-blue-50 text-[#1e80ff]' : 'text-[#c9cdd4] hover:bg-gray-50'
                }`}
              >
                <span className="line-clamp-1">#{item.queueOrder} {item.text}</span>
                <span className="ml-1 text-green-500">✓</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );

  // Detail pane
  const taskPane = selectedItem ? (
    <div className="flex h-full min-h-0 flex-col p-5 text-sm text-[#4e5969]">
      <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[#86909c]">
          副线题目 #{selectedItem.queueOrder}
          {selectedItem.answered && <span className="ml-2 text-green-500">已作答</span>}
        </div>
        <div className="mb-4 leading-7">{selectedItem.text}</div>
        <div className="mb-5 text-base font-bold text-[#1d2129]">{selectedItem.question}</div>
        <div data-tutorial-anchor="sidetask-options" className="space-y-3">
          {[selectedItem.optionA, selectedItem.optionB].map((option, optionIndex) => {
            const selected = selectedItem.answer === option;
            return (
              <button
                key={option}
                type="button"
                data-tutorial-anchor={!selectedItem.answered && optionIndex === 0 ? 'sidetask-option' : undefined}
                onClick={() => !selectedItem.answered && answerSideTask(selectedItem.planId, option)}
                disabled={selectedItem.answered}
                className={`block w-full rounded-lg border px-4 py-3 text-left transition ${
                  selected
                    ? 'border-[#1e80ff] bg-blue-50 text-[#1e80ff]'
                    : selectedItem.answered
                      ? 'border-[#e5e6eb] bg-gray-50 text-[#c9cdd4] cursor-not-allowed'
                      : 'border-[#e5e6eb] bg-white hover:border-blue-200 hover:bg-blue-50/50'
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-4 flex shrink-0 items-center justify-between border-t border-[#e5e6eb] pt-4">
        <div className="text-xs text-[#86909c]">
          待处理: {pendingCount} / {sideTaskConfig.totalPlanned}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              const idx = effectiveQueue.findIndex((i) => i.planId === selectedPlanId);
              if (idx > 0) setSelectedPlanId(effectiveQueue[idx - 1].planId);
            }}
            disabled={!selectedPlanId || effectiveQueue.findIndex((i) => i.planId === selectedPlanId) <= 0}
            className="rounded-lg border border-[#e5e6eb] px-4 py-2 text-sm text-[#4e5969] hover:bg-gray-50 disabled:cursor-not-allowed disabled:text-[#c9cdd4]"
          >
            上一题
          </button>
          <button
            type="button"
            onClick={() => {
              const idx = effectiveQueue.findIndex((i) => i.planId === selectedPlanId);
              if (idx < effectiveQueue.length - 1) setSelectedPlanId(effectiveQueue[idx + 1].planId);
            }}
            disabled={!selectedPlanId || effectiveQueue.findIndex((i) => i.planId === selectedPlanId) >= effectiveQueue.length - 1}
            className="rounded-lg bg-[#1e80ff] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            下一题
          </button>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex h-full items-center justify-center text-sm text-[#86909c]">暂无题目</div>
  );

  return (
    <>
      <section className="relative z-20 flex h-12 shrink-0 items-center overflow-hidden border-b border-blue-200 bg-blue-50/60 px-4">
        <button
          type="button"
          onClick={openPanel}
          data-tutorial-anchor="sidetask-toggle"
          className="mr-4 rounded-md bg-[#ef4444] px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-600"
        >
          {sideTaskConfig.pendingLabel} ({pendingCount})
        </button>

        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ minHeight: 32 }}>
          <button
            ref={tickerRef}
            type="button"
            onClick={openPanel}
            style={{ display: 'none' }}
            className="max-w-full rounded-full border border-blue-200 bg-white px-4 py-1.5 text-xs text-blue-800 shadow-sm"
          >
            【{tickerMessage}】
          </button>
        </div>
      </section>

      {expanded ? (
        <div className="side-panel-backdrop fixed inset-0 z-50 bg-[#f0f2f5]">
          <div className="side-panel-shell flex h-full flex-col">
            <div className="flex h-12 items-center justify-between border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
              <div className="text-sm font-bold text-[#1d2129]">
                副线任务处理区
                <span className="ml-3 text-xs font-normal text-[#86909c]">
                  {sideTaskConfig.dispatchMode === 'continuous' ? '持续到达' : '批量到达'} ·
                  已到 {sideTaskConfig.totalReleased} / {sideTaskConfig.totalPlanned}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  void recordTimestampEvent({
                    sessionCode,
                    participantId,
                    role,
                    eventType: 'main_area_returned',
                    sideTaskPlanId: selectedPlanId,
                    phase,
                    segmentIndex,
                    payload: { source: 'return_button' },
                  });
                  window.dispatchEvent(new CustomEvent('timestamp-anchor', { detail: { anchorType: 'side_return' } }));
                  setExpanded(false);
                  setSelectedPlanId(null);
                }}
                className="rounded-lg border border-[#e5e6eb] px-3 py-1 text-sm text-[#4e5969] hover:bg-gray-50"
              >
                返回主界面
              </button>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <WorkbenchLayout
                sidebar={sidebar}
                sidebarTitle="副线队列"
                taskPane={taskPane}
                aiPane={
                  participantId ? (
                    <AiChatPanel
                      sessionCode={sessionCode}
                      participantId={participantId}
                      role={role}
                      accent={role === 'A' ? 'blue' : 'purple'}
                      contextType="side"
                      sideTaskPlanId={selectedPlanId ?? undefined}
                      phase={phase}
                      segmentIndex={segmentIndex}
                      aiLevel={aiLevel}
                    />
                  ) : (
                    <div className="p-4 text-sm text-[#86909c]">缺少参与者信息</div>
                  )
                }
                taskTitle="副线作答"
                aiTitle="AI助手"
              />
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .side-panel-backdrop {
          animation: sidePanelFade 180ms ease-out both;
        }

        .side-panel-shell {
          animation: sidePanelEnter 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both;
          transform-origin: top center;
        }

        @keyframes sidePanelFade {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }

        @keyframes sidePanelEnter {
          from {
            opacity: 0;
            transform: translateY(12px) scale(0.992);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </>
  );
}
