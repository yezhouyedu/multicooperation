'use client';

import { AFeedbackNotification } from '@/components/a-feedback-notification';
import { AiChatPanel } from '@/components/ai-chat-panel';
import { ATaskEditor } from '@/components/a-task-editor';
import { CompanyMaterialPanel, type CompanyMaterialPanelHandle } from '@/components/company-material-panel';
import { ScopedZoomSurface } from '@/components/scoped-zoom-surface';
import { SessionTopbar } from '@/components/session-topbar';
import { SideTaskStrip } from '@/components/sidetask-strip';
import { WorkbenchLayout } from '@/components/workbench-layout';
import { useSessionRuntime, useTaskDraft } from '@/lib/session-runtime';
import { useRouter } from 'next/navigation';
import { useEffect, useRef } from 'react';

export default function WorkspaceAPage() {
  const router = useRouter();
  const materialPanelRef = useRef<CompanyMaterialPanelHandle>(null);
  const finalFlushTaskRef = useRef<string | null>(null);
  const { bootstrap, runtime, loading, countdownLabel, taskCountdownLabel, taskCountdown } = useSessionRuntime();
  const currentTaskId = runtime?.currentTask?.id;
  const { draft: taskDraft } = useTaskDraft(bootstrap?.sessionCode, currentTaskId, 'A', 'main');

  const redirectPath =
    !loading && !bootstrap
      ? '/login'
      : !loading && runtime?.assignedRole === 'B'
        ? '/workspace/b'
        : !loading && runtime?.phase === 'practice_ready'
          ? runtime.syncState?.selfReady
            ? '/ready?target=practice'
            : null
          : !loading && runtime?.phase === 'practice'
            ? '/practice'
            : !loading && runtime?.phase === 'formal_ready'
              ? runtime.syncState?.selfReady
                ? '/ready?target=formal'
                : null
              : !loading && runtime?.phase === 'formal_break'
                ? '/break'
                : !loading && runtime?.phase === 'end'
                  ? '/workspace/end'
                  : null;

  useEffect(() => {
    if (redirectPath) router.replace(redirectPath);
  }, [redirectPath, router]);

  useEffect(() => {
    if (!currentTaskId) {
      finalFlushTaskRef.current = null;
      return;
    }
    if (taskCountdown === null || taskCountdown > 1) return;
    if (finalFlushTaskRef.current === currentTaskId) return;
    finalFlushTaskRef.current = currentTaskId;
    window.dispatchEvent(new CustomEvent('workbench-save-draft'));
  }, [currentTaskId, taskCountdown]);

  if (redirectPath) return null;

  const company = runtime?.currentTask?.company;

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#f0f2f5] text-sm text-[#1d2129]">
      <div className="flex h-full flex-col">
        <SessionTopbar
          roleLabel="尽调员"
          currentLabel={company?.name ?? '当前项目'}
          stageLabel="当前阶段剩余时间"
          countdownLabel={countdownLabel}
          taskCountdownLabel={taskCountdownLabel}
        />
        {bootstrap && runtime ? (
          <SideTaskStrip
            sessionCode={bootstrap.sessionCode}
            participantId={bootstrap.participantId}
            role="A"
            aiLevel={runtime.aiLevel}
            sideTaskQueue={runtime.sideTaskQueue}
            sideTaskConfig={runtime.sideTaskConfig}
          />
        ) : null}
        <div className="min-h-0 flex-1 p-2">
          {!company || !runtime?.currentTask ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-[#e5e6eb] bg-white text-sm text-[#86909c] shadow-sm">
              当前工作段没有可处理的项目。
            </div>
          ) : (
            <WorkbenchLayout
              key={runtime.currentTask.id}
              sidebar={<CompanyMaterialPanel ref={materialPanelRef} company={company} />}
              sidebarTitle="参考材料"
              onSidebarCapture={() => materialPanelRef.current?.startCapture()}
              taskPane={
                <div className="flex h-full flex-col">
                  <div className="flex items-center justify-between border-b border-[#e5e6eb] px-5 py-3 text-xs text-[#86909c]">
                    <span>5分钟后系统自动提交，无需手动操作。</span>
                    <span className="rounded-full bg-[#e8f3ff] px-3 py-1 text-xs font-semibold text-[#1e80ff]">
                      自动提交，无需手动操作
                    </span>
                  </div>
                  <ScopedZoomSurface className="min-h-0 flex-1 overflow-y-auto" contentClassName="min-h-full">
                    {bootstrap ? (
                      <ATaskEditor
                        sessionCode={bootstrap.sessionCode}
                        taskId={runtime.currentTask.id}
                        initialData={taskDraft}
                        company={company}
                        disabled={runtime.isFrozen}
                      />
                    ) : null}
                  </ScopedZoomSurface>
                </div>
              }
              aiPane={
                bootstrap ? (
                  <ScopedZoomSurface className="h-full overflow-hidden" contentClassName="h-full">
                    <AiChatPanel
                      sessionCode={bootstrap.sessionCode}
                      participantId={bootstrap.participantId}
                      role="A"
                      accent="blue"
                      contextType="main"
                      companyId={company.id}
                      phase={runtime.phase === 'practice' ? 'practice' : 'formal'}
                      segmentIndex={runtime.segmentIndex}
                      aiLevel={runtime.aiLevel}
                      onScreenshot={() => materialPanelRef.current?.startCapture()}
                    />
                  </ScopedZoomSurface>
                ) : (
                  <div />
                )
              }
              taskTitle="尽调表"
              aiTitle="主线 AI"
            />
          )}
        </div>
      </div>
      {bootstrap ? (
        <AFeedbackNotification sessionCode={bootstrap.sessionCode} participantId={bootstrap.participantId} />
      ) : null}
    </main>
  );
}
