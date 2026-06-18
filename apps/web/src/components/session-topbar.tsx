'use client';

import { useExperimentFullscreen } from '@/components/experiment-fullscreen';

export type SessionTopbarProps = {
  roleLabel: string;
  currentLabel: string;
  stageLabel: string;
  countdownLabel: string;
  taskCountdownLabel?: string | null;
  connectionStatus?: 'connecting' | 'connected' | 'reconnecting' | 'polling' | 'offline';
  pendingDraftCount?: number;
};

export function SessionTopbar({
  roleLabel,
  currentLabel,
  stageLabel,
  countdownLabel,
  taskCountdownLabel,
  connectionStatus,
  pendingDraftCount = 0,
}: SessionTopbarProps) {
  useExperimentFullscreen();
  const statusLabel =
    connectionStatus === 'connected'
      ? '网络正常'
      : connectionStatus === 'offline'
        ? '网络异常'
        : connectionStatus === 'polling'
          ? '正在同步'
          : connectionStatus === 'reconnecting'
            ? '正在重连'
            : connectionStatus === 'connecting'
              ? '正在连接'
              : null;
  const statusClass =
    connectionStatus === 'connected'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : connectionStatus === 'offline'
        ? 'border-red-200 bg-red-50 text-red-700'
        : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <nav
      className="flex h-[52px] shrink-0 items-center justify-between border-b border-[#eaecf0] bg-white px-5"
      style={{ boxShadow: 'var(--shadow-topbar)' }}
    >
      <div className="flex min-w-0 items-center gap-3">
        <div className="shrink-0 text-[15px] font-semibold tracking-wide text-[#1e80ff]">AI 投资决策平台</div>
        <div className="h-4 w-px bg-[#eaecf0]" />
        <div className="rounded-md border border-[#eaecf0] bg-[#f5f7fa] px-2.5 py-1 text-xs font-medium text-[#4e5969]">
          {roleLabel}
        </div>
        <div className="hidden truncate rounded-md border border-[#eaecf0] bg-[#f5f7fa] px-2.5 py-1 text-xs font-medium text-[#4e5969] sm:block">
          {currentLabel}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {statusLabel ? (
          <div className={`rounded-md border px-3 py-1 text-xs font-medium ${statusClass}`}>
            {statusLabel}
            {pendingDraftCount > 0 ? ` / 待同步 ${pendingDraftCount} 条` : ''}
          </div>
        ) : null}
        <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-[#1e80ff]">
          {stageLabel}：{countdownLabel}
        </div>
        {taskCountdownLabel ? (
          <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">
            任务剩余：{taskCountdownLabel}
          </div>
        ) : null}
      </div>
    </nav>
  );
}
