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

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

export default function WorkspaceAPage() {
  const router = useRouter();
  const materialPanelRef = useRef<CompanyMaterialPanelHandle>(null);
  const { bootstrap, runtime, loading, countdownLabel, taskCountdownLabel, refresh } = useSessionRuntime();
  const currentTaskId = runtime?.currentTask?.id;
  const { draft: taskDraft } = useTaskDraft(bootstrap?.sessionCode, currentTaskId, 'A', 'main');

  const redirectPath =
    !loading && !bootstrap
      ? '/login'
      : !loading && runtime?.assignedRole === 'B'
        ? '/workspace/b'
        : !loading && runtime?.phase === 'practice'
          ? '/practice'
          : !loading && runtime?.phase === 'formal_break'
            ? '/break'
            : !loading && runtime?.phase === 'end'
              ? '/workspace/end'
              : null;

  useEffect(() => {
    if (redirectPath) router.replace(redirectPath);
  }, [redirectPath, router]);

  if (redirectPath) return null;

  async function handleSubmit() {
    if (!bootstrap || !runtime?.currentTask) return;
    await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/tasks/${runtime.currentTask.id}/a-submit`, {
      method: 'POST',
    });
    await refresh();
  }

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
            phase={runtime.phase === 'practice' ? 'practice' : 'formal'}
            segmentIndex={runtime.segmentIndex}
            aiLevel={runtime.aiLevel}
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
                    <span>请先完成尽调表填写。提交后，投资经理会在自己的材料区查看你的信息。</span>
                    <button
                      type="button"
                      onClick={() => void handleSubmit()}
                      className="rounded-md bg-[#28a745] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-600"
                    >
                      提交给投资经理
                    </button>
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
      {bootstrap ? <AFeedbackNotification sessionCode={bootstrap.sessionCode} participantId={bootstrap.participantId} /> : null}
    </main>
  );
}
