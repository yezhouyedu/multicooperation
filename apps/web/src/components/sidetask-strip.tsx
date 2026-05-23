'use client';

import { AiChatPanel } from '@/components/ai-chat-panel';
import { WorkbenchLayout } from '@/components/workbench-layout';
import { useEffect, useMemo, useRef, useState } from 'react';

type SideFeedItem = {
  id: string;
  title: string;
  summary: string;
  material: string[];
  options: string[];
};

type Props = {
  sessionCode: string;
  participantId?: string;
  role: 'A' | 'B';
  phase?: 'practice' | 'formal';
  segmentIndex?: number;
  aiLevel?: 'BASIC' | 'ADVANCED';
  items?: unknown[];
};

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

function buildItems(role: 'A' | 'B', segmentIndex: number) {
  const prefix = role === 'A' ? '尽调协同' : '投资协同';
  return [
    {
      id: `segment-${segmentIndex}-1`,
      title: `${prefix}事项 1`,
      summary: '请快速判断该突发事项对当前任务是否值得额外关注。',
      material: [
        '内部池中新增一条与行业政策相关的信息。',
        '该事项可能影响当前公司所处赛道的监管预期。',
        '请基于当前信息做一个轻量判断。',
      ],
      options: ['需要立即关注', '暂时观察即可', '与当前任务关系不大'],
    },
    {
      id: `segment-${segmentIndex}-2`,
      title: `${prefix}事项 2`,
      summary: '请评估该事项是否需要纳入你当前阶段的判断依据。',
      material: [
        '市场出现新的需求波动线索。',
        '信息尚不完整，但可能影响未来收入与执行节奏。',
        '请做一个简洁的三选一判断。',
      ],
      options: ['建议纳入判断', '仅做备注保留', '暂不纳入判断'],
    },
  ] satisfies SideFeedItem[];
}

export function SideTaskStrip({
  sessionCode,
  participantId,
  role,
  phase = 'formal',
  segmentIndex = 1,
  aiLevel = 'BASIC',
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const [items, setItems] = useState<SideFeedItem[]>(() => buildItems(role, segmentIndex));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const itemsKey = `${role}-${segmentIndex}`;

  // 直接操作 DOM，绕过 React state，避免 re-render 打断 rAF
  const tickerRef = useRef<HTMLButtonElement>(null);
  const rafRef = useRef<number>(0);
  const pauseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);

  useEffect(() => {
    setItems(buildItems(role, segmentIndex));
    setAnswers({});
    setCurrentIndex(0);
  }, [itemsKey, role, segmentIndex]);

  useEffect(() => {
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    cancelAnimationFrame(rafRef.current);
    activeRef.current = true;
    runTicker();
    return () => {
      activeRef.current = false;
      cancelAnimationFrame(rafRef.current);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, [itemsKey]);

  function runTicker() {
    const el = tickerRef.current;
    if (!el) return;

    const SCROLL = 12000;
    const HOLD = 5000;
    const FADE = 2000;
    const PAUSE = 30000;
    const TOTAL = SCROLL + HOLD + FADE;

    // 初始位置
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
        if (activeRef.current) {
          pauseTimerRef.current = setTimeout(() => {
            if (activeRef.current) runTicker();
          }, PAUSE);
        }
      }
    }

    rafRef.current = requestAnimationFrame(tick);
  }

  const currentItem = items[currentIndex] ?? items[0];
  const currentAnswer = currentItem ? answers[currentItem.id] : undefined;
  const remainingCount = useMemo(() => items.filter((item) => !answers[item.id]).length, [items, answers]);

  async function record(stage: string, payload: Record<string, unknown>) {
    if (!sessionCode) return;
    try {
      await fetch(`${serverBaseUrl}/experiment/session/${sessionCode}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, stage, payload }),
      });
    } catch {}
  }

  function openPanel() {
    setExpanded(true);
    void record('side_task_opened', { segmentIndex, phase });
  }

  function choose(option: string) {
    if (!currentItem) return;
    setAnswers((prev) => ({ ...prev, [currentItem.id]: option }));
    void record('side_task_answered', {
      segmentIndex,
      phase,
      itemId: currentItem.id,
      answer: option,
    });
  }

  function move(delta: number) {
    setCurrentIndex((prev) => {
      const next = prev + delta;
      if (next < 0) return 0;
      if (next >= items.length) return items.length - 1;
      return next;
    });
  }

  const sidebar = currentItem ? (
    <div className="space-y-4 p-1 text-sm text-[#4e5969]">
      <div className="rounded-lg border border-[#e5e6eb] bg-blue-50 p-4">
        <div className="mb-2 text-base font-bold text-[#1e80ff]">{currentItem.title}</div>
        <div className="text-sm leading-7">{currentItem.summary}</div>
      </div>
      {currentItem.material.map((paragraph, index) => (
        <div key={`${currentItem.id}-${index}`} className="rounded-lg border border-[#e5e6eb] bg-white p-4 leading-7 shadow-sm">
          {paragraph}
        </div>
      ))}
    </div>
  ) : null;

  const taskPane = currentItem ? (
    <div className="flex h-full flex-col justify-between p-5 text-sm text-[#4e5969]">
      <div>
        <div className="mb-2 text-xs font-bold uppercase tracking-widest text-[#86909c]">副线题目 {currentIndex + 1}/{items.length}</div>
        <div className="mb-5 text-lg font-bold text-[#1d2129]">{currentItem.title}</div>
        <div className="space-y-3">
          {currentItem.options.map((option) => {
            const selected = currentAnswer === option;
            return (
              <button
                key={option}
                type="button"
                onClick={() => choose(option)}
                className={`block w-full rounded-lg border px-4 py-3 text-left transition ${selected ? 'border-[#1e80ff] bg-blue-50 text-[#1e80ff]' : 'border-[#e5e6eb] bg-white hover:border-blue-200 hover:bg-blue-50/50'}`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#e5e6eb] pt-4">
        <div className="text-xs text-[#86909c]">当前工作段剩余待处理副线: {remainingCount}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => move(-1)} className="rounded-lg border border-[#e5e6eb] px-4 py-2 text-sm text-[#4e5969] hover:bg-gray-50">上一题</button>
          <button type="button" onClick={() => move(1)} className="rounded-lg bg-[#1e80ff] px-4 py-2 text-sm font-medium text-white hover:bg-blue-600">下一题</button>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <section className="relative z-20 flex h-12 shrink-0 items-center border-b border-blue-200 bg-blue-50/60 px-4">
        <button
          type="button"
          onClick={openPanel}
          className="mr-4 rounded-md bg-[#ef4444] px-4 py-1.5 text-sm font-bold text-white shadow-sm transition hover:bg-red-600"
        >
          待处理事宜
        </button>

        <div className="relative min-w-0 flex-1 overflow-hidden" style={{ minHeight: 32 }}>
          <button
            ref={tickerRef}
            type="button"
            onClick={openPanel}
            style={{ display: 'none' }}
            className="rounded-full border border-blue-200 bg-white px-4 py-1.5 text-xs text-blue-800 shadow-sm"
          >
            【您有新事项入库，请尽快处理】
          </button>
        </div>
      </section>

      {expanded ? (
        <div className="side-panel-backdrop fixed inset-0 z-50 bg-[#f0f2f5]">
          <div className="side-panel-shell flex h-full flex-col">
            <div className="flex h-12 items-center justify-between border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
              <div className="text-sm font-bold text-[#1d2129]">副线任务处理区</div>
              <button type="button" onClick={() => setExpanded(false)} className="rounded-lg border border-[#e5e6eb] px-3 py-1 text-sm text-[#4e5969] hover:bg-gray-50">
                返回主界面
              </button>
            </div>
            <div className="min-h-0 flex-1 p-2">
              <WorkbenchLayout
                sidebar={sidebar}
                sidebarTitle="副线材料"
                taskPane={taskPane}
                aiPane={participantId ? <AiChatPanel sessionCode={sessionCode} participantId={participantId} role={role} accent={role === 'A' ? 'blue' : 'purple'} contextType="side" phase={phase} segmentIndex={segmentIndex} aiLevel={aiLevel} /> : <div className="p-4 text-sm text-[#86909c]">缺少参与者信息</div>}
                taskTitle="副线作答"
                aiTitle="副线 AI"
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
