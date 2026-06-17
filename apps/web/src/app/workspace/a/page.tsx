'use client';

import { AFeedbackNotification } from '@/components/a-feedback-notification';
import { AiChatPanel } from '@/components/ai-chat-panel';
import { ATaskEditor } from '@/components/a-task-editor';
import { CompanyMaterialPanel, type CompanyMaterialPanelHandle } from '@/components/company-material-panel';
import { PracticeTutorialOverlay } from '@/components/practice-tutorial-overlay';
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
  const finalFlushTaskRef = useRef<string | null>(null);
  const { bootstrap, runtime, loading, countdownLabel, taskCountdownLabel, taskCountdown } = useSessionRuntime();
  const currentTaskId = runtime?.currentTask?.id;
  const { draft: taskDraft } = useTaskDraft(bootstrap?.sessionCode, currentTaskId, 'A', 'main');

  const redirectPath =
    !loading && !bootstrap
      ? '/login'
      : !loading && runtime?.assignedRole === 'B'
        ? '/workspace/b'
        : !loading && runtime?.phase === 'practice_quiz'
          ? '/practice-quiz'
          : !loading && runtime?.phase === 'practice_ready'
            ? runtime.syncState?.selfReady
              ? '/ready?target=practice'
              : null
            : !loading && runtime?.phase === 'practice' && runtime.currentTask?.aSubmittedAt
              ? '/ready?target=formal'
            : !loading && runtime?.phase === 'formal_ready'
              ? '/ready?target=formal'
              : !loading && runtime?.phase === 'pre_segment_instruction'
                ? '/pre-segment-instruction'
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

  useEffect(() => {
    if (!bootstrap || !runtime?.aiUpgradeNotice || runtime.aiUpgradeNotice.type !== 'workspace') return;
    const key = `ai_upgrade_notice_seen:${bootstrap.sessionCode}:${runtime.segmentIndex}:${runtime.assignedRole}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        role: runtime.assignedRole,
        stage: 'ai_upgrade_notice_seen',
        payload: { segmentIndex: runtime.segmentIndex, message: runtime.aiUpgradeNotice.message },
      }),
    }).catch(() => {});
  }, [bootstrap, runtime]);

  if (redirectPath) return null;

  const company = runtime?.currentTask?.company;
  const aiDisplayName =
    runtime?.aiLevel === 'ADVANCED'
      ? runtime.aiDisplayNames?.advanced ?? 'aiseek pro'
      : runtime?.aiDisplayNames?.basic ?? 'aiseek';
  const aiBadge = runtime ? (
    <span className={`rounded-md border px-2 py-1 text-xs font-semibold ${runtime.aiLevel === 'ADVANCED' ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-slate-50 text-slate-600'}`}>
      {aiDisplayName}
    </span>
  ) : null;
  const isPractice = runtime?.phase === 'practice';

  return (
    <main className="h-screen w-screen overflow-hidden bg-[#f0f2f5] text-sm text-[#1d2129]">
      <div className="flex h-full flex-col">
        <SessionTopbar
          roleLabel="尽调员"
          currentLabel={company?.name ?? '当前项目'}
          stageLabel={isPractice ? '测试轮剩余时间' : '当前阶段剩余时间'}
          countdownLabel={countdownLabel}
          taskCountdownLabel={isPractice ? undefined : taskCountdownLabel}
        />
        {bootstrap && runtime ? (
          <SideTaskStrip
            sessionCode={bootstrap.sessionCode}
            participantId={bootstrap.participantId}
            role="A"
            aiLevel={runtime.aiLevel}
            sideTaskQueue={runtime.sideTaskQueue}
            sideTaskConfig={runtime.sideTaskConfig}
            phase={runtime.phase === 'practice' ? 'practice' : 'formal'}
            segmentIndex={runtime.segmentIndex}
          />
        ) : null}
        <div className="min-h-0 flex-1 p-2">
          {!company || !runtime?.currentTask ? (
            <div className="flex h-full items-center justify-center rounded-xl border border-[#e5e6eb] bg-white text-sm text-[#86909c] shadow-sm">
              当前工作阶段没有可处理的项目。
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
                    <div className="flex flex-col gap-1">
                      {runtime.aiUpgradeNotice?.type === 'workspace' ? (
                        <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 font-semibold text-[#1e80ff]">
                          {runtime.aiUpgradeNotice.message}
                        </span>
                      ) : null}
                      <span>单家公司 5 分钟到点后系统会自动提交，无需手动操作。</span>
                    </div>
                    <span className="rounded-full bg-[#e8f3ff] px-3 py-1 text-xs font-semibold text-[#1e80ff]">
                      自动提交
                    </span>
                  </div>
                  <ScopedZoomSurface className="min-h-0 flex-1 overflow-y-auto" contentClassName="min-h-full">
                    {bootstrap ? (
                      <ATaskEditor
                        sessionCode={bootstrap.sessionCode}
                        taskId={runtime.currentTask.id}
                        initialData={taskDraft}
                        company={company}
                        disabled={runtime.isFrozen || (runtime.phase === 'practice' && Boolean(runtime.currentTask.aSubmittedAt))}
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
                      taskAssignmentId={runtime.currentTask?.id}
                      phase={runtime.phase === 'practice' ? 'practice' : 'formal'}
                      segmentIndex={runtime.segmentIndex}
                      aiLevel={runtime.aiLevel}
                      disabledReason={runtime.phase === 'practice' ? 'AI 功能将在正式任务开始后启用。' : undefined}
                      onScreenshot={() => materialPanelRef.current?.startCapture()}
                    />
                  </ScopedZoomSurface>
                ) : (
                  <div />
                )
              }
              taskTitle="尽调表"
              aiTitle="AI助手"
              aiBadge={aiBadge}
            />
          )}
        </div>
      </div>
      {bootstrap ? (
        <AFeedbackNotification
          sessionCode={bootstrap.sessionCode}
          participantId={bootstrap.participantId}
          durationSec={runtime?.feedbackNotificationDurationSec ?? 10}
        />
      ) : null}
      {bootstrap && runtime?.phase === 'practice' && !runtime.practiceTutorialState?.completed ? (
        <PracticeTutorialOverlay
          sessionCode={bootstrap.sessionCode}
          participantId={bootstrap.participantId}
          role="A"
          aiLevel={runtime.aiLevel}
          completedSteps={runtime.practiceTutorialState?.completedSteps ?? []}
        />
      ) : null}
    </main>
  );
}
