'use client';

import { AiChatPanel } from '@/components/ai-chat-panel';
import { BTaskEditor } from '@/components/b-task-editor';
import { CompanyMaterialPanel, type CompanyMaterialPanelHandle } from '@/components/company-material-panel';
import { PracticeTutorialOverlay } from '@/components/practice-tutorial-overlay';
import { ScopedZoomSurface } from '@/components/scoped-zoom-surface';
import { SessionTopbar } from '@/components/session-topbar';
import { SideTaskStrip } from '@/components/sidetask-strip';
import { WorkbenchLayout } from '@/components/workbench-layout';
import { OnlineIntegrityGuard } from '@/components/online-integrity-guard';
import { idempotencyHeaders } from '@/lib/idempotency';
import { useSessionRuntime, useTaskDraft, type CompanyData, type MaterialItem } from '@/lib/session-runtime';
import { useBAOriginalMaterialExposure } from '@/lib/use-b-a-material-exposure';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

const serverBaseUrl = process.env.NEXT_PUBLIC_SERVER_BASE_URL ?? 'http://localhost:3001';

type NormalizedADraft = {
  metricRows: { label: string; value: string }[];
  materialClues: {
    materialName: string;
    opportunityStatus: '' | 'HAS' | 'NONE';
    opportunityEvidence: string;
    riskStatus: '' | 'HAS' | 'NONE';
    riskEvidence: string;
  }[];
  noteTypes: string[];
  handoffMemo: string;
};

function normalizeADraft(payload: unknown): NormalizedADraft {
  const data = payload && typeof payload === 'object' ? (payload as Record<string, unknown>) : {};
  const metrics = (data.metrics && typeof data.metrics === 'object' ? data.metrics : {}) as Record<string, string>;
  const metricRows =
    metrics.indicator || metrics.content
      ? [{ label: metrics.indicator || '未填写指标', value: metrics.content || '' }]
      : metricLabels.map((metric) => ({
          label: metric.label,
          value:
            metrics[metric.key] ??
            (metric.key === 'totalAssetsOrYear' ? metrics.latestTotalAssets : undefined) ??
            (metric.key === 'revenueOrSampleCount' ? metrics.latestRevenue : undefined) ??
            '',
        }));
  const materialClues = Array.isArray(data.materialClues)
    ? data.materialClues.map((item) => {
        const row = item && typeof item === 'object' ? (item as Record<string, unknown>) : {};
        return {
          materialName: String(row.materialName ?? '未命名材料'),
          opportunityStatus: (row.opportunityStatus === 'HAS' || row.opportunityStatus === 'NONE' ? row.opportunityStatus : '') as '' | 'HAS' | 'NONE',
          opportunityEvidence: String(row.opportunityEvidence ?? ''),
          riskStatus: (row.riskStatus === 'HAS' || row.riskStatus === 'NONE' ? row.riskStatus : '') as '' | 'HAS' | 'NONE',
          riskEvidence: String(row.riskEvidence ?? ''),
        };
      })
    : [];

  return {
    metricRows,
    materialClues,
    noteTypes: Array.isArray(data.noteTypes) ? data.noteTypes.map(String) : [],
    handoffMemo: String(data.handoffMemo ?? ''),
  };
}

function formatRemainingTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes <= 0) return `${seconds} 秒`;
  return `${minutes} 分 ${String(seconds).padStart(2, '0')} 秒`;
}

const metricLabels = [
  { key: 'totalAssetsOrYear', label: '总资产 / 统计年份' },
  { key: 'revenueOrSampleCount', label: '营业收入 / 样本企业数量' },
  { key: 'subsidiaryOrPolicyCount', label: '子公司数量 / 政策文件数量' },
  { key: 'foundingYearOrApplicationCount', label: '成立年份 / 下游应用类别数量' },
  { key: 'employeesOrCoverageCount', label: '员工人数 / 覆盖区域数量' },
  { key: 'shareCapitalOrPeerSampleCount', label: '总股本数 / 可比公司样本数量' },
];

export default function WorkspaceBPage() {
  const router = useRouter();
  const materialPanelRef = useRef<CompanyMaterialPanelHandle>(null);
  const {
    bootstrap,
    runtime,
    loading,
    countdownLabel,
    refresh,
    lastEvent,
    connectionStatus,
    pendingDraftCount,
  } = useSessionRuntime();
  const currentTaskId = runtime?.currentTask?.id;
  const { draft: diligenceDraftPayload, refresh: refreshDiligenceDraft } = useTaskDraft(
    bootstrap?.sessionCode,
    currentTaskId,
    'A',
    'main',
  );
  const { draft: taskDraft } = useTaskDraft(bootstrap?.sessionCode, currentTaskId, 'B', 'main');
  const [activeSidebarKey, setActiveSidebarKey] = useState<string | undefined>(undefined);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const redirectPath =
    !loading && !bootstrap
      ? '/login'
      : !loading && runtime?.assignedRole === 'A'
        ? '/workspace/a'
        : !loading && runtime?.phase === 'practice_quiz'
          ? '/practice-quiz'
          : !loading && runtime?.phase === 'practice_ready'
            ? runtime.syncState?.selfReady
              ? '/ready?target=practice'
              : null
            : !loading && runtime?.phase === 'practice' && runtime.currentTask?.bCompletedAt
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
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const materials = runtime?.currentTask?.company?.materials ?? [];
    const firstMaterialId = materials.find((item) => {
      const role = item.metadata?.participantRole;
      return role === undefined || role === null || role === 'shared' || role === 'B';
    })?.id;
    setActiveSidebarKey((current) => {
      if (!currentTaskId) return firstMaterialId;
      if (current && (current === 'diligence-info' || materials.some((item) => item.id === current))) return current;
      return firstMaterialId;
    });
  }, [currentTaskId, runtime?.currentTask?.company?.id, runtime?.currentTask?.company?.materials?.length]);

  async function openDiligenceInfo() {
    if (!bootstrap || !runtime?.currentTask || !runtime.aInfoUnlocked) return;
    await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/tasks/${runtime.currentTask.id}/view-a-info`, {
      method: 'POST',
      headers: idempotencyHeaders(`view-a-info:${bootstrap.sessionCode}:${runtime.currentTask.id}`),
    });
    setActiveSidebarKey('diligence-info');
    await refreshDiligenceDraft();
    await refresh();
  }

  async function openAMaterials() {
    if (!bootstrap || !runtime?.currentTask || !runtime.aInfoUnlocked) return;
    await fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/tasks/${runtime.currentTask.id}/view-a-materials`, {
      method: 'POST',
      headers: idempotencyHeaders(`view-a-materials:${bootstrap.sessionCode}:${runtime.currentTask.id}`),
    });
    await refresh();
  }

  const company = runtime?.currentTask?.company;
  const diligenceDraft = useMemo(() => normalizeADraft(diligenceDraftPayload), [diligenceDraftPayload]);
  const highlightedClues = useMemo(
    () => diligenceDraft.materialClues.filter((row) => row.opportunityStatus === 'HAS' || row.riskStatus === 'HAS'),
    [diligenceDraft.materialClues],
  );

  useEffect(() => {
    if (!runtime?.aInfoUnlocked || !currentTaskId) return;
    void refreshDiligenceDraft();
  }, [currentTaskId, refreshDiligenceDraft, runtime?.aInfoUnlocked]);

  useEffect(() => {
    if (!runtime?.aInfoUnlocked || !currentTaskId) return;
    if (lastEvent?.type !== 'a_task_auto_submitted' && lastEvent?.type !== 'a_task_submitted' && lastEvent?.type !== 'practice_a_task_auto_submitted') return;
    const payload = lastEvent.data && typeof lastEvent.data === 'object' ? (lastEvent.data as { taskId?: string }) : null;
    if (payload?.taskId && payload.taskId !== currentTaskId) return;
    void refreshDiligenceDraft();
  }, [currentTaskId, lastEvent, refreshDiligenceDraft, runtime?.aInfoUnlocked]);

  useEffect(() => {
    if (!bootstrap || !runtime?.aiUpgradeNotice || runtime.aiUpgradeNotice.type !== 'workspace') return;
    const key = `ai_upgrade_notice_seen:${bootstrap.sessionCode}:${runtime.segmentIndex}:${runtime.assignedRole}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, '1');
    void fetch(`${serverBaseUrl}/experiment/session/${bootstrap.sessionCode}/progress`, {
      method: 'POST',
      headers: idempotencyHeaders(`progress:${bootstrap.sessionCode}:${runtime.assignedRole}:ai_upgrade_notice_seen:${runtime.segmentIndex}`, {
        'Content-Type': 'application/json',
      }),
      body: JSON.stringify({
        role: runtime.assignedRole,
        stage: 'ai_upgrade_notice_seen',
        payload: { segmentIndex: runtime.segmentIndex, message: runtime.aiUpgradeNotice.message },
      }),
    }).catch(() => {});
  }, [bootstrap, runtime]);

  const sharedAndBMaterials = useMemo(
    () =>
      (company?.materials ?? []).filter((item) => {
        const role = item.metadata?.participantRole;
        return role === undefined || role === null || role === 'shared' || role === 'B';
      }),
    [company?.materials],
  );
  const aMaterials = useMemo(
    () => (company?.materials ?? []).filter((item) => String(item.metadata?.participantRole ?? '').toUpperCase() === 'A'),
    [company?.materials],
  );
  const companyForBMaterials = useMemo<CompanyData | null>(
    () => (company ? { ...company, materials: sharedAndBMaterials } : null),
    [company, sharedAndBMaterials],
  );
  const lockedAMaterialIds = useMemo(
    () => (!runtime?.bHasViewedAMaterials ? aMaterials.map((item) => item.id) : []),
    [aMaterials, runtime?.bHasViewedAMaterials],
  );
  const aMaterialIds = useMemo(() => aMaterials.map((item) => item.id), [aMaterials]);
  useBAOriginalMaterialExposure({
    sessionCode: bootstrap?.sessionCode,
    participantId: bootstrap?.participantId,
    taskAssignmentId: runtime?.currentTask?.id,
    companyId: runtime?.currentTask?.company?.id,
    phase: runtime?.phase === 'practice' ? 'practice' : 'formal',
    segmentIndex: runtime?.segmentIndex,
    activeItemKey: activeSidebarKey,
    aMaterialIds,
    unlocked: Boolean(runtime?.bHasViewedAMaterials),
    enabled: runtime?.phase === 'practice' || runtime?.phase === 'formal_work',
  });
  const isPractice = runtime?.phase === 'practice';
  const bReadyAtMs = runtime?.currentTask?.bCanSubmitAt ? new Date(runtime.currentTask.bCanSubmitAt).getTime() : null;
  const bRemainingSeconds = bReadyAtMs ? Math.max(0, Math.ceil((bReadyAtMs - nowMs) / 1000)) : 0;
  const aHasSubmitted = Boolean(runtime?.currentTask?.aUnlockedForBAt);
  const bReviewGateMessage =
    aHasSubmitted && bRemainingSeconds > 0
      ? `A的任务结果已送达；任务1还需处理 ${formatRemainingTime(bRemainingSeconds)} 后可查看并提交。`
      : aHasSubmitted
        ? 'A的任务结果已经可以查看。'
        : runtime?.aiEnabled
          ? 'A的任务结果尚未同步。你可以先阅读自己的材料、填写任务表并使用 AI。'
          : 'A的任务结果尚未同步。你可以先阅读自己的材料并填写任务表。';

  const diligenceTabContent = !runtime?.aInfoUnlocked ? (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-[#c9cdd4] bg-gray-50 p-6 text-center text-sm text-[#86909c]">
      <div className="mb-2 text-base font-bold text-[#1d2129]">A的任务结果尚未同步</div>
      <div>{bReviewGateMessage}</div>
    </div>
  ) : !runtime.bHasViewedAInfo ? (
    <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-[#bfd8ff] bg-[#f7fbff] p-6 text-center text-sm text-[#4e5969]">
      <div className="mb-2 text-base font-bold text-[#1d2129]">A的任务结果已送达</div>
      <div className="mb-5 max-w-md leading-7">你现在可以查看A提交的任务结果，并按需核对A的原始材料。</div>
      <button
        type="button"
        onClick={() => void openDiligenceInfo()}
        className="rounded-lg bg-[#1e80ff] px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-600"
      >
        查看A的任务结果
      </button>
    </div>
  ) : (
    <div className="space-y-4 text-xs leading-6 text-[#4e5969]">
      <div className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-3">
        <div className="mb-2 font-medium text-[#1d2129]">基础数值摘录</div>
        <div className="grid gap-x-4 gap-y-1 md:grid-cols-2">
          {diligenceDraft.metricRows.map((metric) => (
            <div key={metric.label}>
              <span className="text-[#86909c]">{metric.label}：</span>
              <span>{metric.value || '未填写'}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-3">
        <div className="mb-2 font-medium text-[#1d2129]">材料线索</div>
        {highlightedClues.length > 0 ? (
          <div className="space-y-2">
            {highlightedClues.map((row) => (
              <div key={row.materialName} className="rounded-md bg-white px-3 py-2">
                <div className="font-medium text-[#1d2129]">{row.materialName}</div>
                <div>
                  机会：
                  {row.opportunityStatus === 'HAS'
                    ? row.opportunityEvidence || '已标记但未填写证据'
                    : row.opportunityStatus === 'NONE'
                      ? '未发现'
                      : '未作答'}
                </div>
                <div>
                  风险：
                  {row.riskStatus === 'HAS'
                    ? row.riskEvidence || '已标记但未填写证据'
                    : row.riskStatus === 'NONE'
                      ? '未发现'
                      : '未作答'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>暂无已标记的机会或风险线索。</div>
        )}
      </div>
      <div className="rounded-lg border border-[#e5e6eb] bg-gray-50 p-3">
        <div className="mb-2 font-medium text-[#1d2129]">交接备注</div>
        <div>备注类型：{diligenceDraft.noteTypes.length > 0 ? diligenceDraft.noteTypes.join('、') : '未选择'}</div>
        <div className="mt-1 whitespace-pre-wrap">{diligenceDraft.handoffMemo || '暂无交接备注'}</div>
      </div>
    </div>
  );

  if (redirectPath) return null;

  return (
    <main className="fixed inset-0 overflow-hidden bg-[#f0f2f5] text-sm text-[#1d2129]">
      <OnlineIntegrityGuard bootstrap={bootstrap} runtime={runtime} />
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <SessionTopbar
          roleLabel="B"
          currentLabel={company?.name ?? '当前项目'}
          stageLabel={isPractice ? '测试轮剩余时间' : '当前阶段剩余时间'}
          countdownLabel={countdownLabel}
          connectionStatus={connectionStatus}
          pendingDraftCount={pendingDraftCount}
        />
        {bootstrap && runtime ? (
          <SideTaskStrip
            sessionCode={bootstrap.sessionCode}
            participantId={bootstrap.participantId}
            role="B"
            aiLevel={runtime.aiLevel}
            aiEnabled={runtime.aiEnabled}
            sideTaskQueue={runtime.sideTaskQueue}
            sideTaskConfig={runtime.sideTaskConfig}
            phase={runtime.phase === 'practice' ? 'practice' : 'formal'}
            segmentIndex={runtime.segmentIndex}
            showPracticeDemoTask={runtime.phase === 'practice' && !runtime.practiceTutorialState?.completed}
          />
        ) : null}
        <div className="min-h-0 flex-1 overflow-hidden p-2">
          {!company || !runtime?.currentTask ? (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-[#e5e6eb] bg-white text-sm text-[#86909c] shadow-sm">
              <div className="mb-2 text-base font-bold text-[#1d2129]">当前没有待处理项目</div>
              <div>你仍然可以处理任务2。</div>
            </div>
          ) : (
            <WorkbenchLayout
              aiEnabled={runtime.aiEnabled && !isPractice}
              key={runtime.currentTask.id}
              sidebar={
                <CompanyMaterialPanel
                  ref={materialPanelRef}
                  company={companyForBMaterials ?? company}
                  appendMaterials={aMaterials as MaterialItem[]}
                  lockedMaterialIds={lockedAMaterialIds}
                  lockedMaterialMessage={
                    runtime.aInfoUnlocked
                      ? '点击查看后，本公司的全部 A 原始材料都会解锁。'
                      : bReviewGateMessage
                  }
                  onUnlockMaterialGroup={runtime.aInfoUnlocked ? () => void openAMaterials() : undefined}
                  activeItemKey={activeSidebarKey}
                  onActiveItemChange={setActiveSidebarKey}
                  prependItems={[
                    {
                      key: 'diligence-info',
                      label: 'A的任务结果',
                      content: diligenceTabContent,
                    },
                  ]}
                />
              }
              sidebarTitle="参考材料"
              onSidebarCapture={() => materialPanelRef.current?.startCapture()}
              taskPane={
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[#e5e6eb] px-5 py-3 text-xs text-[#86909c]">
                    <div className="flex flex-col gap-1">
                      {runtime.aiUpgradeNotice?.type === 'workspace' ? (
                        <span className="rounded-md border border-blue-100 bg-blue-50 px-2 py-1 font-semibold text-[#1e80ff]">
                          {runtime.aiUpgradeNotice.message}
                        </span>
                      ) : null}
                      <span>B任务1剩余时间：{bRemainingSeconds > 0 ? formatRemainingTime(bRemainingSeconds) : '00 秒（已满5分钟）'}</span>
                      <span>{runtime.bCanSubmit ? 'A的任务结果已经可以查看，可以直接提交。' : bReviewGateMessage}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => router.push('/workspace/b-feedback')}
                      disabled={!runtime.bCanSubmit}
                      title={!runtime.bCanSubmit ? bReviewGateMessage : undefined}
                      className="shrink-0 rounded-md bg-[#28a745] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      提交并填写反馈
                    </button>
                  </div>
                  <ScopedZoomSurface className="no-scrollbar min-h-0 flex-1 overflow-y-auto" contentClassName="min-h-full">
                    {bootstrap ? (
                      <BTaskEditor
                        sessionCode={bootstrap.sessionCode}
                        participantId={bootstrap.participantId}
                        taskId={runtime.currentTask.id}
                        initialData={taskDraft}
                        company={company}
                        disabled={runtime.isFrozen}
                        phase={runtime.phase === 'practice' ? 'practice' : 'formal'}
                        segmentIndex={runtime.segmentIndex}
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
                      role="B"
                      accent="purple"
                      contextType="main"
                      companyId={company.id}
                      taskAssignmentId={runtime.currentTask?.id}
                      phase={runtime.phase === 'practice' ? 'practice' : 'formal'}
                      segmentIndex={runtime.segmentIndex}
                      aiLevel={runtime.aiLevel}
                      disabledReason={
                        connectionStatus === 'offline'
                          ? '网络异常，AI助手将在网络恢复后可用'
                          : runtime.phase === 'practice'
                            ? '测试轮仅用于熟悉任务流程，AI助手将在正式任务开始后启用'
                            : undefined
                      }
                      onScreenshot={() => materialPanelRef.current?.startCapture()}
                    />
                  </ScopedZoomSurface>
                ) : (
                  <div />
                )
              }
              taskTitle="任务表"
              aiTitle="AI助手"
            />
          )}
        </div>
      </div>
      {bootstrap && runtime?.phase === 'practice' && !runtime.practiceTutorialState?.completed ? (
        <PracticeTutorialOverlay
          sessionCode={bootstrap.sessionCode}
          participantId={bootstrap.participantId}
          role="B"
          aiLevel={runtime.aiLevel}
          aiEnabled={false}
          completedSteps={runtime.practiceTutorialState?.completedSteps ?? []}
        />
      ) : null}
    </main>
  );
}
