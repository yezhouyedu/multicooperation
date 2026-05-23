'use client';

import { ReactNode, useEffect, useRef, useState } from 'react';

type LayoutMode = 'split' | 'task' | 'ai' | 'sidebar';

type Props = {
  sidebar: ReactNode;
  sidebarTitle?: string;
  onSidebarCapture?: () => void;
  taskPane: ReactNode;
  aiPane: ReactNode;
  taskTitle: string;
  aiTitle: string;
};

export function WorkbenchLayout({
  sidebar,
  sidebarTitle = '材料区',
  onSidebarCapture,
  taskPane,
  aiPane,
  taskTitle,
  aiTitle,
}: Props) {
  const [mode, setMode] = useState<LayoutMode>('split');
  const [draftStatus, setDraftStatus] = useState<'idle' | 'saved' | 'dirty'>('idle');
  const isSplit = mode === 'split';

  const containerRef = useRef<HTMLDivElement>(null);
  const rightContainerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLElement>(null);
  const taskPanelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const onSaved = () => setDraftStatus('saved');
    const onDirty = () => setDraftStatus((current) => (current === 'saved' ? 'dirty' : current));
    window.addEventListener('workbench-draft-saved', onSaved);
    window.addEventListener('workbench-draft-dirty', onDirty);
    return () => {
      window.removeEventListener('workbench-draft-saved', onSaved);
      window.removeEventListener('workbench-draft-dirty', onDirty);
    };
  }, []);

  function startHorizontalDrag(event: React.MouseEvent) {
    event.preventDefault();
    const container = containerRef.current;
    const leftPanel = leftPanelRef.current;
    if (!container || !leftPanel) return;

    function onMove(nextEvent: MouseEvent) {
      const currentContainer = containerRef.current;
      const currentLeftPanel = leftPanelRef.current;
      if (!currentContainer || !currentLeftPanel) return;
      const rect = currentContainer.getBoundingClientRect();
      const pct = Math.min(72, Math.max(28, ((nextEvent.clientX - rect.left) / rect.width) * 100));
      currentLeftPanel.style.width = `${pct}%`;
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function startVerticalDrag(event: React.MouseEvent) {
    event.preventDefault();
    const rightContainer = rightContainerRef.current;
    const taskPanel = taskPanelRef.current;
    if (!rightContainer || !taskPanel) return;

    function onMove(nextEvent: MouseEvent) {
      const currentRightContainer = rightContainerRef.current;
      const currentTaskPanel = taskPanelRef.current;
      if (!currentRightContainer || !currentTaskPanel) return;
      const rect = currentRightContainer.getBoundingClientRect();
      const pct = Math.min(72, Math.max(28, ((nextEvent.clientY - rect.top) / rect.height) * 100));
      currentTaskPanel.style.height = `${pct}%`;
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function toggle(target: LayoutMode) {
    setMode((prev) => (prev === target ? 'split' : target));
  }

  function fullscreenButton(target: LayoutMode, label = '全屏') {
    const active = mode === target;
    return (
      <button
        type="button"
        onClick={() => toggle(target)}
        className="rounded px-2 py-1 text-xs transition hover:bg-gray-200 hover:text-[#1e80ff]"
      >
        {active ? '退出全屏' : label}
      </button>
    );
  }

  const showSidebar = mode === 'split' || mode === 'sidebar';
  const showTask = mode === 'split' || mode === 'task';
  const showAi = mode === 'split' || mode === 'ai';

  const saveBtnClass =
    draftStatus === 'saved'
      ? 'rounded border border-green-200 bg-green-50 px-2 py-1 text-xs font-bold text-[#28a745] transition'
      : draftStatus === 'dirty'
        ? 'rounded border border-gray-200 bg-gray-50 px-2 py-1 text-xs text-[#86909c] transition hover:bg-gray-100'
        : 'rounded px-2 py-1 text-xs transition hover:bg-gray-200 hover:text-[#28a745]';

  const saveBtnLabel = draftStatus === 'saved' ? '已保存' : '保存草稿';

  return (
    <div ref={containerRef} className="flex h-full min-h-0 overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 gap-2 overflow-hidden">
        <section
          ref={leftPanelRef}
          style={{
            width: mode === 'sidebar' ? '100%' : '42%',
            display: showSidebar ? undefined : 'none',
          }}
          className="flex min-h-0 min-w-0 shrink-0 flex-col overflow-hidden rounded-xl border border-[#e5e6eb] bg-white shadow-sm"
        >
          <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#e5e6eb] bg-gray-50/60 px-4">
            <span className="font-bold text-gray-800">{sidebarTitle}</span>
            <div className="flex items-center gap-1">
              {onSidebarCapture ? (
                <button
                  type="button"
                  onClick={onSidebarCapture}
                  className="rounded px-2 py-1 text-xs transition hover:bg-gray-200 hover:text-[#1e80ff]"
                >
                  截图
                </button>
              ) : null}
              {fullscreenButton('sidebar')}
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-hidden">{sidebar}</div>
        </section>

        {isSplit ? (
          <div
            onMouseDown={startHorizontalDrag}
            className="mx-0.5 flex w-2 shrink-0 cursor-col-resize items-center justify-center rounded bg-transparent transition-colors hover:bg-blue-100"
          >
            <div className="h-12 w-1 rounded-full bg-gray-300" />
          </div>
        ) : null}

        <div
          ref={rightContainerRef}
          style={{ display: showTask || showAi ? undefined : 'none' }}
          className="flex min-h-0 min-w-0 flex-1 flex-col gap-2"
        >
          <section
            ref={taskPanelRef}
            style={{
              height: isSplit ? '50%' : undefined,
              display: showTask ? undefined : 'none',
            }}
            className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-[#e5e6eb] bg-white shadow-sm ${isSplit ? 'shrink-0' : 'flex-1'}`}
          >
            <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#e5e6eb] bg-blue-50/30 px-4">
              <span className="font-bold text-gray-800">{taskTitle}</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('workbench-save-draft'))}
                  className={saveBtnClass}
                >
                  {saveBtnLabel}
                </button>
                {fullscreenButton('task')}
              </div>
            </header>
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{taskPane}</div>
          </section>

          {isSplit ? (
            <div
              onMouseDown={startVerticalDrag}
              className="my-0.5 flex h-2 shrink-0 cursor-row-resize items-center justify-center rounded bg-transparent transition-colors hover:bg-blue-100"
            >
              <div className="h-1 w-12 rounded-full bg-gray-300" />
            </div>
          ) : null}

          <section
            style={{ display: showAi ? undefined : 'none' }}
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-[#e5e6eb] bg-white shadow-sm"
          >
            <header className="flex h-11 shrink-0 items-center justify-between border-b border-[#e5e6eb] bg-purple-50/30 px-4">
              <span className="font-bold text-gray-800">{aiTitle}</span>
              {fullscreenButton('ai')}
            </header>
            <div className="min-h-0 min-w-0 flex-1 overflow-hidden">{aiPane}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
