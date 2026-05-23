'use client';

import { useExperimentFullscreen } from '@/components/experiment-fullscreen';

export type SessionTopbarProps = {
  roleLabel: string;
  currentLabel: string;
  stageLabel: string;
  countdownLabel: string;
  taskCountdownLabel?: string | null;
};

export function SessionTopbar({
  roleLabel,
  currentLabel,
  stageLabel,
  countdownLabel,
  taskCountdownLabel,
}: SessionTopbarProps) {
  useExperimentFullscreen();

  return (
    <nav className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#e5e6eb] bg-white px-5 shadow-sm">
      <div className="flex min-w-0 items-center gap-4">
        <div className="shrink-0 text-lg font-bold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
        <div className="rounded border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-[#86909c]">
          角色：{roleLabel}
        </div>
        <div className="truncate rounded border border-gray-200 bg-gray-100 px-2.5 py-1 text-xs text-[#86909c]">
          当前项目：{currentLabel}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <div className="rounded border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-[#1e80ff]">
          {stageLabel}：{countdownLabel}
        </div>
        {taskCountdownLabel ? (
          <div className="rounded border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            当前任务剩余时间：{taskCountdownLabel}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
