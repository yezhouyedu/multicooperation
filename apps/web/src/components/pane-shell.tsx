'use client';

import { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  tint?: 'blue' | 'purple';
  mode: 'split' | 'task' | 'ai';
  self: 'task' | 'ai';
  onExpand: () => void;
  onRestore: () => void;
  children: ReactNode;
};

export function PaneShell({ title, subtitle, tint = 'blue', mode, self, onExpand, onRestore, children }: Props) {
  const tintClass = tint === 'blue' ? 'bg-blue-50/30' : 'bg-purple-50/30';
  const expanded = mode === self;

  return (
    <>
      <header className={`flex h-11 shrink-0 items-center justify-between border-b border-[#e5e6eb] px-4 ${tintClass}`}>
        <div className="font-bold text-gray-800">{title}</div>
        <div className="flex items-center gap-3">
          {subtitle ? <div className="text-xs text-[#86909c]">{subtitle}</div> : null}
          <button
            type="button"
            onClick={expanded ? onRestore : onExpand}
            className="rounded px-2 py-1 text-xs text-[#86909c] transition hover:bg-gray-200 hover:text-[#1e80ff]"
          >
            {expanded ? '还原' : '放大'}
          </button>
        </div>
      </header>
      <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
    </>
  );
}
